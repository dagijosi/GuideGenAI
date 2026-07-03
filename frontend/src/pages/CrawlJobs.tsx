import { Activity } from 'lucide-react';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { Card } from '../components/ui/Card';
import { useProjects } from '../hooks/useProjects';
import { formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function CrawlJobs() {
  const { data: projects = [], isLoading } = useProjects();

  const activeJobs = projects.filter((p) => p.status === 'running' || p.status === 'idle');
  const completedJobs = projects.filter(
    (p) => p.status === 'completed' || p.status === 'failed',
  );

  return (
    <div className='space-y-6'>
      <Card>
        <div className='mb-4 flex items-center gap-2'>
          <Activity className='h-5 w-5 text-brand-500' />
          <h2 className='text-base font-semibold text-gray-900'>Active Jobs</h2>
        </div>
        {isLoading ? (
          <div className='h-20 animate-pulse rounded bg-gray-100' />
        ) : activeJobs.length === 0 ? (
          <p className='text-sm text-gray-400'>No active jobs</p>
        ) : (
          <div className='space-y-4'>
            {activeJobs.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className='block'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-900'>{p.name}</span>
                  <StatusBadge status={p.status} />
                </div>
                {p.status === 'running' && (
                  <ProgressBar value={p.progress} className='mt-2' />
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className='mb-4 text-base font-semibold text-gray-900'>Job History</h2>
        {completedJobs.length === 0 ? (
          <p className='text-sm text-gray-400'>No completed jobs</p>
        ) : (
          <div className='divide-y divide-gray-100'>
            {completedJobs.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className='flex items-center justify-between py-3 hover:bg-gray-50'
              >
                <div>
                  <p className='text-sm font-medium text-gray-900'>{p.name}</p>
                  <p className='text-xs text-gray-400'>{formatDate(p.updatedAt)}</p>
                </div>
                <div className='flex items-center gap-3 text-xs text-gray-500'>
                  <span>{p.pageCount} pages</span>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
