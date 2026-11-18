import { referralRepositoryContract } from '../contracts/referrals.contract.ts';
import { InMemoryReferralRepository } from './referrals.ts';

referralRepositoryContract('InMemoryReferralRepository', () => new InMemoryReferralRepository());
