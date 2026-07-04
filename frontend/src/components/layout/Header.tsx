import { useLocation, Link } from 'react-router-dom';
import { Bell, Plus } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useState } from 'react';
import CreateProjectModal from '../projects/CreateProjectModal';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':     { title: 'Dashboard',     subtitle: 'Overview of your projects and activity' },
  '/projects':      { title: 'Projects',       subtitle: 'Manage and run your documentation projects' },
  '/documentation': { title: 'Documentation', subtitle: 'Browse generated guides and docs' },
  '/videos':        { title: 'Video Library', subtitle: 'Recorded walkthroughs and demos' },
  '/jobs':          { title: 'Crawl Jobs',    subtitle: 'Monitor active and completed jobs' },
  '/analytics':     { title: 'Analytics',     subtitle: 'Insights and usage statistics' },
  '/settings':      { title: 'Settings',      subtitle: 'Configure your workspace' },
};

export default function Header() {
  const { pathname } = useLocation();
  const base = '/' + pathname.split('/')[1];
  const page = pageTitles[base] ?? { title: 'GuideGen AI', subtitle: '' };
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [] } = useProjects();
  const runningCount = projects.filter(p => p.status === 'running').length;

  return (
    <>
      <header className='flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6'>
        <div>
          <h1 className='text-lg font-bold text-gray-900'>{page.title}</h1>
          <p className='text-xs text-gray-400'>{page.subtitle}</p>
        </div>

        <div className='flex items-center gap-3'>
          {/* Running indicator */}
          {runningCount > 0 && (
            <Link to='/jobs'
              className='flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors'>
              <span className='flex h-2 w-2 rounded-full bg-blue-500'>
                <span className='h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75' />
              </span>
              {runningCount} running
            </Link>
          )}

          {/* Quick create */}
          <button onClick={() => setShowCreate(true)}
            className='flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors'>
            <Plus className='h-3.5 w-3.5' />
            New Project
          </button>

          {/* Notifications */}
          <button type='button'
            className='relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors'
            aria-label='Notifications'>
            <Bell className='h-4 w-4' />
          </button>

          {/* Avatar */}
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white shadow-sm'>
            G
          </div>
        </div>
      </header>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
