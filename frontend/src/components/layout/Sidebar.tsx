import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, Video,
  Activity, BarChart3, Settings, Sparkles,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',      icon: FolderOpen,      label: 'Projects' },
  { to: '/documentation', icon: FileText,         label: 'Documentation' },
  { to: '/videos',        icon: Video,            label: 'Video Library' },
  { to: '/jobs',          icon: Activity,         label: 'Crawl Jobs' },
  { to: '/analytics',     icon: BarChart3,        label: 'Analytics' },
];

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const activeClass   = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold bg-brand-500 text-white shadow-sm shadow-brand-200';
const inactiveClass = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors';

export default function Sidebar() {
  return (
    <aside className='flex w-60 flex-col border-r border-gray-100 bg-white'>
      {/* Logo */}
      <div className='flex h-16 items-center gap-3 px-5 border-b border-gray-100'>
        <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm'>
          <Sparkles className='h-4 w-4 text-white' />
        </div>
        <div>
          <span className='text-sm font-bold text-gray-900'>GuideGen</span>
          <span className='ml-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-600'>AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className='flex flex-1 flex-col gap-1 p-3'>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
            <Icon className='h-4 w-4 shrink-0' />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className='border-t border-gray-100 p-3 space-y-1'>
        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
            <Icon className='h-4 w-4 shrink-0' />
            {label}
          </NavLink>
        ))}
        <div className='mt-3 rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 p-3 border border-brand-100'>
          <p className='text-xs font-medium text-brand-700'>Powered by</p>
          <p className='text-xs font-bold text-brand-900'>LM Studio</p>
        </div>
      </div>
    </aside>
  );
}
