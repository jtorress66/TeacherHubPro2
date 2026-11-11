import PptxGenJS from 'pptxgenjs';
import type { GoogleDeck, GoogleSlide } from '@thp/domain';
import type { PresentationFileWriter } from '@thp/ports';

/** `#1d4ed8` as PowerPoint writes colours: six hex digits, no hash. */
const hex = (colour: string) => colour.replace(/^#/, '');

function addSlide(pptx: PptxGenJS, deck: GoogleDeck, slide: GoogleSlide): void {
  const page = pptx.addSlide();
  const color = hex(deck.colours.text);
  page.background = { color: hex(deck.colours.background) };
  const title = slide.layout === 'title';
  if (slide.title !== '') {
    page.addText(slide.title, {
      x: 0.5,
      y: title ? 1.6 : 0.3,
      w: 9,
      h: title ? 1.4 : 1,
      fontSize: title ? 40 : 30,
      bold: true,
      color,
      align: title ? 'center' : 'left',
      valign: title ? 'bottom' : 'middle',
    });
  }
  if (slide.body.length > 0) {
    page.addText(
      slide.body.map((line) => ({
        text: line.text,
        options: { bullet: line.bullet, breakLine: true },
      })),
      {
        x: 0.5,
        y: title ? 3.1 : 1.4,
        w: 9,
        h: title ? 1.6 : 3.9,
        fontSize: title ? 22 : 18,
        color,
        align: title ? 'center' : 'left',
        valign: 'top',
      },
    );
  }
}

/** PowerPoint files through pptxgenjs: each slide's title, text, bullets and theme colours. */
export class PptxPresentationWriter implements PresentationFileWriter {
  async pptx(deck: GoogleDeck): Promise<Uint8Array> {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = deck.name;
    const slides: readonly GoogleSlide[] =
      deck.slides.length > 0 ? deck.slides : [{ layout: 'title', title: deck.name, body: [] }];
    for (const slide of slides) addSlide(pptx, deck, slide);
    const written = await pptx.write({ outputType: 'uint8array' });
    if (!(written instanceof Uint8Array)) throw new Error('pptxgenjs did not return bytes');
    return written;
  }
}
