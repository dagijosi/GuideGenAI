import { cn } from '../../lib/utils';
import type { ProjectStatus } from '../../types';

interface BadgeProps {
  status: ProjectStatus;
  className?: string;
}

// Classes must be complete strings for Tailwind v4 static scanning
export default function StatusBadge({ status, className }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

  if (status === 'running') {
    return (
      <span className={cn(base, 'bg-blue-100 text-blue-700 animate-pulse', className)}>
        Running
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className={cn(base, 'bg-green-100 text-green-700', className)}>
        Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className={cn(base, 'bg-red-100 text-red-700', className)}>
        Failed
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className={cn(base, 'bg-yellow-100 text-yellow-700', className)}>
        Paused
      </span>
    );
  }
  // idle
  return (
    <span className={cn(base, 'bg-gray-100 text-gray-600', className)}>
      Idle
    </span>
  );
}
