'use client';

import { useEffect, useRef, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { useJobStatus } from './job-progress.tsx';

interface SpeechReply {
  readonly status?: 'ready' | 'queued';
  readonly clips?: readonly string[];
  readonly jobId?: string;
  readonly error?: string;
}

type Phase = 'idle' | 'loading' | 'playing' | 'failed';

/**
 * Reads text aloud. The audio is made by a job the first time and cached for the school; the
 * parts then play one after another.
 */
export function ListenButton(props: {
  readonly locale: Locale;
  /** The language the text is written in, for the voice. */
  readonly language: string;
  readonly text: string;
}) {
  const t = createTranslator(props.locale);
  const [phase, setPhase] = useState<Phase>('idle');
  const [clips, setClips] = useState<readonly string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [part, setPart] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const job = useJobStatus(jobId, props.locale, 1000);

  useEffect(() => {
    if (job?.status === 'completed') {
      setJobId(null);
      setPhase('playing');
    }
    if (job?.status === 'failed') {
      setJobId(null);
      setPhase('failed');
      setMessage(t('speech.failed'));
    }
  }, [job, t]);

  useEffect(() => {
    if (phase === 'playing') audio.current?.play().catch(() => undefined);
  }, [phase, part]);

  useEffect(() => {
    setPhase('idle');
    setClips([]);
    setPart(0);
  }, [props.text]);

  const start = async () => {
    setPhase('loading');
    setMessage(null);
    setPart(0);
    const response = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: props.text, language: props.language, locale: props.locale }),
    }).catch(() => null);
    const reply = (await response?.json().catch(() => null)) as SpeechReply | null;
    if (!response?.ok || reply?.clips === undefined) {
      setPhase('failed');
      setMessage(reply?.error ?? t('speech.failed'));
      return;
    }
    setClips(reply.clips);
    if (reply.status === 'queued' && reply.jobId !== undefined) setJobId(reply.jobId);
    else setPhase('playing');
  };

  const stop = () => {
    audio.current?.pause();
    setPhase('idle');
  };

  const next = () => {
    if (part + 1 < clips.length) setPart(part + 1);
    else setPhase('idle');
  };

  const current = clips[part];
  return (
    <span className="listen">
      {phase === 'playing' ? (
        <button type="button" className="button secondary" onClick={stop}>
          {t('speech.stop')}
        </button>
      ) : (
        <button
          type="button"
          className="button secondary"
          onClick={() => void start()}
          disabled={phase === 'loading'}
        >
          {phase === 'loading' ? t('speech.loading') : t('speech.listen')}
        </button>
      )}
      {phase === 'playing' && current !== undefined ? (
        <audio
          ref={audio}
          src={`/api/speech/${current}`}
          onEnded={next}
          data-testid="speech-audio"
        />
      ) : null}
      {message === null ? null : (
        <span role="alert" className="field-error">
          {message}
        </span>
      )}
    </span>
  );
}
