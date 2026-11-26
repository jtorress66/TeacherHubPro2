import { getAppContainer } from '../../../../../container.ts';
import { pictureResponse } from '../../../../../server/picture-response.ts';

export const dynamic = 'force-dynamic';

/**
 * A picture in the game a live session plays, for the host and players. Their ticket comes in
 * the Authorization header (never the address, which servers may log); anything else is a 404.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pictureId: string }> },
): Promise<Response> {
  const { pictureId } = await params;
  const ticket = /^Bearer (.+)$/u.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
  const file = await getAppContainer().getLiveGamePicture.execute({ ticket, pictureId });
  return pictureResponse(file.ok ? file.value : null);
}
