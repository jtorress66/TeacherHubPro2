import type { GoogleDeck, MarkdownBlock } from '@thp/domain';

/** Writes a presentation as a PowerPoint file (.pptx): text and theme colours, no layout rules. */
export interface PresentationFileWriter {
  pptx(deck: GoogleDeck): Promise<Uint8Array>;
}

/** Writes formatted text (headings, lists, tables, blanks) as a Word document (.docx). */
export interface DocumentFileWriter {
  docx(document: {
    readonly title: string;
    readonly blocks: readonly MarkdownBlock[];
  }): Promise<Uint8Array>;
}
