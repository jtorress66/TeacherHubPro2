/**
 * A Content-Disposition header that downloads a file under its own name: a plain ASCII
 * fallback (accents dropped, anything else replaced by "_") and the exact name in UTF-8.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\]/g, '_');
  // RFC 5987 also reserves the characters encodeURIComponent leaves as they are.
  const utf8 = encodeURIComponent(fileName).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
