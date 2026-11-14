import {
  approvalLogReaderContract,
  auditLogContract,
  rateLimiterContract,
} from '../contracts/hardening.contract.ts';
import { InMemoryAuditLog, InMemoryRateLimiter } from './hardening.ts';

rateLimiterContract('InMemoryRateLimiter', () => new InMemoryRateLimiter());
auditLogContract('InMemoryAuditLog', () => new InMemoryAuditLog());
approvalLogReaderContract('InMemoryAuditLog', () => new InMemoryAuditLog());
