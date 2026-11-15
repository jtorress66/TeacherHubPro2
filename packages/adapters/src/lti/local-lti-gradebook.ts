import { z } from 'zod';
import { ltiAgsScope } from '@thp/domain';

/** Who an access token was granted to, when it carries the scope; null otherwise. */
export type ServiceClientCheck = (
  authorization: string | null,
  scope: string,
) => Promise<string | null>;

/** A column of the test course's gradebook. */
export interface LocalLineItem {
  readonly id: string;
  readonly label: string;
  readonly resourceId: string;
  readonly scoreMaximum: number;
  readonly tag: string | null;
}

/** A score as the gradebook keeps it: the latest one for each user. */
export interface LocalScore {
  readonly userId: string;
  readonly scoreGiven: number;
  readonly scoreMaximum: number;
  readonly timestamp: string;
}

/** What one client's gradebook holds: each column with its scores. */
export interface LocalGradebookView {
  readonly lineItems: readonly (LocalLineItem & { readonly scores: readonly LocalScore[] })[];
}

/** An answer for the route to send as it is. */
export interface LocalAnswer {
  readonly status: number;
  readonly body: unknown;
}

const newLineItem = z.object({
  label: z.string().min(1).max(255),
  resourceId: z.string().min(1).max(255),
  scoreMaximum: z.number().positive(),
  tag: z.string().max(255).optional(),
});

const score = z.object({
  userId: z.string().min(1),
  scoreGiven: z.number().nonnegative(),
  scoreMaximum: z.number().positive(),
  activityProgress: z.string(),
  gradingProgress: z.string(),
  timestamp: z.iso.datetime({ offset: true }),
});

const unauthorized: LocalAnswer = { status: 401, body: { error: 'unauthorized' } };
const notFound: LocalAnswer = { status: 404, body: { error: 'not_found' } };
const badRequest: LocalAnswer = { status: 400, body: { error: 'bad_request' } };

interface Book {
  readonly items: LocalLineItem[];
  readonly scores: Map<string, Map<string, LocalScore>>;
}

/**
 * The pretend course system's gradebook (Assignment and Grade Services), kept in memory, one per
 * tool client: list and add columns, take scores (the latest by timestamp wins), and show what it
 * holds. Development and tests only.
 */
export class LocalLtiGradebook {
  private readonly books = new Map<string, Book>();
  private made = 0;

  constructor(
    readonly lineItemsUrl: string,
    private readonly clientOf: ServiceClientCheck,
  ) {}

  /** The client's columns, only those for the resource when one is named. */
  async listLineItems(
    authorization: string | null,
    resourceId: string | null,
  ): Promise<LocalAnswer> {
    const client = await this.clientOf(authorization, ltiAgsScope.lineItem);
    if (client === null) return unauthorized;
    const items = this.book(client).items.filter(
      (item) => resourceId === null || item.resourceId === resourceId,
    );
    return { status: 200, body: items };
  }

  async createLineItem(authorization: string | null, body: unknown): Promise<LocalAnswer> {
    const client = await this.clientOf(authorization, ltiAgsScope.lineItem);
    if (client === null) return unauthorized;
    const parsed = newLineItem.safeParse(body);
    if (!parsed.success) return badRequest;
    this.made += 1;
    const item: LocalLineItem = {
      id: `${this.lineItemsUrl}/${String(this.made)}`,
      label: parsed.data.label,
      resourceId: parsed.data.resourceId,
      scoreMaximum: parsed.data.scoreMaximum,
      tag: parsed.data.tag ?? null,
    };
    this.book(client).items.push(item);
    return { status: 201, body: item };
  }

  /** A score for one of the client's columns, named by the number at the end of its address. */
  async postScore(
    authorization: string | null,
    lineItemNumber: string,
    body: unknown,
  ): Promise<LocalAnswer> {
    const client = await this.clientOf(authorization, ltiAgsScope.score);
    if (client === null) return unauthorized;
    const book = this.book(client);
    const item = book.items.find((row) => row.id === `${this.lineItemsUrl}/${lineItemNumber}`);
    if (item === undefined) return notFound;
    const parsed = score.safeParse(body);
    if (!parsed.success) return badRequest;
    const { userId, scoreGiven, scoreMaximum, timestamp } = parsed.data;
    const scores = book.scores.get(item.id) ?? new Map<string, LocalScore>();
    book.scores.set(item.id, scores);
    const earlier = scores.get(userId);
    if (earlier === undefined || Date.parse(earlier.timestamp) <= Date.parse(timestamp)) {
      scores.set(userId, { userId, scoreGiven, scoreMaximum, timestamp });
    }
    return { status: 204, body: null };
  }

  /** Everything the client's gradebook holds, to check what arrived. */
  view(client: string): LocalGradebookView {
    const book = this.book(client);
    return {
      lineItems: book.items.map((item) => ({
        ...item,
        scores: [...(book.scores.get(item.id)?.values() ?? [])],
      })),
    };
  }

  private book(client: string): Book {
    const existing = this.books.get(client);
    if (existing !== undefined) return existing;
    const made: Book = { items: [], scores: new Map() };
    this.books.set(client, made);
    return made;
  }
}
