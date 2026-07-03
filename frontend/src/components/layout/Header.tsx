import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/documentation': 'Documentation',
  '/videos': 'Video Library',
  '/jobs': 'Crawl Jobs',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export default function Header() {
  const { pathname } = useLocation();
  const base = '/' + pathname.split('/')[1];
  const title = pageTitles[base] ?? 'GuideGen AI';

  return (
    <header className='flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6'>
      <h1 className='text-xl font-semibold text-gray-900'>{title}</h1>
      <div className='flex items-center gap-4'>
        <button
          type='button'
          className='relative rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          aria-label='Notifications'
        >
          <Bell className='h-5 w-5' />
        </button>
        <div className='flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white'>
          G
        </div>
      </div>
    </header>
  );
}
