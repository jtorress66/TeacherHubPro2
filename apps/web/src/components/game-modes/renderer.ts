import type { RoundView } from '@thp/domain';
import type { Locale } from '@thp/i18n';

/** What every mode's player gets: its round, and where to send the answers when done. */
export interface RendererProps<V extends RoundView> {
  readonly view: V;
  readonly locale: Locale;
  readonly onDone: (answers: unknown) => void;
}
