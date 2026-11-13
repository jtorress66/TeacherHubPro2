import type { LtiPlatformId, SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

/**
 * A school's course system (Canvas, Schoology, Moodle, Brightspace…) registered for LTI 1.3
 * launches: the values its IT team copies from the course system's developer key or tool setup.
 */
export interface LtiPlatform {
  readonly id: LtiPlatformId;
  readonly schoolId: SchoolId;
  readonly name: string;
  /** The course system's issuer (`iss`), as it puts it in every launch. */
  readonly issuer: string;
  /** The client ID the course system gave TeacherHubPro (the token's audience). */
  readonly clientId: string;
  /** The deployments allowed to launch; at least one. */
  readonly deploymentIds: readonly string[];
  /** Where the browser is sent to sign the teacher in (OIDC authorization endpoint). */
  readonly authLoginUrl: string;
  /** The course system's OAuth token endpoint, for its services. */
  readonly authTokenUrl: string;
  /** The course system's public keys, which sign its launches. */
  readonly jwksUrl: string;
  readonly createdAt: Date;
}

export interface LtiPlatformInput {
  readonly schoolId: SchoolId;
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  /** A list, or the text of one with commas between the IDs. */
  readonly deploymentIds: string | readonly string[];
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly jwksUrl: string;
}

const maxIdLength = 255;
const maxIssuerLength = 500;
const maxUrlLength = 2000;
const maxDeployments = 50;
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

/** An https address; plain http only for this computer (development and tests). */
function endpoint(field: string, value: string): Result<string, ValidationError> {
  const text = requiredText(field, value, maxUrlLength);
  if (!text.ok) return text;
  if (!URL.canParse(text.value)) return invalid(field, 'invalid_format');
  const url = new URL(text.value);
  const secure =
    url.protocol === 'https:' || (url.protocol === 'http:' && localHosts.has(url.hostname));
  return secure ? ok(text.value) : invalid(field, 'invalid_format');
}

function deployments(value: string | readonly string[]): Result<string[], ValidationError> {
  const list = typeof value === 'string' ? value.split(',') : value;
  const ids = [...new Set(list.map((item) => item.trim()).filter((item) => item !== ''))];
  if (ids.length === 0) return invalid('deploymentIds', 'required');
  if (ids.length > maxDeployments || ids.some((item) => item.length > maxIdLength)) {
    return invalid('deploymentIds', 'too_long');
  }
  return ok(ids);
}

/** A course system as an admin typed it: trimmed and checked, field by field. */
export function createLtiPlatform(
  input: LtiPlatformInput,
  id: LtiPlatformId,
  now: Date,
): Result<LtiPlatform, ValidationError> {
  const name = requiredText('name', input.name);
  if (!name.ok) return name;
  const issuer = requiredText('issuer', input.issuer, maxIssuerLength);
  if (!issuer.ok) return issuer;
  const clientId = requiredText('clientId', input.clientId, maxIdLength);
  if (!clientId.ok) return clientId;
  const deploymentIds = deployments(input.deploymentIds);
  if (!deploymentIds.ok) return deploymentIds;
  const authLoginUrl = endpoint('authLoginUrl', input.authLoginUrl);
  if (!authLoginUrl.ok) return authLoginUrl;
  const authTokenUrl = endpoint('authTokenUrl', input.authTokenUrl);
  if (!authTokenUrl.ok) return authTokenUrl;
  const jwksUrl = endpoint('jwksUrl', input.jwksUrl);
  if (!jwksUrl.ok) return jwksUrl;
  return ok({
    id,
    schoolId: input.schoolId,
    name: name.value,
    issuer: issuer.value,
    clientId: clientId.value,
    deploymentIds: deploymentIds.value,
    authLoginUrl: authLoginUrl.value,
    authTokenUrl: authTokenUrl.value,
    jwksUrl: jwksUrl.value,
    createdAt: now,
  });
}
