/** A stable filename for the next saved source across uploads, URLs and inspiration. */
export function nextReferenceFilename(savedPages: number): string {
  if (!Number.isSafeInteger(savedPages) || savedPages < 0) throw new RangeError('Invalid reference count');
  return savedPages === 0 ? 'screenshot-full.jpg' : `page-${savedPages}.jpg`;
}

/** Older jobs may have gaps in attachment numbering; never reuse an existing name. */
export function nextAttachmentFilename(pages: ReadonlyArray<{ screenshotUrl: string }>): string {
  const used = new Set(pages.map((page) => page.screenshotUrl.split('?')[0].split('/').pop()));
  let index = pages.length;
  while (used.has(`private-page-${index}.jpg`)) index++;
  return `private-page-${index}.jpg`;
}
