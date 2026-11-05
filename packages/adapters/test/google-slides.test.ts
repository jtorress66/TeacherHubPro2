import { describe, expect, it } from 'vitest';
import type { GoogleDeck } from '@thp/domain';
import { googleSlidesContract } from '@thp/testing';
import { GoogleSlidesApi } from '../src/google/google-slides.ts';
import { LocalSlides } from '../src/google/local-slides.ts';
import { localClassroomFixture } from '../src/google/local-classroom.ts';

/** The Slides API: create a deck (with Google's blank first slide), then one batch update. */
function slidesApi(accessToken: string, status = 200) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    await Promise.resolve();
    const url = input instanceof Request ? input.url : input.toString();
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${accessToken}`) {
      return Response.json({ error: { code: 401, status: 'UNAUTHENTICATED' } }, { status: 401 });
    }
    if (status !== 200) {
      return Response.json(
        { error: { code: status, details: [{ reason: 'SERVICE_DISABLED' }] } },
        { status },
      );
    }
    calls.push({ url, body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') });
    return url.endsWith('/presentations')
      ? Response.json({ presentationId: 'deck-1', slides: [{ objectId: 'p' }] })
      : Response.json({ presentationId: 'deck-1', replies: [] });
  };
  return { fetchFn, calls };
}

const deck: GoogleDeck = {
  name: 'Volcanoes',
  colours: { background: '#1d4ed8', text: '#ffffff' },
  slides: [
    {
      layout: 'title',
      title: '🌋 Volcanoes',
      body: [{ text: 'Mountains of fire', bullet: false }],
    },
    {
      layout: 'body',
      title: 'How they form',
      body: [
        { text: 'Under the crust', bullet: false },
        { text: 'Heat', bullet: true },
        { text: 'Pressure', bullet: true },
      ],
    },
    { layout: 'body', title: '', body: [] },
  ],
};

googleSlidesContract(
  'GoogleSlidesApi',
  () => new GoogleSlidesApi(slidesApi('ya29.recorded').fetchFn),
  'ya29.recorded',
);
googleSlidesContract('LocalSlides', () => new LocalSlides(), localClassroomFixture.accessToken);

describe('GoogleSlidesApi', () => {
  it('creates the deck, adds each slide with its text and colours, and removes the blank one', async () => {
    const api = slidesApi('t');
    expect(await new GoogleSlidesApi(api.fetchFn).createPresentation('t', deck)).toEqual({
      ok: true,
      value: { id: 'deck-1', url: 'https://docs.google.com/presentation/d/deck-1/edit' },
    });
    expect(api.calls[0]).toEqual({
      url: 'https://slides.googleapis.com/v1/presentations',
      body: { title: 'Volcanoes' },
    });
    expect(api.calls[1]?.url).toBe(
      'https://slides.googleapis.com/v1/presentations/deck-1:batchUpdate',
    );
    const { requests } = api.calls[1]?.body as { requests: Record<string, unknown>[] };
    const blue = { red: 29 / 255, green: 78 / 255, blue: 216 / 255 };
    const white = { red: 1, green: 1, blue: 1 };
    expect(requests).toEqual([
      {
        createSlide: {
          objectId: 'thp_slide_1',
          insertionIndex: 0,
          slideLayoutReference: { predefinedLayout: 'TITLE' },
          placeholderIdMappings: [
            { layoutPlaceholder: { type: 'CENTERED_TITLE', index: 0 }, objectId: 'thp_slide_1_t' },
            { layoutPlaceholder: { type: 'SUBTITLE', index: 0 }, objectId: 'thp_slide_1_b' },
          ],
        },
      },
      {
        updatePageProperties: {
          objectId: 'thp_slide_1',
          pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: blue } } } },
          fields: 'pageBackgroundFill.solidFill.color',
        },
      },
      { insertText: { objectId: 'thp_slide_1_t', text: '🌋 Volcanoes', insertionIndex: 0 } },
      {
        updateTextStyle: {
          objectId: 'thp_slide_1_t',
          textRange: { type: 'ALL' },
          style: { foregroundColor: { opaqueColor: { rgbColor: white } } },
          fields: 'foregroundColor',
        },
      },
      { insertText: { objectId: 'thp_slide_1_b', text: 'Mountains of fire', insertionIndex: 0 } },
      {
        updateTextStyle: {
          objectId: 'thp_slide_1_b',
          textRange: { type: 'ALL' },
          style: { foregroundColor: { opaqueColor: { rgbColor: white } } },
          fields: 'foregroundColor',
        },
      },
      {
        createSlide: {
          objectId: 'thp_slide_2',
          insertionIndex: 1,
          slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
          placeholderIdMappings: [
            { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: 'thp_slide_2_t' },
            { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: 'thp_slide_2_b' },
          ],
        },
      },
      {
        updatePageProperties: {
          objectId: 'thp_slide_2',
          pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: blue } } } },
          fields: 'pageBackgroundFill.solidFill.color',
        },
      },
      { insertText: { objectId: 'thp_slide_2_t', text: 'How they form', insertionIndex: 0 } },
      {
        updateTextStyle: {
          objectId: 'thp_slide_2_t',
          textRange: { type: 'ALL' },
          style: { foregroundColor: { opaqueColor: { rgbColor: white } } },
          fields: 'foregroundColor',
        },
      },
      {
        insertText: {
          objectId: 'thp_slide_2_b',
          text: 'Under the crust\nHeat\nPressure',
          insertionIndex: 0,
        },
      },
      {
        updateTextStyle: {
          objectId: 'thp_slide_2_b',
          textRange: { type: 'ALL' },
          style: { foregroundColor: { opaqueColor: { rgbColor: white } } },
          fields: 'foregroundColor',
        },
      },
      {
        createParagraphBullets: {
          objectId: 'thp_slide_2_b',
          textRange: { type: 'FIXED_RANGE', startIndex: 16, endIndex: 29 },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
      {
        createSlide: {
          objectId: 'thp_slide_3',
          insertionIndex: 2,
          slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
          placeholderIdMappings: [
            { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: 'thp_slide_3_t' },
            { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: 'thp_slide_3_b' },
          ],
        },
      },
      {
        updatePageProperties: {
          objectId: 'thp_slide_3',
          pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: blue } } } },
          fields: 'pageBackgroundFill.solidFill.color',
        },
      },
      { deleteObject: { objectId: 'p' } },
    ]);
  });

  it('reports a turned-off Slides API, and an unreachable Google', async () => {
    expect(
      await new GoogleSlidesApi(slidesApi('t', 403).fetchFn).createPresentation('t', deck),
    ).toMatchObject({ ok: false, error: { code: 'api_disabled' } });
    const offline = () => Promise.reject(new Error('offline'));
    expect(await new GoogleSlidesApi(offline).createPresentation('t', deck)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});
