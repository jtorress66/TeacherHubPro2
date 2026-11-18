import {
  approvalLogReaderContract,
  auditLogContract,
  rateLimiterContract,
  usedTicketRepositoryContract,
} from '../contracts/hardening.contract.ts';
import {
  InMemoryAuditLog,
  InMemoryRateLimiter,
  InMemoryUsedTicketRepository,
} from './hardening.ts';

rateLimiterContract('InMemoryRateLimiter', () => new InMemoryRateLimiter());
usedTicketRepositoryContract(
  'InMemoryUsedTicketRepository',
  () => new InMemoryUsedTicketRepository(),
);
auditLogContract('InMemoryAuditLog', () => new InMemoryAuditLog());
approvalLogReaderContract('InMemoryAuditLog', () => new InMemoryAuditLog());
