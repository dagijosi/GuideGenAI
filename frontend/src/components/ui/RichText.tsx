import { parseMarkdown } from '../../lib/formatText';

interface RichTextProps {
  content: string;
  className?: string;
}

/**
 * Renders AI-generated markdown-like text as clean, styled HTML.
 * No raw # or * characters ever visible to the user.
 */
export default function RichText({ content, className = '' }: RichTextProps) {
  const segments = parseMarkdown(content);

  if (segments.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'heading') {
          if (seg.level === 1) {
            return (
              <h2 key={i} className='text-lg font-bold text-gray-900 pt-2'>
                {seg.text}
              </h2>
            );
          }
          if (seg.level === 2) {
            return (
              <h3 key={i} className='text-base font-semibold text-gray-800 pt-1'>
                {seg.text}
              </h3>
            );
          }
          return (
            <h4 key={i} className='text-sm font-semibold text-gray-700'>
              {seg.text}
            </h4>
          );
        }

        if (seg.type === 'paragraph') {
          return (
            <p key={i} className='text-sm leading-relaxed text-gray-700'>
              {seg.text}
            </p>
          );
        }

        if (seg.type === 'bullet') {
          return (
            <ul key={i} className='space-y-1 pl-1'>
              {seg.items.map((item, j) => (
                <li key={j} className='flex items-start gap-2 text-sm text-gray-700'>
                  <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400' />
                  <span className='leading-relaxed'>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (seg.type === 'numbered') {
          return (
            <ol key={i} className='space-y-1 pl-1'>
              {seg.items.map((item, j) => (
                <li key={j} className='flex items-start gap-2.5 text-sm text-gray-700'>
                  <span className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600'>
                    {j + 1}
                  </span>
                  <span className='leading-relaxed'>{item}</span>
                </li>
              ))}
            </ol>
          );
        }

        return null;
      })}
    </div>
  );
}
