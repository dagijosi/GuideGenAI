import { Link } from 'react-router-dom';
import {
  FolderOpen, FileText, Image, Plus, ArrowRight,
  TrendingUp, Zap, CheckCircle2, AlertCircle, Play,
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useProjects, useStartProject } from '../hooks/useProjects';
import { useStats } from '../hooks/useStats';
import { formatDate } from '../lib/utils';
import { useState } from 'react';
import CreateProjectModal from '../components/projects/CreateProjectModal';

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: stats } = useStats();
  const { mutate: start, isPending: isStarting, variables: startingId } = useStartProject();
  const [showCreate, setShowCreate] = useState(false);

  const recentProjects  = projects.slice(0, 6);
  const runningProjects = projects.filter(p => p.status === 'running');
  const completedCount  = stats?.completedProjects ?? 0;
  const totalCount      = stats?.totalProjects ?? 0;
  const successRate     = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const statCards = [
    { label: 'Total Projects',    value: stats?.totalProjects   ?? 0, icon: FolderOpen, color: 'text-brand-600',  bg: 'bg-brand-50',  border: 'border-brand-100' },
    { label: 'Pages Documented',  value: stats?.totalPages      ?? 0, icon: FileText,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Screenshots',       value: stats?.totalScreenshots ?? 0, icon: Image,      color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100' },
    { label: 'Success Rate',      value: `${successRate}%`,           icon: TrendingUp,  color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100' },
  ];

  return (
    <div className='space-y-8'>
      {/* Welcome */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>Welcome back</h2>
          <p className='mt-0.5 text-sm text-gray-500'>
            {runningProjects.length > 0
              ? `${runningProjects.length} job${runningProjects.length > 1 ? 's' : ''} currently running`
              : 'All systems ready'}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className='h-4 w-4' /> New Project
        </Button>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {statCards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-2xl border ${border} bg-white p-5 shadow-sm`}>
            <div className={`mb-4 inline-flex rounded-xl p-2.5 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className='text-xs font-medium text-gray-500'>{label}</p>
            <p className='mt-0.5 text-3xl font-bold text-gray-900'>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        ))}
      </div>

      <div className='grid gap-6 lg:grid-cols-5'>
        {/* Active Jobs — takes 2/5 */}
        <div className='lg:col-span-2'>
          <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
            <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-semibold text-gray-900'>Active Jobs</span>
                {runningProjects.length > 0 && (
                  <span className='flex h-2 w-2 rounded-full bg-blue-500'>
                    <span className='h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75' />
                  </span>
                )}
              </div>
              <Link to='/jobs' className='flex items-center gap-1 text-xs text-brand-600 hover:underline'>
                View all <ArrowRight className='h-3 w-3' />
              </Link>
            </div>
            <div className='p-5'>
              {runningProjects.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100'>
                    <Zap className='h-6 w-6 text-gray-400' />
                  </div>
                  <p className='text-sm font-medium text-gray-500'>No active jobs</p>
                  <p className='mt-0.5 text-xs text-gray-400'>Start a project to begin</p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {runningProjects.map(p => (
                    <Link key={p.id} to={`/projects/${p.id}`}
                      className='block rounded-xl border border-blue-100 bg-blue-50 p-3 transition-all hover:border-blue-200 hover:shadow-sm'>
                      <div className='mb-2 flex items-center justify-between'>
                        <span className='text-sm font-medium text-gray-900 truncate max-w-[140px]'>{p.name}</span>
                        <span className='text-xs font-bold text-blue-600'>{p.progress}%</span>
                      </div>
                      <ProgressBar value={p.progress} showLabel={false} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Projects — takes 3/5 */}
        <div className='lg:col-span-3'>
          <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
            <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
              <span className='text-sm font-semibold text-gray-900'>Recent Projects</span>
              <Link to='/projects' className='flex items-center gap-1 text-xs text-brand-600 hover:underline'>
                View all <ArrowRight className='h-3 w-3' />
              </Link>
            </div>
            <div className='divide-y divide-gray-50'>
              {loadingProjects ? (
                <div className='space-y-3 p-5'>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className='flex items-center gap-3'>
                      <div className='h-8 w-8 animate-pulse rounded-lg bg-gray-200' />
                      <div className='flex-1 space-y-1.5'>
                        <div className='h-3 w-32 animate-pulse rounded bg-gray-200' />
                        <div className='h-2.5 w-48 animate-pulse rounded bg-gray-100' />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className='flex flex-col items-center py-10 text-center'>
                  <p className='mb-3 text-sm text-gray-400'>No projects yet</p>
                  <Button size='sm' onClick={() => setShowCreate(true)}>
                    <Plus className='h-4 w-4' /> Create First Project
                  </Button>
                </div>
              ) : (
                recentProjects.map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`}
                    className='flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50'>
                    {/* Status icon */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      p.status === 'completed' ? 'bg-green-100' :
                      p.status === 'failed'    ? 'bg-red-100' :
                      p.status === 'running'   ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {p.status === 'completed' && <CheckCircle2 className='h-4 w-4 text-green-600' />}
                      {p.status === 'failed'    && <AlertCircle  className='h-4 w-4 text-red-600' />}
                      {p.status === 'running'   && <Play className='h-4 w-4 text-blue-600' />}
                      {(p.status === 'idle' || p.status === 'paused') && <FolderOpen className='h-4 w-4 text-gray-500' />}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium text-gray-900'>{p.name}</p>
                      <p className='text-xs text-gray-400'>{formatDate(p.createdAt)} · {p.pageCount} pages</p>
                    </div>
                    <div className='flex shrink-0 items-center gap-2'>
                      <StatusBadge status={p.status} />
                      {(p.status === 'idle' || p.status === 'failed') && (
                        <button type='button'
                          onClick={e => { e.preventDefault(); start(p.id); }}
                          disabled={isStarting && startingId === p.id}
                          className='rounded-lg p-1.5 text-brand-500 hover:bg-brand-50 disabled:opacity-50'
                          title='Start'>
                          {isStarting && startingId === p.id
                            ? <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent' />
                            : <Play className='h-3.5 w-3.5' />}
                        </button>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
