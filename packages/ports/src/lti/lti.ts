import type {
  ClassId,
  LtiCourse,
  LtiNewLineItem,
  LtiPlacedItem,
  LtiPlacement,
  LtiScore,
  LtiPlatform,
  LtiPlatformId,
  Result,
  SchoolId,
  StudentId,
  UserId,
} from '@thp/domain';

/** The course systems schools have registered for LTI launches. */
export interface LtiPlatformRepository {
  save(platform: LtiPlatform): Promise<void>;
  findById(schoolId: SchoolId, id: LtiPlatformId): Promise<LtiPlatform | null>;
  /**
   * The platforms with this issuer (and client ID, when given), in any school: a launch names
   * its course system before anyone is known. An issuer and client ID pair is registered once.
   */
  findByIssuer(issuer: string, clientId: string | null): Promise<readonly LtiPlatform[]>;
  listForSchool(schoolId: SchoolId): Promise<readonly LtiPlatform[]>;
  delete(schoolId: SchoolId, id: LtiPlatformId): Promise<void>;
}

/** Launch nonces already used, so a launch token works once. */
export interface LtiNonceRepository {
  /** Marks the nonce used until it expires; false when it was already used. */
  claim(nonce: string, expiresAt: Date): Promise<boolean>;
}

/** Which TeacherHubPro account a course system's user is, once they have linked them. */
export interface LtiUserLinkRepository {
  /** Links the course system's user to the account, replacing any earlier link. */
  link(platformId: LtiPlatformId, subject: string, userId: UserId, linkedAt: Date): Promise<void>;
  findUserId(platformId: LtiPlatformId, subject: string): Promise<UserId | null>;
}

export interface LtiTokenCheck {
  readonly jwksUrl: string;
  readonly issuer: string;
  readonly audience: string;
}

/**
 * Checks a launch token's signature against the course system's public keys, and its issuer,
 * audience and expiry; the domain checks the rest of its claims.
 */
export interface LtiTokenVerifier {
  verify(idToken: string, check: LtiTokenCheck): Promise<Result<unknown, 'invalid_token'>>;
}

/** One public key in a JSON Web Key Set. */
export interface PublicJwk {
  readonly kty: string;
  readonly kid: string;
  readonly alg: string;
  readonly use: string;
  readonly [member: string]: string;
}

/** TeacherHubPro's own signing keys, published for course systems; made on first use. */
export interface ToolKeyStore {
  publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }>;
}

/** TeacherHubPro's own signed requests to a course system (its OAuth client assertion). */
export interface ToolJwtSigner {
  /** An RS256 token of these claims, signed with the tool's current key and naming its `kid`. */
  sign(claims: Readonly<Record<string, unknown>>): Promise<string>;
}

/** The courses each teacher has opened TeacherHubPro from. */
export interface LtiCourseRepository {
  /** Remembers the course for its teacher, updating its title, list address and last launch. */
  save(course: LtiCourse): Promise<void>;
  /** The teacher's courses, most recently opened first. */
  listForTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LtiCourse[]>;
  find(
    schoolId: SchoolId,
    teacherId: UserId,
    platformId: LtiPlatformId,
    contextId: string,
  ): Promise<LtiCourse | null>;
}

/** A roster student and the course system user they are. */
export interface LtiStudentLink {
  readonly subject: string;
  readonly studentId: StudentId;
}

/**
 * Which roster student each course system learner is, class by class: a learner imported into
 * two classes is a student in each. Only an id is kept, never an email or picture.
 */
export interface LtiStudentLinkRepository {
  /** The links of this class's students to this course system's users. */
  listForClass(
    schoolId: SchoolId,
    classId: ClassId,
    platformId: LtiPlatformId,
  ): Promise<readonly LtiStudentLink[]>;
  /** Links a student of this school to the course system user, replacing the student's link. */
  link(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    subject: string,
    studentId: StudentId,
  ): Promise<void>;
  /** The students of this school a course system user is (one per class they were imported to). */
  listStudentIds(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    subject: string,
  ): Promise<readonly StudentId[]>;
}

/** The assignments and games teachers placed in courses (deep linking). */
export interface LtiPlacementRepository {
  /** Remembers the placement; placing the same item in the same course again keeps one. */
  save(placement: LtiPlacement): Promise<void>;
  /** The courses this school's item is placed in, oldest first. */
  listForItem(schoolId: SchoolId, item: LtiPlacedItem): Promise<readonly LtiPlacement[]>;
  find(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    contextId: string,
    item: LtiPlacedItem,
  ): Promise<LtiPlacement | null>;
}

/** Why a course system would not hand over a class list. */
export type LtiMembershipsError = 'not_allowed' | 'unavailable';

/** Reads a course's class list over Names and Role Provisioning Services. */
export interface LtiMembershipsClient {
  /** Every member on every page of the list, as the course system sent them (unchecked). */
  listMembers(
    platform: LtiPlatform,
    membershipsUrl: string,
  ): Promise<Result<readonly unknown[], LtiMembershipsError>>;
}

/** Why a course system's gradebook would not take grades. */
export type LtiGradesError = 'not_allowed' | 'unavailable';

/** What to send to one course's gradebook: the assignment's column and its scores. */
export interface LtiGradesRequest {
  /** The course's line items (gradebook columns). */
  readonly lineItemsUrl: string;
  /** The column for the assignment, found by its `resourceId` or made when missing. */
  readonly lineItem: LtiNewLineItem;
  readonly scores: readonly LtiScore[];
}

export interface LtiGradesSent {
  readonly sent: number;
  /** Scores the course system refused or could not take (the others went in). */
  readonly failed: number;
}

/** Sends scores to a course's gradebook over Assignment and Grade Services. */
export interface LtiGradesClient {
  sendScores(
    platform: LtiPlatform,
    request: LtiGradesRequest,
  ): Promise<Result<LtiGradesSent, LtiGradesError>>;
}
