import { err, ok, type GoogleDeck, type GoogleSlide, type Result } from '@thp/domain';
import type { ClassroomError, GoogleSlidesFiles } from '@thp/ports';
import { googleFailure } from './google-errors.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const api = 'https://slides.googleapis.com/v1/presentations';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** `#1d4ed8` as the Slides API's 0–1 colour channels. */
function rgb(hex: string) {
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return { red: channel(1), green: channel(3), blue: channel(5) };
}

/** Each layout's title and body placeholders in Google's predefined layouts. */
const layouts = {
  title: { predefined: 'TITLE', title: 'CENTERED_TITLE', body: 'SUBTITLE' },
  body: { predefined: 'TITLE_AND_BODY', title: 'TITLE', body: 'BODY' },
} as const;

/** Text into a placeholder, in the theme's text colour; nothing for empty text. */
function textRequests(objectId: string, text: string, colour: ReturnType<typeof rgb>): object[] {
  if (text === '') return [];
  return [
    { insertText: { objectId, text, insertionIndex: 0 } },
    {
      updateTextStyle: {
        objectId,
        textRange: { type: 'ALL' },
        style: { foregroundColor: { opaqueColor: { rgbColor: colour } } },
        fields: 'foregroundColor',
      },
    },
  ];
}

/** Bullets on each run of consecutive bullet lines, by character position. */
function bulletRequests(objectId: string, slide: GoogleSlide): object[] {
  const requests: object[] = [];
  let index = 0;
  let runStart: number | null = null;
  slide.body.forEach((line, i) => {
    const end = index + line.text.length;
    if (line.bullet && runStart === null) runStart = index;
    const runEnds = line.bullet && slide.body[i + 1]?.bullet !== true;
    if (runEnds && runStart !== null) {
      requests.push({
        createParagraphBullets: {
          objectId,
          textRange: { type: 'FIXED_RANGE', startIndex: runStart, endIndex: end },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
      runStart = null;
    }
    index = end + 1;
  });
  return requests;
}

function slideRequests(deck: GoogleDeck, slide: GoogleSlide, position: number): object[] {
  const id = `thp_slide_${String(position + 1)}`;
  const layout = layouts[slide.layout];
  const text = rgb(deck.colours.text);
  return [
    {
      createSlide: {
        objectId: id,
        insertionIndex: position,
        slideLayoutReference: { predefinedLayout: layout.predefined },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: layout.title, index: 0 }, objectId: `${id}_t` },
          { layoutPlaceholder: { type: layout.body, index: 0 }, objectId: `${id}_b` },
        ],
      },
    },
    {
      updatePageProperties: {
        objectId: id,
        pageProperties: {
          pageBackgroundFill: { solidFill: { color: { rgbColor: rgb(deck.colours.background) } } },
        },
        fields: 'pageBackgroundFill.solidFill.color',
      },
    },
    ...textRequests(`${id}_t`, slide.title, text),
    ...textRequests(`${id}_b`, slide.body.map((line) => line.text).join('\n'), text),
    ...bulletRequests(`${id}_b`, slide),
  ];
}

/** The blank first slide Google puts in every new deck. */
function blankSlides(created: unknown): string[] {
  const slides = isRecord(created) && Array.isArray(created.slides) ? created.slides : [];
  return slides
    .map((slide: unknown) => (isRecord(slide) ? slide.objectId : undefined))
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Google Slides through its official REST API with the teacher's access token: makes a deck
 * with the presentation's titles, text, bullets and theme colours. With `drive.file`, the app
 * can reach only decks it made.
 */
export class GoogleSlidesApi implements GoogleSlidesFiles {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private post(url: string, accessToken: string, body: object): Promise<Response> {
    return this.fetchFn(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async createPresentation(
    accessToken: string,
    deck: GoogleDeck,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    try {
      const response = await this.post(api, accessToken, { title: deck.name });
      if (!response.ok) return err(await googleFailure(response));
      const created: unknown = await response.json();
      const id = isRecord(created) ? created.presentationId : null;
      if (typeof id !== 'string') return err({ code: 'unavailable' });
      const blank = deck.slides.length === 0 ? [] : blankSlides(created);
      const requests = [
        ...deck.slides.flatMap((slide, position) => slideRequests(deck, slide, position)),
        ...blank.map((objectId) => ({ deleteObject: { objectId } })),
      ];
      if (requests.length > 0) {
        const updated = await this.post(
          `${api}/${encodeURIComponent(id)}:batchUpdate`,
          accessToken,
          { requests },
        );
        if (!updated.ok) return err(await googleFailure(updated));
      }
      return ok({
        id,
        url: `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/edit`,
      });
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
