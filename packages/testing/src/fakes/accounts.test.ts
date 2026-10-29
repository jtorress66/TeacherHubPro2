import {
  passwordCredentialRepositoryContract,
  sessionRepositoryContract,
} from '../contracts/accounts.contract.ts';
import { InMemoryPasswordCredentialRepository, InMemorySessionRepository } from './accounts.ts';

sessionRepositoryContract('InMemorySessionRepository', () => new InMemorySessionRepository());
passwordCredentialRepositoryContract(
  'InMemoryPasswordCredentialRepository',
  () => new InMemoryPasswordCredentialRepository(),
);
