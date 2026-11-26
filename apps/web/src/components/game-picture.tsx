'use client';

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import type { GamePicture } from '@thp/domain';
import type { createTranslator, MessageKey } from '@thp/i18n';
import { fitWithin, maxPictureEdge, pictureAccept } from '../server/picture-size.ts';

type T = ReturnType<typeof createTranslator>;

/**
 * How whoever is looking opens a game's pictures: from an address (the teacher's account, a
 * student link, a course-system pass) or with a live session's ticket.
 */
export type PictureAccess =
  { readonly src: (id: string) => string | null } | { readonly ticket: string };

/** What a server page can hand a player: the address pictures sit under, or a live ticket. */
export type PicturePlace = { readonly base: string } | { readonly ticket: string };

export const accessFor = (place: PicturePlace): PictureAccess =>
  'ticket' in place ? place : { src: (id) => `${place.base}/${encodeURIComponent(id)}` };

const PictureSource = createContext<PictureAccess>({ src: () => null });

export function PictureSourceProvider(props: {
  readonly access: PictureAccess;
  readonly children: ReactNode;
}) {
  return <PictureSource.Provider value={props.access}>{props.children}</PictureSource.Provider>;
}

/**
 * Pictures this browser just uploaded, shown from the file itself until the game is saved.
 * Kept outside React so a form sent back with an error still shows them.
 */
const uploadedHere = new Map<string, string>();

export const uploadedPicture = (id: string): string | null => uploadedHere.get(id) ?? null;

/** An item's picture with its description for screen readers; nothing when it has none. */
export function GamePictureImage(props: {
  readonly picture: GamePicture | null | undefined;
  readonly src?: string | null;
}) {
  const access = useContext(PictureSource);
  const { picture } = props;
  if (picture === null || picture === undefined) return null;
  if (props.src === undefined && 'ticket' in access) {
    return <LivePicture picture={picture} ticket={access.ticket} />;
  }
  const src = props.src !== undefined ? props.src : 'src' in access ? access.src(picture.id) : null;
  if (src === null) return null;
  return <img className="game-picture" src={src} alt={picture.alt} />;
}

/** A live picture: the host's or player's ticket goes in a header, never in the address. */
export function LivePicture(props: {
  readonly picture: GamePicture | null;
  readonly ticket: string;
}) {
  const { picture, ticket } = props;
  const [src, setSrc] = useState<string | null>(null);
  const id = picture?.id ?? null;
  useEffect(() => {
    if (id === null) return undefined;
    let url: string | null = null;
    let stopped = false;
    void fetch(`/api/live/pictures/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${ticket}` },
    })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (blob === null || stopped) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      setSrc(null);
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [id, ticket]);
  return <GamePictureImage picture={picture} src={src} />;
}

/**
 * Shrinks a big photo to fit a screen before it is sent (phone photos are often several MB).
 * Drawing it fresh also leaves its camera details behind; the server removes them as well.
 * GIFs are sent as they are, so they keep moving.
 */
async function shrunk(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitWithin(bitmap.width, bitmap.height, maxPictureEdge);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, 0.85);
    });
    return blob ?? file;
  } catch {
    return file;
  }
}

type UploadState =
  { readonly kind: 'idle' | 'sending' } | { readonly kind: 'failed'; readonly key: MessageKey };

const failureKeys: Readonly<Record<string, MessageKey>> = {
  too_large: 'games.pictureTooLarge',
  invalid_format: 'games.pictureInvalid',
};

async function send(file: File): Promise<{ id: string; preview: string } | { error: string }> {
  const blob = await shrunk(file);
  const form = new FormData();
  form.append('picture', blob, file.name);
  const response = await fetch('/api/game-pictures', { method: 'POST', body: form }).catch(
    () => null,
  );
  const body = (await response?.json().catch(() => null)) as {
    id?: unknown;
    error?: unknown;
  } | null;
  if (response?.ok === true && typeof body?.id === 'string') {
    return { id: body.id, preview: URL.createObjectURL(blob) };
  }
  return { error: typeof body?.error === 'string' ? body.error : 'failed' };
}

/** A card's picture: add one, describe it (required), or take it off. */
export function PictureField(props: {
  readonly t: T;
  readonly picture: GamePicture | undefined;
  readonly onChange: (picture: GamePicture | undefined) => void;
}) {
  const { t, picture, onChange } = props;
  const id = useId();
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  if (picture !== undefined) {
    return (
      <div className="builder-picture">
        <GamePictureImage picture={picture} />
        <div className="field">
          <label htmlFor={`${id}-alt`}>{t('games.pictureAlt')}</label>
          <input
            id={`${id}-alt`}
            type="text"
            value={picture.alt}
            maxLength={200}
            aria-describedby={`${id}-alt-hint`}
            onChange={(event) => {
              onChange({ ...picture, alt: event.target.value });
            }}
          />
          <p id={`${id}-alt-hint`} className="hint">
            {t('games.pictureAltHint')}
          </p>
        </div>
        <p>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => {
              onChange(undefined);
            }}
          >
            {t('games.pictureRemove')}
          </button>
        </p>
      </div>
    );
  }
  return (
    <div className="field builder-picture">
      <label htmlFor={`${id}-file`}>{t('games.pictureAdd')}</label>
      <input
        id={`${id}-file`}
        type="file"
        accept={pictureAccept}
        aria-describedby={`${id}-file-hint`}
        disabled={upload.kind === 'sending'}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file === undefined) return;
          setUpload({ kind: 'sending' });
          void send(file).then((sent) => {
            if ('error' in sent) {
              setUpload({ kind: 'failed', key: failureKeys[sent.error] ?? 'games.pictureFailed' });
              return;
            }
            uploadedHere.set(sent.id, sent.preview);
            setUpload({ kind: 'idle' });
            onChange({ id: sent.id, alt: '' });
          });
        }}
      />
      <p id={`${id}-file-hint`} className="hint">
        {t('games.pictureHint')}
      </p>
      <p aria-live="polite" className="muted">
        {upload.kind === 'sending' ? t('games.pictureSending') : null}
      </p>
      {upload.kind === 'failed' ? (
        <p role="alert" className="field-error">
          {t(upload.key)}
        </p>
      ) : null}
    </div>
  );
}
