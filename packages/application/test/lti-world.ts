import { ltiClaim, ltiRoles, type User } from '@thp/domain';
import {
  FakeLtiTokens,
  FakeLtiTokenVerifier,
  FakeToolKeyStore,
  InMemoryLtiCourseRepository,
  InMemoryLtiNonceRepository,
  InMemoryLtiPlatformRepository,
  InMemoryLtiUserLinkRepository,
} from '@thp/testing';
import {
  CompleteLtiLaunch,
  RegisterLtiPlatform,
  StartLtiLogin,
  type LtiPlatformDetails,
  type SavedLtiLogin,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp } from './world.ts';

/** A school with a course system (Lincoln Canvas), and launches from it, for the LTI tests. */

export const issuer = 'https://lms.lincoln.edu';
export const tokens = new FakeLtiTokens('lincoln-key', 'https://lms.lincoln.edu/jwks');

export const details = (overrides: Partial<LtiPlatformDetails> = {}): LtiPlatformDetails => ({
  name: 'Lincoln Canvas',
  issuer,
  clientId: 'client-1',
  deploymentIds: 'dep-1, dep-2',
  authLoginUrl: 'https://lms.lincoln.edu/authorize',
  authTokenUrl: 'https://lms.lincoln.edu/token',
  jwksUrl: tokens.jwksUrl,
  ...overrides,
});

export function ltiWorld() {
  const world = makeWorld();
  const ltiPlatforms = new InMemoryLtiPlatformRepository();
  return {
    ...world,
    ltiPlatforms,
    ltiNonces: new InMemoryLtiNonceRepository(),
    ltiUserLinks: new InMemoryLtiUserLinkRepository(ltiPlatforms),
    ltiCourses: new InMemoryLtiCourseRepository(ltiPlatforms),
    ltiTokenVerifier: new FakeLtiTokenVerifier([tokens], () => world.clock.now()),
    toolSigner: new FakeToolKeyStore(),
  };
}
export type LtiWorld = ReturnType<typeof ltiWorld>;

export const asAdmin = (user: User): User => ({ ...user, role: 'school_admin' });
export const forbidden = { ok: false, error: { code: 'forbidden' } };

/** A school whose admin registered Lincoln Canvas, and a teacher there with an account. */
export async function registered(world: LtiWorld) {
  const { user } = await signedUp(world);
  const admin = asAdmin(user);
  await world.users.save(admin);
  const platform = valueOf(
    await new RegisterLtiPlatform(world).execute({ actor: admin, details: details() }),
  );
  const teacher = colleagueOf(admin);
  await world.users.save(teacher);
  return { admin, teacher, platform };
}

/** Starts a login the way the course system would, as the browser's cookie keeps it. */
export async function startLogin(world: LtiWorld): Promise<SavedLtiLogin> {
  const started = valueOf(
    await new StartLtiLogin(world).execute({
      issuer,
      loginHint: 'hint-1',
      targetLinkUri: 'https://app.teacherhub.test/api/lti/launch',
      ltiMessageHint: null,
      clientId: 'client-1',
      deploymentId: null,
    }),
  );
  return {
    state: started.state,
    nonce: started.nonce,
    platformId: started.platformId,
    schoolId: started.schoolId,
  };
}

export const launchClaims = (
  world: LtiWorld,
  saved: SavedLtiLogin,
  overrides: Record<string, unknown> = {},
) => {
  const seconds = Math.floor(world.clock.now().getTime() / 1000);
  return {
    iss: issuer,
    aud: 'client-1',
    sub: 'canvas-user-1',
    iat: seconds,
    exp: seconds + 600,
    nonce: saved.nonce,
    [ltiClaim.version]: '1.3.0',
    [ltiClaim.messageType]: 'LtiResourceLinkRequest',
    [ltiClaim.deploymentId]: 'dep-1',
    [ltiClaim.roles]: [ltiRoles.instructor],
    [ltiClaim.launchPresentation]: { locale: 'es' },
    ...overrides,
  };
};

export async function launch(
  world: LtiWorld,
  overrides: Record<string, unknown> = {},
  savedOverrides: Partial<SavedLtiLogin> = {},
) {
  const saved = await startLogin(world);
  const idToken = await tokens.sign(launchClaims(world, saved, overrides));
  return new CompleteLtiLaunch(world).execute({
    idToken,
    state: saved.state,
    saved: { ...saved, ...savedOverrides },
  });
}

export const deepLinkingReturnUrl = 'https://lms.lincoln.edu/courses/9/deep_linking_response';

/** A deep linking request from Lincoln Canvas, as its teacher's "Add content" sends it. */
export const deepLinking = (settings: Record<string, unknown> = {}) => ({
  [ltiClaim.messageType]: 'LtiDeepLinkingRequest',
  [ltiClaim.deploymentId]: 'dep-2',
  [ltiClaim.deepLinkingSettings]: {
    deep_link_return_url: deepLinkingReturnUrl,
    accept_types: ['ltiResourceLink'],
    accept_multiple: true,
    data: 'canvas-data-1',
    ...settings,
  },
});
