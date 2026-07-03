/**
 * Converts AI-generated markdown-like text into clean readable plain text.
 * Strips # headings, **, *, bullet points and returns structured segments
 * that can be rendered as proper React elements.
 */

export type TextSegment =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'blank' };

export function parseMarkdown(raw: string): TextSegment[] {
  if (!raw || !raw.trim()) return [];

  const lines = raw.split('\n');
  const segments: TextSegment[] = [];
  let bulletBuffer: string[] = [];
  let numberedBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      segments.push({ type: 'bullet', items: [...bulletBuffer] });
      bulletBuffer = [];
    }
  };
  const flushNumbered = () => {
    if (numberedBuffer.length > 0) {
      segments.push({ type: 'numbered', items: [...numberedBuffer] });
      numberedBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Blank line
    if (!line.trim()) {
      flushBullets();
      flushNumbered();
      continue;
    }

    // Heading: ### ## #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushBullets();
      flushNumbered();
      segments.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: stripInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    // Bullet: - * •
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)/);
    if (bulletMatch) {
      flushNumbered();
      bulletBuffer.push(stripInlineMarkdown(bulletMatch[1]));
      continue;
    }

    // Numbered list: 1. 2. etc
    const numberedMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      flushBullets();
      numberedBuffer.push(stripInlineMarkdown(numberedMatch[1]));
      continue;
    }

    // Normal paragraph
    flushBullets();
    flushNumbered();
    const text = stripInlineMarkdown(line.trim());
    if (text) {
      segments.push({ type: 'paragraph', text });
    }
  }

  flushBullets();
  flushNumbered();

  return segments;
}

/**
 * Strips inline markdown: **bold**, *italic*, `code`, [text](url) → text
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/_(.+?)_/g, '$1')          // _italic_
    .replace(/`(.+?)`/g, '$1')          // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [text](url)
    .replace(/~~(.+?)~~/g, '$1')        // ~~strikethrough~~
    .trim();
}

/**
 * Quick utility: strip all markdown and return plain string.
 */
export function toPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
