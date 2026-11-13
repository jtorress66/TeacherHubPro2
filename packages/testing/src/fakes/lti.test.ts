import {
  ltiRepositoryContract,
  ltiTokenVerifierContract,
  toolKeyStoreContract,
} from '../contracts/lti.contract.ts';
import {
  FakeLtiTokens,
  FakeLtiTokenVerifier,
  FakeToolKeyStore,
  InMemoryLtiNonceRepository,
  InMemoryLtiPlatformRepository,
  InMemoryLtiUserLinkRepository,
} from './lti.ts';

ltiRepositoryContract('In-memory', () => {
  const platforms = new InMemoryLtiPlatformRepository();
  return {
    platforms,
    nonces: new InMemoryLtiNonceRepository(),
    userLinks: new InMemoryLtiUserLinkRepository(platforms),
  };
});

ltiTokenVerifierContract('FakeLtiTokenVerifier', () => {
  const issuer = new FakeLtiTokens();
  return { verifier: new FakeLtiTokenVerifier([issuer]), issuer };
});

toolKeyStoreContract('FakeToolKeyStore', () => new FakeToolKeyStore());
