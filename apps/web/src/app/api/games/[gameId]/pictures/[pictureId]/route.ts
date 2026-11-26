import type { GameId } from '@thp/domain';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../../container.ts';
import { pictureResponse } from '../../../../../../server/picture-response.ts';
import { requireUser } from '../../../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** A picture in the teacher's game (or one their school's admin manages); anything else is a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string; pictureId: string }> },
): Promise<Response> {
  const { user } = await requireUser(defaultLocale, { needsAccess: false });
  const { gameId, pictureId } = await params;
  const file = await getAppContainer().getGamePicture.execute({
    actor: user,
    gameId: gameId as GameId,
    pictureId,
  });
  return pictureResponse(file.ok ? file.value : null);
}
