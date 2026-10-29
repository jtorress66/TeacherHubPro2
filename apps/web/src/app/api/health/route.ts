export const dynamic = 'force-dynamic';

/** For deploy checks and CI: the web process is up. */
export function GET(): Response {
  return Response.json({ ok: true });
}
