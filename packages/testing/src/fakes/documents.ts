import type { ReportCardPage, ReportCardRenderer } from '@thp/ports';

/**
 * A stand-in PDF: a valid header and one page object per card, with the card's text kept
 * readable so tests can check what was asked for. Not a PDF any viewer would open.
 */
export class FakeReportCardRenderer implements ReportCardRenderer {
  readonly rendered: (readonly ReportCardPage[])[] = [];

  render(pages: readonly [ReportCardPage, ...ReportCardPage[]]): Promise<Uint8Array> {
    this.rendered.push(pages);
    const body = pages
      .map(
        (page, index) => `${String(index + 1)} 0 obj << /Type /Page >> % ${JSON.stringify(page)}`,
      )
      .join('\n');
    return Promise.resolve(new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF`));
  }
}
