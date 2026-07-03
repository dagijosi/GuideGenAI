import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, FileText, Image, Play, Trash2, Pencil } from 'lucide-react';
import StatusBadge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import Button from '../ui/Button';
import EditProjectModal from './EditProjectModal';
import { formatDate } from '../../lib/utils';
import { useStartProject, useDeleteProject } from '../../hooks/useProjects';
import type { Project } from '../../types';

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const { mutate: start, isPending: isStarting } = useStartProject();
  const { mutate: remove, isPending: isDeleting } = useDeleteProject();

  const canEdit = project.status !== 'running';
  const canStart = project.status === 'idle' || project.status === 'failed';

  return (
    <>
      <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md'>
        {/* Title + badge */}
        <div className='mb-3 flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <h3
              className='cursor-pointer truncate text-base font-semibold text-gray-900 hover:text-brand-600'
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              {project.name}
            </h3>
            <a
              href={project.url}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500 hover:text-brand-600'
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className='h-3 w-3 shrink-0' />
              {project.url}
            </a>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Progress bar when running */}
        {project.status === 'running' && (
          <ProgressBar value={project.progress} className='mb-3' />
        )}

        {/* Meta */}
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
        <div className='flex items-center justify-between'>
          <span className='text-xs text-gray-400'>{formatDate(project.createdAt)}</span>

          <div className='flex gap-1.5'>
            {/* Edit */}
            {canEdit && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => setShowEdit(true)}
                aria-label='Edit project'
              >
                <Pencil className='h-3.5 w-3.5 text-gray-500' />
              </Button>
            )}

            {/* Start */}
            {canStart && (
              <Button
                size='sm'
                loading={isStarting}
                onClick={() => start(project.id)}
              >
                <Play className='h-3.5 w-3.5' />
                Start
              </Button>
            )}

            {/* Delete */}
            <Button
              size='sm'
              variant='ghost'
              loading={isDeleting}
              onClick={() => remove(project.id)}
              aria-label='Delete project'
            >
              <Trash2 className='h-3.5 w-3.5 text-red-400' />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditProjectModal project={project} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}
