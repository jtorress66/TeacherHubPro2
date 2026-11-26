import type { GameId } from '@thp/domain';
import { getAppContainer } from '../../../../../../../container.ts';
import { pictureResponse } from '../../../../../../../server/picture-response.ts';
import { passFor } from '../../../../../../_lib/lti-pass.ts';

export const dynamic = 'force-dynamic';

/** A picture in the game a student opened from their course system, with that game's pass. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string; pictureId: string }> },
): Promise<Response> {
  const { gameId, pictureId } = await params;
  const id = gameId as GameId;
  const file = await getAppContainer().getStudentGamePicture.execute({
    pass: await passFor({ kind: 'game', id }),
    gameId: id,
    pictureId,
  });
  return pictureResponse(file.ok ? file.value : null);
}
