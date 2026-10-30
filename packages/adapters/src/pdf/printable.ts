/** Text the standard PDF fonts can print: Windows-1252 (ASCII, Latin-1 and a few extras). */
const printableText = /^[\u0020-\u007e\u00a0-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+$/u;

const graphemes = new Intl.Segmenter();

/** A character the font lacks, without its accents (ễ → e), or "?" when that does not help. */
const fallback = (character: string): string => {
  const base = character.normalize('NFD').replace(/\p{M}/gu, '');
  return printableText.test(base) ? base : '?';
};

/** Text the standard fonts can draw: whitespace becomes a space, other gaps are filled in. */
export function printable(text: string): string {
  return Array.from(graphemes.segment(text.replace(/\s/g, ' ')), ({ segment }) =>
    printableText.test(segment) ? segment : fallback(segment),
  ).join('');
}
