import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Play,
  Globe,
  FileText,
  Image,
  AlertCircle,
  CheckCircle,
  Clock,
  GitBranch,
  ChevronRight,
  ArrowLeft,
  Download,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useProject, useStartProject, useResetProject } from '../hooks/useProjects';
import { useProgress } from '../hooks/useProgress';
import { formatDate } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectFile } from '../hooks/useFiles';
import EditProjectModal from '../components/projects/EditProjectModal';

interface DocSummary {
  pageCount: number;
  generatedAt: string;
}

const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: project, isLoading } = useProject(id!);
  const { mutate: start, isPending: isStarting } = useStartProject();
  const { mutate: reset, isPending: isResetting } = useResetProject();
  const { events, latest } = useProgress(project?.status === 'running' ? id! : null);

  const { data: docSummary } = useQuery<DocSummary | null>({
    queryKey: ['doc-summary', id],
    queryFn: () =>
      api
        .get<DocSummary>(`/v1/documentation/${id}/summary`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: project?.status === 'completed',
  });

  const { data: screenshots = [] } = useQuery<ProjectFile[]>({
    queryKey: ['screenshots', id],
    queryFn: () =>
      api
        .get<ProjectFile[]>(`/v1/files/${id}/screenshots`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: project?.status === 'completed' || project?.status === 'failed',
  });

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='h-8 w-40 animate-pulse rounded-lg bg-gray-100' />
        <div className='h-28 animate-pulse rounded-xl bg-gray-100' />
        <div className='grid grid-cols-4 gap-4'>
          {[...Array(4)].map((_, i) => (
            <div key={i} className='h-24 animate-pulse rounded-xl bg-gray-100' />
          ))}
        </div>
      </div>
    );
  }

  if (!project) return <p className='text-gray-500'>Project not found</p>;

  const docPageCount = docSummary?.pageCount ?? project.pageCount;
  const canEdit = project.status !== 'running';
  const canReset = project.status === 'completed' || project.status === 'failed';
  const canStart = project.status === 'idle' || project.status === 'failed';

  return (
    <div className='space-y-6'>
      {/* Back nav */}
      <Link
        to='/projects'
        className='inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700'
      >
        <ArrowLeft className='h-4 w-4' />
        Back to Projects
      </Link>

      {/* Header card */}
      <Card>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-3'>
              <h2 className='text-xl font-bold text-gray-900'>{project.name}</h2>
              <StatusBadge status={project.status} />
            </div>
            <a
              href={project.url}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline'
            >
              <Globe className='h-4 w-4' />
              {project.url}
            </a>
            <p className='mt-1 text-xs text-gray-400'>
              Created {formatDate(project.createdAt)}
              {project.status === 'completed' && docSummary &&
                ` · Last run ${formatDate(project.updatedAt)}`}
            </p>
          </div>

          {/* Action buttons */}
          <div className='flex flex-wrap items-center gap-2'>
            {/* Edit — available unless running */}
            {canEdit && (
              <Button variant='secondary' size='sm' onClick={() => setShowEdit(true)}>
                <Pencil className='h-4 w-4' />
                Edit
              </Button>
            )}

            {/* Re-run — available after completed or failed */}
            {canReset && !confirmReset && (
              <Button variant='secondary' size='sm' onClick={() => setConfirmReset(true)}>
                <RotateCcw className='h-4 w-4' />
                Re-run
              </Button>
            )}

            {/* Re-run confirm */}
            {confirmReset && (
              <div className='flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5'>
                <span className='text-xs text-orange-700'>This clears all results. Sure?</span>
                <button
                  type='button'
                  className='text-xs font-semibold text-orange-700 hover:underline'
                  onClick={() => {
                    reset(project.id, {
                      onSuccess: () => {
                        setConfirmReset(false);
                        start(project.id);
                      },
                    });
                  }}
                >
                  {isResetting ? 'Resetting…' : 'Yes, re-run'}
                </button>
                <button
                  type='button'
                  className='text-xs text-gray-500 hover:underline'
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Start */}
            {canStart && !confirmReset && (
              <Button loading={isStarting} size='sm' onClick={() => start(project.id)}>
                <Play className='h-4 w-4' />
                Start
              </Button>
            )}

            {/* View docs + export when completed */}
            {project.status === 'completed' && (
              <>
                <Link to={`/documentation?project=${project.id}`}>
                  <Button variant='secondary' size='sm'>
                    <FileText className='h-4 w-4' />
                    View Docs
                  </Button>
                </Link>
                <Button variant='secondary' size='sm'>
                  <Download className='h-4 w-4' />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <Card>
          <div className='flex items-center gap-3'>
            <FileText className='h-8 w-8 text-brand-400' />
            <div>
              <p className='text-xs text-gray-500'>Pages</p>
              <p className='text-2xl font-bold text-gray-900'>{docPageCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <Image className='h-8 w-8 text-orange-400' />
            <div>
              <p className='text-xs text-gray-500'>Screenshots</p>
              <p className='text-2xl font-bold text-gray-900'>
                {screenshots.length || project.screenshotCount}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <GitBranch className='h-8 w-8 text-purple-400' />
            <div>
              <p className='text-xs text-gray-500'>Workflows</p>
              <p className='text-2xl font-bold text-gray-900'>{project.workflowCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <Clock className='h-8 w-8 text-green-400' />
            <div>
              <p className='text-xs text-gray-500'>Updated</p>
              <p className='text-sm font-semibold text-gray-900'>
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Live progress */}
      {project.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle>Live Progress</CardTitle>
            <span className='text-sm font-semibold text-brand-600'>{project.progress}%</span>
          </CardHeader>
          <ProgressBar value={project.progress} showLabel={false} className='mb-3' />
          {latest && (
            <p className='mb-2 text-sm font-medium text-gray-700'>{latest.message}</p>
          )}
          <div className='max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-3 font-mono'>
            {events
              .slice()
              .reverse()
              .map((event, i) => (
                <div key={i} className='flex items-start gap-2 py-0.5 text-xs'>
                  <span className='shrink-0 text-gray-500'>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className='text-green-400'>{event.message}</span>
                </div>
              ))}
            {events.length === 0 && (
              <p className='text-xs text-gray-500'>Waiting for progress events...</p>
            )}
          </div>
        </Card>
      )}

      {/* Error */}
      {project.status === 'failed' && project.error && (
        <Card>
          <div className='flex items-start gap-3'>
            <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-500' />
            <div className='flex-1'>
              <p className='font-semibold text-red-700'>Job Failed</p>
              <p className='mt-1 text-sm text-red-600'>{project.error}</p>
              <div className='mt-3 flex gap-2'>
                <Button
                  size='sm'
                  loading={isStarting}
                  onClick={() => start(project.id)}
                >
                  <Play className='h-3.5 w-3.5' />
                  Retry
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => setShowEdit(true)}
                >
                  <Pencil className='h-3.5 w-3.5' />
                  Edit & Retry
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Completed banner */}
      {project.status === 'completed' && (
        <Card>
          <div className='flex items-center gap-3'>
            <CheckCircle className='h-6 w-6 shrink-0 text-green-500' />
            <div className='flex-1'>
              <p className='font-semibold text-green-700'>Documentation Complete</p>
              <p className='text-sm text-gray-500'>
                {docPageCount} pages documented · Finished {formatDate(project.updatedAt)}
              </p>
            </div>
            <Link
              to={`/documentation?project=${project.id}`}
              className='inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline'
            >
              Open Documentation
              <ChevronRight className='h-4 w-4' />
            </Link>
          </div>
        </Card>
      )}

      {/* Screenshot gallery */}
      {screenshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Screenshots ({screenshots.length})</CardTitle>
          </CardHeader>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
            {screenshots.map((shot) => (
              <a
                key={shot.name}
                href={`${API_BASE}/v1/files/screenshot/${id}/${shot.name}`}
                target='_blank'
                rel='noopener noreferrer'
                className='group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-brand-400 transition-colors'
              >
                <img
                  src={`${API_BASE}/v1/files/screenshot/${id}/${shot.name}`}
                  alt={shot.name}
                  className='h-32 w-full object-cover object-top transition-transform group-hover:scale-105'
                  loading='lazy'
                />
                <div className='border-t border-gray-100 bg-white px-2 py-1.5'>
                  <p className='truncate text-xs text-gray-500'>
                    {shot.name.replace(/_\d+\.png$/, '').replace(/_/g, ' ')}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Edit modal */}
      {showEdit && (
        <EditProjectModal project={project} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
