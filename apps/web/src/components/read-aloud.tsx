'use client';

import { useEffect, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';

/**
 * Reads text aloud (a lesson, an assignment's instructions or one question) with the device's own
 * voice: free, and the text never leaves the device. Hidden where the browser has no speech.
 */
export function ReadAloud(props: {
  readonly locale: Locale;
  readonly language: string;
  readonly text: string;
  /** What is read, for screen readers when a page has several buttons, e.g. "question 2". */
  readonly context?: string;
}) {
  const t = createTranslator(props.locale);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;
  return (
    <button
      type="button"
      className="button secondary"
      aria-pressed={speaking}
      onClick={() => {
        const speech = window.speechSynthesis;
        if (speaking) {
          speech.cancel();
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(props.text);
        utterance.lang = props.language;
        utterance.onend = () => {
          setSpeaking(false);
        };
        speech.speak(utterance);
        setSpeaking(true);
      }}
    >
      {speaking ? t('learning.stop') : t('learning.listen')}
      {props.context === undefined ? null : (
        <span className="visually-hidden"> {props.context}</span>
      )}
    </button>
  );
}
