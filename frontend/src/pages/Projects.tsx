import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Globe, FileText, Image, Play, Pencil, Trash2,
  LayoutGrid, List, RotateCcw, CheckCircle2, Clock, AlertCircle,
  Square, PauseCircle, Loader2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import EditProjectModal from '../components/projects/EditProjectModal';
import CreateProjectModal from '../components/projects/CreateProjectModal';
import {
  useProjects,
  useStartProject,
  useDeleteProject,
  useStopProject,
} from '../hooks/useProjects';
import { formatDate } from '../lib/utils';
import type { Project } from '../types';

type View = 'grid' | 'list';
type Filter = 'all' | 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'paused';

function StatusIcon({ status }: { status: Project['status'] }) {
  if (status === 'completed') return <CheckCircle2 className='h-4 w-4 text-green-500' />;
  if (status === 'failed')    return <AlertCircle  className='h-4 w-4 text-red-500' />;
  if (status === 'running')   return <RotateCcw    className='h-4 w-4 animate-spin text-blue-500' />;
  if (status === 'stopping')  return <Square       className='h-4 w-4 text-orange-500' />;
  if (status === 'paused')    return <PauseCircle  className='h-4 w-4 text-yellow-500' />;
  return <Clock className='h-4 w-4 text-gray-400' />;
}

function GridCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const navigate = useNavigate();
  const { mutate: start, isPending: isStarting } = useStartProject();
  const { mutate: remove, isPending: isDeleting } = useDeleteProject();
  const { mutate: stop, isPending: isStopping } = useStopProject();

  return (
    <div
      className='group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-brand-200 hover:shadow-md cursor-pointer'
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {/* Top colour strip by status */}
      {project.status === 'completed' && <div className='h-1 w-full bg-green-400' />}
      {project.status === 'running' && <div className='h-1 w-full bg-blue-400 animate-pulse' />}
      {project.status === 'failed' && <div className='h-1 w-full bg-red-400' />}
      {project.status === 'paused' && <div className='h-1 w-full bg-yellow-400' />}
      {project.status === 'idle' && <div className='h-1 w-full bg-gray-200' />}

      <div className='flex flex-1 flex-col p-5'>
        {/* Header */}
        <div className='mb-3 flex items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-semibold text-gray-900 group-hover:text-brand-600'>
              {project.name}
            </p>
            <a
              href={project.url}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400 hover:text-brand-600'
            >
              <Globe className='h-3 w-3 shrink-0' />
              {project.url}
            </a>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Progress */}
        {project.status === 'running' && (
          <ProgressBar value={project.progress} className='mb-3' />
        )}

        {/* Stats */}
        <div className='mb-4 flex gap-4 text-xs text-gray-500'>
          <span className='flex items-center gap-1'>
            <FileText className='h-3.5 w-3.5' />
            {project.pageCount} pages
          </span>
          <span className='flex items-center gap-1'>
            <Image className='h-3.5 w-3.5' />
            {project.screenshotCount} screenshots
          </span>
        </div>

        {/* Footer */}
        <div className='mt-auto flex items-center justify-between'>
          <span className='text-xs text-gray-400'>{formatDate(project.createdAt)}</span>
          <div className='flex gap-1' onClick={(e) => e.stopPropagation()}>
            {project.status !== 'running' && (
              <button
                type='button'
                onClick={onEdit}
                className='rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                aria-label='Edit'
              >
                <Pencil className='h-3.5 w-3.5' />
              </button>
            )}
            {/* Stop while running */}
            {project.status === 'running' && (
              <button
                type='button'
                onClick={() => stop(project.id)}
                disabled={isStopping}
                className='rounded-lg p-1.5 text-yellow-500 hover:bg-yellow-50 disabled:opacity-50'
                aria-label='Stop'
                title='Stop — saves progress'
              >
                <Square className='h-3.5 w-3.5' />
              </button>
            )}
            {/* Stopping indicator */}
            {project.status === 'stopping' && (
              <span className='rounded-lg p-1.5 text-orange-400' title='Stopping…'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              </span>
            )}
            {/* Start / Resume */}
            {(project.status === 'idle' || project.status === 'failed' || project.status === 'paused') && (
              <button
                type='button'
                onClick={() => start(project.id)}
                disabled={isStarting}
                className='rounded-lg p-1.5 text-brand-500 hover:bg-brand-50'
                aria-label={project.status === 'paused' ? 'Resume' : 'Start'}
                title={project.status === 'paused' ? 'Resume' : 'Start'}
              >
                <Play className='h-3.5 w-3.5' />
              </button>
            )}
            <button
              type='button'
              onClick={() => remove(project.id)}
              disabled={isDeleting}
              className='rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500'
              aria-label='Delete'
            >
              <Trash2 className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListRow({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const navigate = useNavigate();
  const { mutate: start, isPending: isStarting } = useStartProject();
  const { mutate: remove, isPending: isDeleting } = useDeleteProject();
  const { mutate: stop, isPending: isStopping } = useStopProject();

  return (
    <div
      className='group flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-0 hover:bg-gray-50 cursor-pointer'
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <StatusIcon status={project.status} />

      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600'>
          {project.name}
        </p>
        <p className='truncate text-xs text-gray-400'>{project.url}</p>
        {project.status === 'running' && (
          <ProgressBar value={project.progress} showLabel={false} className='mt-1.5 max-w-xs' />
        )}
      </div>

      <StatusBadge status={project.status} />

      <div className='hidden items-center gap-4 text-xs text-gray-500 sm:flex'>
        <span className='flex items-center gap-1 w-20'>
          <FileText className='h-3.5 w-3.5' />
          {project.pageCount} pages
        </span>
        <span className='flex items-center gap-1 w-28'>
          <Image className='h-3.5 w-3.5' />
          {project.screenshotCount} screenshots
        </span>
      </div>

      <span className='hidden w-28 text-right text-xs text-gray-400 lg:block'>
        {new Date(project.createdAt).toLocaleDateString()}
      </span>

      <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
        {project.status !== 'running' && (
          <button
            type='button'
            onClick={onEdit}
            className='rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            aria-label='Edit'
          >
            <Pencil className='h-3.5 w-3.5' />
          </button>
        )}
        {/* Stop while running */}
        {project.status === 'running' && (
          <button
            type='button'
            onClick={() => stop(project.id)}
            disabled={isStopping}
            className='rounded-lg p-1.5 text-yellow-500 hover:bg-yellow-50 disabled:opacity-50'
            aria-label='Stop'
            title='Stop — saves progress'
          >
            <Square className='h-3.5 w-3.5' />
          </button>
        )}
        {/* Stopping indicator */}
        {project.status === 'stopping' && (
          <span className='rounded-lg p-1.5 text-orange-400' title='Stopping…'>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          </span>
        )}
        {/* Start / Resume */}
        {(project.status === 'idle' || project.status === 'failed' || project.status === 'paused') && (
          <button
            type='button'
            onClick={() => start(project.id)}
            disabled={isStarting}
            className='rounded-lg p-1.5 text-brand-500 hover:bg-brand-50'
            aria-label={project.status === 'paused' ? 'Resume' : 'Start'}
            title={project.status === 'paused' ? 'Resume' : 'Start'}
          >
            <Play className='h-3.5 w-3.5' />
          </button>
        )}
        <button
          type='button'
          onClick={() => remove(project.id)}
          disabled={isDeleting}
          className='rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500'
          aria-label='Delete'
        >
          <Trash2 className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  );
}

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('grid');

  const counts: Record<Filter, number> = {
    all:      projects.length,
    idle:     projects.filter(p => p.status === 'idle').length,
    running:  projects.filter(p => p.status === 'running').length,
    stopping: projects.filter(p => p.status === 'stopping').length,
    completed:projects.filter(p => p.status === 'completed').length,
    failed:   projects.filter(p => p.status === 'failed').length,
    paused:   projects.filter(p => p.status === 'paused').length,
  };

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.url.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const filterBtnBase = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';
  const filterBtnActive = `${filterBtnBase} bg-brand-500 text-white`;
  const filterBtnInactive = `${filterBtnBase} text-gray-500 hover:bg-gray-100`;

  return (
    <div className='space-y-5'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-3'>
        {/* Search */}
        <div className='relative flex-1' style={{ minWidth: '200px', maxWidth: '320px' }}>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
          <input
            type='search'
            placeholder='Search projects...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
            aria-label='Search projects'
          />
        </div>

        {/* Filter pills */}
        <div className='flex gap-1.5 rounded-xl border border-gray-200 bg-white p-1'>
          {(['all', 'running', 'completed', 'failed', 'paused', 'idle'] as Filter[]).map((f) => (
            counts[f] > 0 || f === 'all' ? (
              <button
                key={f}
                type='button'
                onClick={() => setFilter(f)}
                className={filter === f ? filterBtnActive : filterBtnInactive}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {counts[f] > 0 && (
                  <span className='ml-1 opacity-70'>({counts[f]})</span>
                )}
              </button>
            ) : null
          ))}
        </div>

        {/* View toggle */}
        <div className='flex rounded-lg border border-gray-200 bg-white p-0.5'>
          <button
            type='button'
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 transition-colors ${view === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label='Grid view'
          >
            <LayoutGrid className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={() => setView('list')}
            className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label='List view'
          >
            <List className='h-4 w-4' />
          </button>
        </div>

        <div className='ml-auto'>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className='h-4 w-4' />
            New Project
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[...Array(6)].map((_, i) => (
            <div key={i} className='h-44 animate-pulse rounded-xl bg-gray-100' />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center'>
          <Globe className='mb-3 h-12 w-12 text-gray-300' />
          <p className='text-base font-medium text-gray-500'>
            {search || filter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
          </p>
          <p className='mt-1 text-sm text-gray-400'>
            {search || filter !== 'all'
              ? 'Try clearing the search or filter'
              : 'Create your first project to get started'}
          </p>
          {!search && filter === 'all' && (
            <Button className='mt-5' onClick={() => setShowCreate(true)}>
              <Plus className='h-4 w-4' />
              Create First Project
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filtered.map((project) => (
            <GridCard
              key={project.id}
              project={project}
              onEdit={() => setEditProject(project)}
            />
          ))}
        </div>
      ) : (
        <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
          {/* List header */}
          <div className='hidden items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-400 sm:flex'>
            <span className='w-4' />
            <span className='flex-1'>Project</span>
            <span className='w-24'>Status</span>
            <span className='w-20'>Pages</span>
            <span className='w-28'>Screenshots</span>
            <span className='hidden w-28 lg:block'>Created</span>
            <span className='w-24 text-right'>Actions</span>
          </div>
          {filtered.map((project) => (
            <ListRow
              key={project.id}
              project={project}
              onEdit={() => setEditProject(project)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {editProject && (
        <EditProjectModal project={editProject} onClose={() => setEditProject(null)} />
      )}
    </div>
  );
}
