import { getAppContainer } from '../../container.ts';
import { llmsText } from '../../server/site-facts.ts';

export const dynamic = 'force-dynamic';

/** A plain-text summary of the app for AI assistants (the llms.txt convention). */
export function GET(): Response {
  return new Response(llmsText(getAppContainer().appUrl), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
