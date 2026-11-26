import { maxPictureBytes } from '@thp/domain';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../container.ts';
import { requireUser } from '../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

const refused = (error: string, status = 422) => Response.json({ error }, { status, headers });

/** Stores a picture for a game item and returns its id; the builder then names it in an item. */
export async function POST(request: Request): Promise<Response> {
  const { user } = await requireUser(defaultLocale, { needsAccess: false });
  const form = await request.formData().catch(() => null);
  const file = form?.get('picture');
  if (!(file instanceof File)) return refused('required', 400);
  if (file.size > maxPictureBytes) return refused('too_large');
  const uploaded = await getAppContainer().uploadGamePicture.execute({
    actor: user,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!uploaded.ok) {
    const code = 'field' in uploaded.error ? uploaded.error.code : 'failed';
    return refused(code === 'too_large' || code === 'invalid_format' ? code : 'failed');
  }
  return Response.json({ id: uploaded.value.id }, { headers });
}
