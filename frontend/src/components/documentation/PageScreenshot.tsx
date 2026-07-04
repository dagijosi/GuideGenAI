import { ImageIcon } from 'lucide-react';
import { getScreenshotUrl } from '../../lib/screenshots';

interface PageScreenshotProps {
  projectId: string;
  screenshotPath?: string;
  alt: string;
  caption?: string;
  className?: string;
}

export default function PageScreenshot({
  projectId,
  screenshotPath,
  alt,
  caption,
  className = '',
}: PageScreenshotProps) {
  const src = getScreenshotUrl(projectId, screenshotPath);
  if (!src) return null;

  return (
    <figure className={`overflow-hidden rounded-xl border border-gray-200 bg-gray-50 ${className}`}>
      <img
        src={src}
        alt={alt}
        className='w-full object-cover object-top max-h-80'
        loading='lazy'
      />
      {caption && (
        <figcaption className='border-t border-gray-100 bg-white px-4 py-2 text-xs text-gray-500'>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function PageScreenshotPlaceholder() {
  return (
    <div className='flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-12'>
      <div className='text-center'>
        <ImageIcon className='mx-auto h-8 w-8 text-gray-300' />
        <p className='mt-2 text-xs text-gray-400'>No screenshot available</p>
      </div>
    </div>
  );
}
