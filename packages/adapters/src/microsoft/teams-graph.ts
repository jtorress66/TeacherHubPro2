import { z } from 'zod';
import { err, ok, oneDriveFileName, type Result } from '@thp/domain';
import type {
  MicrosoftError,
  TeamsAssignmentRequest,
  TeamsAssignments,
  TeamsClass,
  TeamsClasses,
  TeamsResource,
  TeamsStudent,
} from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const graph = 'https://graph.microsoft.com/v1.0';
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** Graph follows at most this many pages of a list (a class rarely needs more than one). */
const maxPages = 20;

const page = <T extends z.ZodType>(item: T) =>
  z.object({ value: z.array(item), '@odata.nextLink': z.url().optional() });
const educationClass = z.object({ id: z.string().min(1), displayName: z.string().nullish() });
const educationUser = z.object({
  id: z.string().min(1),
  givenName: z.string().nullish(),
  surname: z.string().nullish(),
  displayName: z.string().nullish(),
});
const assignment = z.object({ id: z.string().min(1), webUrl: z.url().nullish() });
const resourcesFolder = z.object({ resourcesFolderUrl: z.string() });
const uploaded = z.object({ id: z.string().min(1) });

/** What Graph's answer means: expired access, a missing permission, not the teacher's, busy. */
const failure = (status: number): MicrosoftError => ({
  code:
    status === 401
      ? 'unauthorized'
      : status === 403
        ? 'insufficient_scope'
        : status === 404
          ? 'not_found'
          : status === 429 || status === 503
            ? 'throttled'
            : 'unavailable',
});

/** First and last name; when Microsoft has only a display name, its last word is the surname. */
function nameOf(user: z.infer<typeof educationUser>): TeamsStudent {
  const firstName = user.givenName?.trim() ?? '';
  const lastName = user.surname?.trim() ?? '';
  if (firstName !== '' || lastName !== '') return { firstName, lastName };
  const words = (user.displayName ?? '').trim().split(/\s+/u);
  const last = words.length > 1 ? (words.pop() ?? '') : '';
  return { firstName: words.join(' '), lastName: last };
}

/**
 * The resources folder Graph gives is a Graph address of a drive item; only such an address may
 * receive the teacher's token.
 */
const folderPattern = /^https:\/\/graph\.microsoft\.com\/v1\.0\/drives\/([^/]+)\/items\/[^/]+$/u;

/**
 * Microsoft Teams through Microsoft Graph's education API: classes and rosters (names only), and
 * assignments that are created as drafts, given their resource, then published (now, or at
 * `assignDateTime`). A draft whose resource or publishing fails is deleted.
 */
export class TeamsGraph implements TeamsClasses, TeamsAssignments {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private async call(
    accessToken: string,
    url: string,
    init: { method?: string; json?: unknown; body?: Uint8Array; contentType?: string } = {},
  ): Promise<Result<unknown, MicrosoftError>> {
    try {
      const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` };
      const contentType = init.json === undefined ? init.contentType : 'application/json';
      if (contentType !== undefined) headers['content-type'] = contentType;
      const response = await this.fetchFn(url, {
        method: init.method ?? 'GET',
        headers,
        ...(init.json === undefined ? {} : { body: JSON.stringify(init.json) }),
        // A copy on its own ArrayBuffer, which fetch accepts as a body everywhere.
        ...(init.body === undefined ? {} : { body: new Uint8Array(init.body) }),
      });
      if (!response.ok) return err(failure(response.status));
      return ok(response.status === 204 ? null : await response.json());
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  private async parsed<T extends z.ZodType>(
    schema: T,
    answer: Promise<Result<unknown, MicrosoftError>>,
  ): Promise<Result<z.infer<T>, MicrosoftError>> {
    const result = await answer;
    if (!result.ok) return result;
    const checked = schema.safeParse(result.value);
    return checked.success ? ok(checked.data) : err({ code: 'unavailable' });
  }

  /** Every page of a list, following `@odata.nextLink` (always a Graph address). */
  private async all<T extends z.ZodType>(
    accessToken: string,
    first: string,
    item: T,
  ): Promise<Result<z.infer<T>[], MicrosoftError>> {
    const schema = page(item);
    const items: z.infer<T>[] = [];
    let next: string | undefined = first;
    for (let count = 0; next !== undefined && count < maxPages; count += 1) {
      if (!next.startsWith(`${graph}/`)) return err({ code: 'unavailable' });
      const listed: Result<z.infer<typeof schema>, MicrosoftError> = await this.parsed(
        schema,
        this.call(accessToken, next),
      );
      if (!listed.ok) return listed;
      items.push(...listed.value.value);
      next = listed.value['@odata.nextLink'];
    }
    return ok(items);
  }

  async listClasses(accessToken: string): Promise<Result<readonly TeamsClass[], MicrosoftError>> {
    const classes = await this.all(
      accessToken,
      `${graph}/education/me/classes?$select=id,displayName`,
      educationClass,
    );
    if (!classes.ok) return classes;
    return ok(
      classes.value.map((c) => {
        const name = c.displayName?.trim() ?? '';
        return { id: c.id, name: name === '' ? c.id : name };
      }),
    );
  }

  /** Members minus teachers (a member's role can differ per class), first and last names only. */
  async listStudents(
    accessToken: string,
    classId: string,
  ): Promise<Result<readonly TeamsStudent[], MicrosoftError>> {
    const base = `${graph}/education/classes/${encodeURIComponent(classId)}`;
    const members = await this.all(
      accessToken,
      `${base}/members?$select=id,givenName,surname,displayName`,
      educationUser,
    );
    if (!members.ok) return members;
    const teachers = await this.all(accessToken, `${base}/teachers?$select=id`, educationUser);
    if (!teachers.ok) return teachers;
    const teacherIds = new Set(teachers.value.map((teacher) => teacher.id));
    return ok(members.value.filter((m) => !teacherIds.has(m.id)).map(nameOf));
  }

  async createAssignment(
    accessToken: string,
    classId: string,
    request: TeamsAssignmentRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, MicrosoftError>> {
    const base = `${graph}/education/classes/${encodeURIComponent(classId)}/assignments`;
    const draft = await this.parsed(
      assignment,
      this.call(accessToken, base, {
        method: 'POST',
        json: {
          displayName: request.title,
          instructions: { contentType: 'text', content: request.instructions },
          ...(request.dueAt === null ? {} : { dueDateTime: request.dueAt.toISOString() }),
          ...(request.assignAt === null ? {} : { assignDateTime: request.assignAt.toISOString() }),
          assignTo: { '@odata.type': '#microsoft.graph.educationAssignmentClassRecipient' },
          status: 'draft',
        },
      }),
    );
    if (!draft.ok) return draft;
    const at = `${base}/${encodeURIComponent(draft.value.id)}`;
    const finished = await this.finish(accessToken, at, request.resource);
    if (!finished.ok) {
      await this.call(accessToken, at, { method: 'DELETE' });
      return finished;
    }
    const url = finished.value ?? draft.value.webUrl;
    return url == null ? err({ code: 'unavailable' }) : ok({ id: draft.value.id, url });
  }

  /** Adds the resource and publishes; the published assignment's link, when Graph gives one. */
  private async finish(
    accessToken: string,
    at: string,
    resource: TeamsResource,
  ): Promise<Result<string | null, MicrosoftError>> {
    const attached =
      resource.kind === 'link'
        ? await this.call(accessToken, `${at}/resources`, {
            method: 'POST',
            json: {
              distributeForStudentWork: false,
              resource: {
                '@odata.type': '#microsoft.graph.educationLinkResource',
                displayName: resource.name,
                link: resource.url,
              },
            },
          })
        : await this.attachWordCopy(accessToken, at, resource);
    if (!attached.ok) return attached;
    const published = await this.parsed(
      assignment,
      this.call(accessToken, `${at}/publish`, { method: 'POST' }),
    );
    return published.ok ? ok(published.value.webUrl ?? null) : published;
  }

  /**
   * A Word document each student gets their own copy of: the assignment's resources folder is
   * set up, the file is put in it, and it is added with `distributeForStudentWork`.
   */
  private async attachWordCopy(
    accessToken: string,
    at: string,
    resource: Extract<TeamsResource, { kind: 'wordCopy' }>,
  ): Promise<Result<unknown, MicrosoftError>> {
    const folder = await this.parsed(
      resourcesFolder,
      this.call(accessToken, `${at}/setUpResourcesFolder`, { method: 'POST', json: {} }),
    );
    if (!folder.ok) return folder;
    const match = folderPattern.exec(folder.value.resourcesFolderUrl);
    if (match === null) return err({ code: 'unavailable' });
    const name = oneDriveFileName(resource.fileName.replace(/\.docx$/iu, ''), 'docx');
    const file = await this.parsed(
      uploaded,
      this.call(
        accessToken,
        `${folder.value.resourcesFolderUrl}:/${encodeURIComponent(name)}:/content`,
        { method: 'PUT', body: resource.bytes, contentType: docxType },
      ),
    );
    if (!file.ok) return file;
    return this.call(accessToken, `${at}/resources`, {
      method: 'POST',
      json: {
        distributeForStudentWork: true,
        resource: {
          '@odata.type': '#microsoft.graph.educationWordResource',
          displayName: name,
          fileUrl: `${graph}/drives/${match[1] ?? ''}/items/${file.value.id}`,
        },
      },
    });
  }
}
