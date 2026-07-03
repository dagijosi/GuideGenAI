import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Video,
  Activity,
  BarChart3,
  Settings,
  Bot,
  Zap,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/documentation', icon: FileText, label: 'Documentation' },
  { to: '/videos', icon: Video, label: 'Video Library' },
  { to: '/jobs', icon: Activity, label: 'Crawl Jobs' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

// Static class strings so Tailwind v4 can scan them at build time
const activeClass =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-brand-50 text-brand-600';
const inactiveClass =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900';

export default function Sidebar() {
  return (
    <aside className='flex w-64 flex-col border-r border-gray-200 bg-white'>
      {/* Logo */}
      <div className='flex h-16 items-center gap-2 border-b border-gray-200 px-6'>
        <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500'>
          <Bot className='h-5 w-5 text-white' />
        </div>
        <span className='text-lg font-semibold text-gray-900'>GuideGen AI</span>
        <Zap className='ml-auto h-4 w-4 text-brand-500' />
      </div>

      {/* Navigation */}
      <nav className='flex-1 p-4 space-y-1'>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
          >
            <Icon className='h-4 w-4 flex-shrink-0' />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className='border-t border-gray-200 p-4'>
        <p className='text-xs text-gray-400'>Powered by LM Studio</p>
      </div>
    </aside>
  );
}
