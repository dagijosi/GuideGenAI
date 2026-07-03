import { Link } from 'react-router-dom';
import { FolderOpen, FileText, Image, GitBranch, Plus, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useProjects } from '../hooks/useProjects';
import { useStats } from '../hooks/useStats';
import { formatDate } from '../lib/utils';
import { useState } from 'react';
import CreateProjectModal from '../components/projects/CreateProjectModal';

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: stats } = useStats();
  const [showCreate, setShowCreate] = useState(false);

  const recentProjects = projects.slice(0, 5);
  const runningProjects = projects.filter((p) => p.status === 'running');

  return (
    <div className='space-y-6'>
      {/* Stats — icons use static classes, no dynamic injection */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <Card>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Total Projects</p>
              <p className='mt-1 text-2xl font-bold text-gray-900'>
                {(stats?.totalProjects ?? 0).toLocaleString()}
              </p>
            </div>
            <FolderOpen className='h-8 w-8 text-brand-500' />
          </div>
        </Card>
        <Card>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Pages Documented</p>
              <p className='mt-1 text-2xl font-bold text-gray-900'>
                {(stats?.totalPages ?? 0).toLocaleString()}
              </p>
            </div>
            <FileText className='h-8 w-8 text-green-500' />
          </div>
        </Card>
        <Card>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Screenshots</p>
              <p className='mt-1 text-2xl font-bold text-gray-900'>
                {(stats?.totalScreenshots ?? 0).toLocaleString()}
              </p>
            </div>
            <Image className='h-8 w-8 text-orange-500' />
          </div>
        </Card>
        <Card>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Workflows</p>
              <p className='mt-1 text-2xl font-bold text-gray-900'>
                {(stats?.totalWorkflows ?? 0).toLocaleString()}
              </p>
            </div>
            <GitBranch className='h-8 w-8 text-purple-500' />
          </div>
        </Card>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        {/* Active Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Active Jobs</CardTitle>
            <span className='text-sm text-gray-500'>{runningProjects.length} running</span>
          </CardHeader>
          {runningProjects.length === 0 ? (
            <p className='text-sm text-gray-400'>No active jobs. Start a new project to begin.</p>
          ) : (
            <div className='space-y-4'>
              {runningProjects.map((project) => (
                <div key={project.id}>
                  <div className='mb-1 flex items-center justify-between'>
                    <span className='text-sm font-medium text-gray-900'>{project.name}</span>
                    <StatusBadge status={project.status} />
                  </div>
                  <ProgressBar value={project.progress} showLabel={false} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <Link
              to='/projects'
              className='flex items-center gap-1 text-sm text-brand-600 hover:underline'
            >
              View all <ArrowRight className='h-3.5 w-3.5' />
            </Link>
          </CardHeader>
          {loadingProjects ? (
            <div className='space-y-3'>
              {[...Array(3)].map((_, i) => (
                <div key={i} className='h-10 animate-pulse rounded-lg bg-gray-100' />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className='text-center'>
              <p className='mb-3 text-sm text-gray-400'>No projects yet</p>
              <Button size='sm' onClick={() => setShowCreate(true)}>
                <Plus className='h-4 w-4' />
                Create First Project
              </Button>
            </div>
          ) : (
            <div className='divide-y divide-gray-100'>
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className='flex items-center justify-between py-3 hover:bg-gray-50'
                >
                  <div>
                    <p className='text-sm font-medium text-gray-900'>{project.name}</p>
                    <p className='text-xs text-gray-400'>{formatDate(project.createdAt)}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
