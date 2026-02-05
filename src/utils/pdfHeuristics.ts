/**
 * Very light PDF text-layer heuristic:
 * Look for markers commonly present when there’s selectable text.
 * Not perfect, but good enough for v0 to split parsed vs pending_ocr.
 */
export function pdfLikelyHasTextLayer(buf: Buffer) {
  // Scan only the first ~1–2 MB for performance
  const head = buf.subarray(0, Math.min(buf.length, 2 * 1024 * 1024));
  const s = head.toString("latin1");
  // Markers often present when text is embedded:
  return /\/Font|\/ToUnicode|BT[\s\S]+?ET/.test(s);
}