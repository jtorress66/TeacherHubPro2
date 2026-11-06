import type { Kysely, Selectable } from 'kysely';
import {
  leadScores,
  type ChatSession,
  type ChatSessionId,
  type ChatTurn,
  type ChatTurnId,
  type Email,
  type Lead,
  type LeadId,
  type LeadScore,
  type LeadSource,
  type LeadStatus,
} from '@thp/domain';
import type { ChatSessionRepository, ChatTurnQueue, LeadQuery, LeadRepository } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import type { ChatSessionsTable, ChatTurnsTable, Database, LeadsTable } from '../schema.ts';

const leadFromRow = (row: Selectable<LeadsTable>): Lead => ({
  id: row.id as LeadId,
  name: row.name,
  email: row.email as Email,
  organization: row.organization,
  role: row.role,
  phone: row.phone,
  interest: row.interest,
  source: oneOf<LeadSource>(['chat', 'contact'], row.source, 'leads.source'),
  message: row.message,
  locale: row.locale,
  page: row.page,
  score: oneOf<LeadScore>(leadScores, row.score, 'leads.score'),
  status: oneOf<LeadStatus>(['new', 'contacted', 'closed'], row.status, 'leads.status'),
  createdAt: row.received_at,
});

export class PostgresLeadRepository implements LeadRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(lead: Lead): Promise<void> {
    const row = {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      organization: lead.organization,
      role: lead.role,
      phone: lead.phone,
      interest: lead.interest,
      source: lead.source,
      message: lead.message,
      locale: lead.locale,
      page: lead.page,
      score: lead.score,
      status: lead.status,
      received_at: lead.createdAt,
    };
    await this.db
      .insertInto('leads')
      .values(row)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(row))
      .execute();
  }

  async findById(id: LeadId): Promise<Lead | null> {
    const row = await this.db
      .selectFrom('leads')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : leadFromRow(row);
  }

  async search(query: LeadQuery): Promise<readonly Lead[]> {
    let select = this.db.selectFrom('leads').selectAll();
    const text = query.text?.trim() ?? '';
    if (text !== '') {
      const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      select = select.where((eb) =>
        eb.or([
          eb('name', 'ilike', pattern),
          eb('email', 'ilike', pattern),
          eb('organization', 'ilike', pattern),
        ]),
      );
    }
    if (query.score !== undefined) select = select.where('score', '=', query.score);
    if (query.source !== undefined) select = select.where('source', '=', query.source);
    if (query.status !== undefined) select = select.where('status', '=', query.status);
    const rows = await select
      .orderBy('received_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.limit)
      .execute();
    return rows.map(leadFromRow);
  }

  async countByScore(): Promise<Readonly<Record<LeadScore, number>>> {
    const rows = await this.db
      .selectFrom('leads')
      .select(['score', (eb) => eb.fn.countAll<string>().as('count')])
      .groupBy('score')
      .execute();
    const counts = new Map(rows.map((row) => [row.score, Number(row.count)]));
    return Object.fromEntries(leadScores.map((s) => [s, counts.get(s) ?? 0])) as Record<
      LeadScore,
      number
    >;
  }
}

const sessionFromRow = (row: Selectable<ChatSessionsTable>): ChatSession => ({
  id: row.id as ChatSessionId,
  tokenHash: row.token_hash,
  visitorHash: row.visitor_hash,
  role: row.role,
  interest: row.interest,
  locale: row.locale,
  page: row.page,
  turns: row.turns,
  createdAt: row.started_at,
});

const turnFromRow = (row: Selectable<ChatTurnsTable>): ChatTurn => ({
  id: row.id as ChatTurnId,
  sessionId: row.session_id as ChatSessionId,
  message: row.message,
  reply: row.reply,
  status: oneOf(['pending', 'answered', 'failed'] as const, row.status, 'chat_turns.status'),
  createdAt: row.sent_at,
});

/** Website chats and their turns; the turns are the worker's small queue. */
export class PostgresChat implements ChatSessionRepository, ChatTurnQueue {
  constructor(private readonly db: Kysely<Database>) {}

  async save(session: ChatSession): Promise<void> {
    const row = {
      id: session.id,
      token_hash: session.tokenHash,
      visitor_hash: session.visitorHash,
      role: session.role,
      interest: session.interest,
      locale: session.locale,
      page: session.page,
      turns: session.turns,
      started_at: session.createdAt,
    };
    await this.db
      .insertInto('chat_sessions')
      .values(row)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(row))
      .execute();
  }

  async findByTokenHash(tokenHash: string): Promise<ChatSession | null> {
    const row = await this.db
      .selectFrom('chat_sessions')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row === undefined ? null : sessionFromRow(row);
  }

  async findById(id: ChatSessionId): Promise<ChatSession | null> {
    const row = await this.db
      .selectFrom('chat_sessions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : sessionFromRow(row);
  }

  async countVisitorMessagesSince(visitorHash: string, since: Date): Promise<number> {
    const row = await this.db
      .selectFrom('chat_turns')
      .innerJoin('chat_sessions', 'chat_sessions.id', 'chat_turns.session_id')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('chat_sessions.visitor_hash', '=', visitorHash)
      .where('chat_turns.sent_at', '>=', since)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async deleteStartedBefore(cutoff: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('chat_sessions')
      .where('started_at', '<', cutoff)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  async enqueue(turn: ChatTurn): Promise<void> {
    await this.db
      .insertInto('chat_turns')
      .values({
        id: turn.id,
        session_id: turn.sessionId,
        message: turn.message,
        reply: turn.reply,
        status: turn.status,
        claimed: false,
        sent_at: turn.createdAt,
      })
      .execute();
  }

  async claimNext(): Promise<ChatTurn | null> {
    const next = this.db
      .selectFrom('chat_turns')
      .select('id')
      .where('status', '=', 'pending')
      .where('claimed', '=', false)
      .orderBy('sent_at')
      .orderBy('id')
      .limit(1)
      .forUpdate()
      .skipLocked();
    const row = await this.db
      .updateTable('chat_turns')
      .set({ claimed: true })
      .where('id', '=', next)
      .returningAll()
      .executeTakeFirst();
    return row === undefined ? null : turnFromRow(row);
  }

  async answer(id: ChatTurnId, reply: string): Promise<void> {
    await this.db
      .updateTable('chat_turns')
      .set({ reply, status: 'answered' })
      .where('id', '=', id)
      .execute();
  }

  async fail(id: ChatTurnId): Promise<void> {
    await this.db
      .updateTable('chat_turns')
      .set({ status: 'failed' })
      .where('id', '=', id)
      .execute();
  }

  async listForSession(sessionId: ChatSessionId): Promise<readonly ChatTurn[]> {
    const rows = await this.db
      .selectFrom('chat_turns')
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('sent_at')
      .orderBy('id')
      .execute();
    return rows.map(turnFromRow);
  }
}
