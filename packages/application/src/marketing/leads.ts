import {
  createLead,
  ok,
  type Lead,
  type LeadId,
  type LeadScore,
  type LeadSource,
  type LeadStatus,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  IdGenerator,
  LeadQuery,
  LeadRepository,
  Mailer,
  MailTemplates,
} from '@thp/ports';
import { requireSuperAdmin } from '../admin/admin-access.ts';
import { fail, type UseCaseError } from '../errors.ts';

export const maxListedLeads = 200;

/**
 * Keeps a lead from the chatbot or contact form, and emails the team about every contact form
 * message and high-priority chat leads (when a team address is set). The email failing never loses the lead.
 */
export class CaptureLead {
  constructor(
    private readonly deps: {
      readonly leads: LeadRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
      readonly mailer: Mailer;
      readonly mailTemplates: MailTemplates;
      readonly leadsNotifyEmail: string | null;
    },
  ) {}

  async execute(input: {
    name: string;
    email: string;
    organization: string | null;
    role: string;
    phone: string | null;
    interest: string;
    source: LeadSource;
    message: string | null;
    locale: string;
    page: string | null;
  }): Promise<Result<Lead, UseCaseError>> {
    const lead = createLead({
      ...input,
      id: this.deps.ids.next() as LeadId,
      now: this.deps.clock.now(),
    });
    if (!lead.ok) return lead;
    await this.deps.leads.save(lead.value);
    const notify = this.deps.leadsNotifyEmail;
    // Someone who wrote through the contact form is waiting for an answer; chat leads only when high.
    const wanted = lead.value.source === 'contact' || lead.value.score === 'high';
    if (wanted && notify !== null) {
      await this.deps.mailer.send({
        to: notify as Lead['email'],
        ...this.deps.mailTemplates.leadNotice({ lead: lead.value }),
      });
    }
    return lead;
  }
}

export interface LeadList {
  readonly leads: readonly Lead[];
  readonly counts: Readonly<Record<LeadScore, number>>;
}

export class ListLeads {
  constructor(private readonly deps: { readonly leads: LeadRepository }) {}

  async execute(input: {
    actor: User;
    query: Omit<LeadQuery, 'limit'>;
  }): Promise<Result<LeadList, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const [leads, counts] = await Promise.all([
      this.deps.leads.search({ ...input.query, limit: maxListedLeads }),
      this.deps.leads.countByScore(),
    ]);
    return ok({ leads, counts });
  }
}

export class UpdateLeadStatus {
  constructor(private readonly deps: { readonly leads: LeadRepository }) {}

  async execute(input: {
    actor: User;
    leadId: LeadId;
    status: LeadStatus;
  }): Promise<Result<Lead, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const lead = await this.deps.leads.findById(input.leadId);
    if (lead === null) return fail('not_found');
    const updated = { ...lead, status: input.status };
    await this.deps.leads.save(updated);
    return ok(updated);
  }
}
