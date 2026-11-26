import type { GameId } from '@thp/domain';
import { getAppContainer } from '../../../../../../../../container.ts';
import { pictureResponse } from '../../../../../../../../server/picture-response.ts';

export const dynamic = 'force-dynamic';

/** A picture in a game shared with the student's class, opened with their link; else a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; gameId: string; pictureId: string }> },
): Promise<Response> {
  const { token, gameId, pictureId } = await params;
  const file = await getAppContainer().getStudentGamePicture.execute({
    token,
    gameId: gameId as GameId,
    pictureId,
  });
  return pictureResponse(file.ok ? file.value : null);
}
