import {
  captionFileLocale,
  captionHeaders,
  introCaptionsVtt,
} from '../../../../server/video-captions.ts';

/** The homepage intro video's captions in one language, such as `/api/video-captions/es.vtt`. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const locale = captionFileLocale((await params).file);
  if (locale === null) return new Response(null, { status: 404 });
  return new Response(introCaptionsVtt(locale), { headers: captionHeaders });
}
