import { z } from 'zod';
import {
  isPrChoice,
  isPrSubject,
  prDomainOf,
  prStandardsFor,
  type StandardDomain,
} from '@thp/domain';

export interface PrCode {
  readonly code: string;
  readonly description: string;
  /** The plan category the code goes in. */
  readonly domain: StandardDomain;
  readonly course: string | null;
}

const query = z.object({
  subject: z.string().refine(isPrSubject),
  grade: z.string().refine(isPrChoice),
});

/** The Puerto Rico codes for the plan editor's picker; a bad subject or grade is refused. */
export function prCodesFor(
  params: URLSearchParams,
): { readonly status: 200; readonly codes: readonly PrCode[] } | { readonly status: 400 } {
  const parsed = query.safeParse(Object.fromEntries(params));
  if (!parsed.success) return { status: 400 };
  const codes = prStandardsFor(parsed.data.subject, parsed.data.grade).map((standard) => ({
    code: standard.code,
    description: standard.description,
    domain: prDomainOf(standard),
    course: standard.course,
  }));
  return { status: 200, codes };
}
