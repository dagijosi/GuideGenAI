import { Activity, Square, Play, Clock, CheckCircle2, AlertCircle, PauseCircle, FileText } from 'lucide-react';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useProjects, useStopProject, useStartProject } from '../hooks/useProjects';
import { formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function CrawlJobs() {
  const { data: projects = [], isLoading } = useProjects();
  const { mutate: stop,  isPending: isStopping,  variables: stoppingId  } = useStopProject();
  const { mutate: start, isPending: isStarting,  variables: startingId  } = useStartProject();

  const activeJobs    = projects.filter(p => ['running', 'idle', 'paused'].includes(p.status));
  const completedJobs = projects.filter(p => ['completed', 'failed'].includes(p.status));

  if (isLoading) {
    return (
      <div className='space-y-4 animate-pulse'>
        <div className='h-48 rounded-2xl bg-gray-100' />
        <div className='h-64 rounded-2xl bg-gray-100' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>

      {/* Active Jobs */}
      <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
        <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50'>
              <Activity className='h-4 w-4 text-blue-600' />
            </div>
            <span className='font-semibold text-gray-900'>Active Jobs</span>
            {activeJobs.filter(p => p.status === 'running').length > 0 && (
              <span className='flex h-2 w-2 rounded-full bg-blue-500'>
                <span className='h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75' />
              </span>
            )}
          </div>
          <span className='rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600'>
            {activeJobs.length}
          </span>
        </div>

        {activeJobs.length === 0 ? (
          <div className='flex flex-col items-center py-12 text-center'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100'>
              <Clock className='h-6 w-6 text-gray-400' />
            </div>
            <p className='text-sm font-medium text-gray-500'>No active jobs</p>
            <p className='mt-0.5 text-xs text-gray-400'>Go to Projects to start a new crawl</p>
          </div>
        ) : (
          <div className='divide-y divide-gray-50'>
            {activeJobs.map(p => (
              <div key={p.id} className='px-5 py-4'>
                <div className='flex items-center gap-4'>
                  {/* Status icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    p.status === 'running' ? 'bg-blue-100' :
                    p.status === 'paused'  ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    {p.status === 'running' && <Activity className='h-4 w-4 text-blue-600' />}
                    {p.status === 'paused'  && <PauseCircle className='h-4 w-4 text-amber-600' />}
                    {p.status === 'idle'    && <Clock className='h-4 w-4 text-gray-500' />}
                  </div>

                  {/* Info */}
                  <div className='min-w-0 flex-1'>
                    <Link to={`/projects/${p.id}`}
                      className='block truncate text-sm font-semibold text-gray-900 hover:text-brand-600'>
                      {p.name}
                    </Link>
                    <p className='text-xs text-gray-400 truncate'>{p.url}</p>
                    {p.status === 'running' && (
                      <div className='mt-2'>
                        <div className='flex items-center justify-between mb-1'>
                          <span className='text-xs text-gray-500'>Progress</span>
                          <span className='text-xs font-bold text-blue-600'>{p.progress}%</span>
                        </div>
                        <ProgressBar value={p.progress} showLabel={false} />
                      </div>
                    )}
                    {p.status === 'paused' && p.pageCount > 0 && (
                      <p className='mt-1 text-xs text-amber-600'>{p.pageCount} pages saved</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className='flex shrink-0 items-center gap-2'>
                    <StatusBadge status={p.status} />
                    {p.status === 'running' && (
                      <button type='button'
                        onClick={() => stop(p.id)}
                        disabled={isStopping && stoppingId === p.id}
                        className='inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors'
                        title='Stop — saves progress'>
                        <Square className='h-3 w-3' />
                        Stop
                      </button>
                    )}
                    {p.status === 'paused' && (
                      <button type='button'
                        onClick={() => start(p.id)}
                        disabled={isStarting && startingId === p.id}
                        className='inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition-colors'>
                        <Play className='h-3 w-3' />
                        Resume
                      </button>
                    )}
                    {p.status === 'idle' && (
                      <button type='button'
                        onClick={() => start(p.id)}
                        disabled={isStarting && startingId === p.id}
                        className='inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition-colors'>
                        <Play className='h-3 w-3' />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
        <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
          <span className='font-semibold text-gray-900'>Job History</span>
          <span className='rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600'>
            {completedJobs.length}
          </span>
        </div>

        {completedJobs.length === 0 ? (
          <div className='flex flex-col items-center py-12 text-center'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100'>
              <FileText className='h-6 w-6 text-gray-400' />
            </div>
            <p className='text-sm font-medium text-gray-500'>No completed jobs yet</p>
          </div>
        ) : (
          <div className='divide-y divide-gray-50'>
            {completedJobs.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className='flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50'>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  p.status === 'completed' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {p.status === 'completed'
                    ? <CheckCircle2 className='h-4 w-4 text-green-600' />
                    : <AlertCircle  className='h-4 w-4 text-red-600' />}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-semibold text-gray-900'>{p.name}</p>
                  <p className='text-xs text-gray-400'>{formatDate(p.updatedAt)}</p>
                </div>
                <div className='flex shrink-0 items-center gap-3 text-xs text-gray-500'>
                  <span className='hidden sm:block'>{p.pageCount} pages</span>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
