import { err, ok, type GoogleDeck, type MarkdownBlock, type Result } from '@thp/domain';
import type {
  CanvaAuthorization,
  CanvaDesigns,
  CanvaError,
  CanvaFile,
  DocumentFileWriter,
  PresentationFileWriter,
} from '@thp/ports';

/**
 * Canva's sign-in, as Canva behaves: a code works only with its PKCE verifier, and each refresh
 * token works once, replaced by the next one.
 */
export class FakeCanvaAuthorization implements CanvaAuthorization {
  static readonly code = 'canva-code';
  static readonly verifier = 'canva-verifier';
  static readonly accessToken = 'canva-access';
  private issued = 0;
  private readonly live = new Set<string>();

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL('https://canva.test/api/oauth/authorize');
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 's256');
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  private next(): string {
    this.issued += 1;
    const token = `canva-refresh-${String(this.issued)}`;
    this.live.add(token);
    return token;
  }

  exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<Result<{ readonly refreshToken: string }, CanvaError>> {
    const valid =
      input.code === FakeCanvaAuthorization.code &&
      input.codeVerifier === FakeCanvaAuthorization.verifier;
    return Promise.resolve(
      valid ? ok({ refreshToken: this.next() }) : err({ code: 'unauthorized' }),
    );
  }

  refresh(
    refreshToken: string,
  ): Promise<Result<{ readonly accessToken: string; readonly refreshToken: string }, CanvaError>> {
    if (!this.live.delete(refreshToken)) return Promise.resolve(err({ code: 'unauthorized' }));
    return Promise.resolve(
      ok({ accessToken: FakeCanvaAuthorization.accessToken, refreshToken: this.next() }),
    );
  }
}

/** Canva imports, recorded; `failWith` makes the next import fail. */
export class FakeCanvaDesigns implements CanvaDesigns {
  readonly imports: CanvaFile[] = [];
  failWith: CanvaError['code'] | null = null;

  importFile(
    accessToken: string,
    file: CanvaFile,
  ): Promise<Result<{ readonly editUrl: string }, CanvaError>> {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return Promise.resolve(err({ code }));
    }
    if (accessToken !== FakeCanvaAuthorization.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.imports.push(file);
    return Promise.resolve(
      ok({ editUrl: `https://canva.test/design/D${String(this.imports.length)}/edit` }),
    );
  }
}

/** Office files as readable text, so tests can see what went in. */
export class FakeOfficeFiles implements PresentationFileWriter, DocumentFileWriter {
  readonly decks: GoogleDeck[] = [];
  readonly documents: { readonly title: string; readonly blocks: readonly MarkdownBlock[] }[] = [];

  pptx(deck: GoogleDeck): Promise<Uint8Array> {
    this.decks.push(deck);
    return Promise.resolve(new TextEncoder().encode(`pptx:${deck.name}`));
  }

  docx(document: {
    readonly title: string;
    readonly blocks: readonly MarkdownBlock[];
  }): Promise<Uint8Array> {
    this.documents.push(document);
    return Promise.resolve(new TextEncoder().encode(`docx:${document.title}`));
  }
}
