import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export default function ProgressBar({ value, className, showLabel = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className='mb-1 flex justify-between text-xs text-gray-500'>
          <span>Progress</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
        <div
          className='h-full rounded-full bg-brand-500 transition-all duration-300'
          style={{ width: `${clamped}%` }}
          role='progressbar'
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
