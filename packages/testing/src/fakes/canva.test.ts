import {
  canvaAuthorizationContract,
  canvaConnectionRepositoryContract,
  canvaDesignsContract,
} from '../contracts/canva.contract.ts';
import { FakeCanvaAuthorization, FakeCanvaDesigns } from './canva.ts';
import { InMemoryCanvaConnectionRepository } from './repositories.ts';

canvaConnectionRepositoryContract(
  'InMemoryCanvaConnectionRepository',
  () => new InMemoryCanvaConnectionRepository(),
);
canvaAuthorizationContract('FakeCanvaAuthorization', () => ({
  auth: new FakeCanvaAuthorization(),
  code: FakeCanvaAuthorization.code,
  codeVerifier: FakeCanvaAuthorization.verifier,
}));
canvaDesignsContract('FakeCanvaDesigns', () => ({
  designs: new FakeCanvaDesigns(),
  accessToken: FakeCanvaAuthorization.accessToken,
}));
