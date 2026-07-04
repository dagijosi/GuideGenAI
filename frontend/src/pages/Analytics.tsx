import { Link } from 'react-router-dom';
import {
  FolderOpen, FileText, Image, CheckCircle2, XCircle,
  TrendingUp, ArrowRight, BarChart3, Activity, Clock,
  Globe, AlertCircle, PauseCircle,
} from 'lucide-react';
import { useStats } from '../hooks/useStats';
import { useProjects } from '../hooks/useProjects';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { formatDate } from '../lib/utils';

function StatCard({
  label, value, sub, icon: Icon, color, bg, border, trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-white p-5 shadow-sm`}>
      <div className='flex items-start justify-between'>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            trend.positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className='mt-4'>
        <p className='text-3xl font-bold text-gray-900'>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className='mt-0.5 text-sm font-medium text-gray-500'>{label}</p>
        {sub && <p className='mt-0.5 text-xs text-gray-400'>{sub}</p>}
      </div>
    </div>
  );
}

function DonutRing({ pct, color }: { pct: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width='88' height='88' viewBox='0 0 88 88' className='rotate-[-90deg]'>
      <circle cx='44' cy='44' r={r} fill='none' stroke='#f3f4f6' strokeWidth='10' />
      <circle cx='44' cy='44' r={r} fill='none' stroke={color} strokeWidth='10'
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap='round'
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  );
}

export default function Analytics() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: projects = [], isLoading: projLoading } = useProjects();

  const total      = stats?.totalProjects    ?? 0;
  const completed  = stats?.completedProjects ?? 0;
  const failed     = stats?.failedProjects    ?? 0;
  const running    = projects.filter(p => p.status === 'running').length;
  const paused     = projects.filter(p => p.status === 'paused').length;
  const idle       = projects.filter(p => p.status === 'idle').length;
  const successPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failPct    = total > 0 ? Math.round((failed    / total) * 100) : 0;
  const avgPages   = completed > 0
    ? Math.round(projects.filter(p => p.status === 'completed').reduce((s, p) => s + p.pageCount, 0) / completed)
    : 0;
  const totalPages = stats?.totalPages ?? 0;

  const isLoading = statsLoading || projLoading;

  // Sort projects by pageCount descending for the top list
  const topProjects = [...projects]
    .filter(p => p.status === 'completed')
    .sort((a, b) => b.pageCount - a.pageCount)
    .slice(0, 8);

  // Recent activity — last 6 projects by updatedAt
  const recentActivity = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className='space-y-6 animate-pulse'>
        <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => <div key={i} className='h-32 rounded-2xl bg-gray-100' />)}
        </div>
        <div className='grid gap-6 lg:grid-cols-3'>
          <div className='h-64 rounded-2xl bg-gray-100' />
          <div className='lg:col-span-2 h-64 rounded-2xl bg-gray-100' />
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>

      {/* ── KPI row ── */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Total Projects'    value={total}     icon={FolderOpen}  color='text-brand-600'   bg='bg-brand-50'   border='border-brand-100'   sub={`${running} currently running`} />
        <StatCard label='Pages Documented'  value={totalPages} icon={FileText}   color='text-emerald-600' bg='bg-emerald-50' border='border-emerald-100' sub={`Avg ${avgPages} per project`} />
        <StatCard label='Screenshots'       value={stats?.totalScreenshots ?? 0} icon={Image} color='text-orange-600' bg='bg-orange-50' border='border-orange-100' />
        <StatCard label='Success Rate'      value={`${successPct}%`} icon={TrendingUp} color='text-purple-600' bg='bg-purple-50' border='border-purple-100' sub={`${completed} of ${total} completed`} />
      </div>

      {/* ── Middle row ── */}
      <div className='grid gap-6 lg:grid-cols-3'>

        {/* Status breakdown */}
        <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
          <div className='flex items-center gap-2.5 border-b border-gray-100 px-5 py-4'>
            <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100'>
              <BarChart3 className='h-4 w-4 text-gray-600' />
            </div>
            <span className='font-semibold text-gray-900'>Status Breakdown</span>
          </div>
          <div className='p-5'>
            {/* Donut */}
            <div className='relative mb-6 flex items-center justify-center'>
              <DonutRing pct={successPct} color='#22c55e' />
              <div className='absolute text-center'>
                <p className='text-2xl font-bold text-gray-900'>{successPct}%</p>
                <p className='text-xs text-gray-500'>success</p>
              </div>
            </div>

            {/* Legend */}
            <div className='space-y-3'>
              {[
                { label: 'Completed', count: completed, color: 'bg-green-500',  pct: successPct },
                { label: 'Failed',    count: failed,    color: 'bg-red-500',    pct: failPct },
                { label: 'Running',   count: running,   color: 'bg-blue-500',   pct: total > 0 ? Math.round((running / total) * 100) : 0 },
                { label: 'Paused',    count: paused,    color: 'bg-amber-400',  pct: total > 0 ? Math.round((paused  / total) * 100) : 0 },
                { label: 'Idle',      count: idle,      color: 'bg-gray-300',   pct: total > 0 ? Math.round((idle    / total) * 100) : 0 },
              ].map(({ label, count, color, pct }) => (
                <div key={label} className='flex items-center gap-3'>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                  <span className='flex-1 text-sm text-gray-700'>{label}</span>
                  <span className='text-sm font-semibold text-gray-900'>{count}</span>
                  <span className='w-8 text-right text-xs text-gray-400'>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top projects by pages */}
        <div className='rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-2'>
          <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50'>
                <TrendingUp className='h-4 w-4 text-brand-600' />
              </div>
              <span className='font-semibold text-gray-900'>Top Projects by Pages</span>
            </div>
            <Link to='/projects' className='flex items-center gap-1 text-xs text-brand-600 hover:underline'>
              All <ArrowRight className='h-3 w-3' />
            </Link>
          </div>

          {topProjects.length === 0 ? (
            <div className='flex flex-col items-center py-12 text-center'>
              <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100'>
                <FileText className='h-6 w-6 text-gray-400' />
              </div>
              <p className='text-sm text-gray-500'>No completed projects yet</p>
            </div>
          ) : (
            <div className='divide-y divide-gray-50'>
              {topProjects.map((p, i) => {
                const barPct = topProjects[0].pageCount > 0
                  ? Math.round((p.pageCount / topProjects[0].pageCount) * 100)
                  : 0;
                return (
                  <Link key={p.id} to={`/projects/${p.id}`}
                    className='flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50'>
                    <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500'>
                      {i + 1}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='mb-1.5 flex items-center justify-between gap-2'>
                        <p className='truncate text-sm font-semibold text-gray-900'>{p.name}</p>
                        <span className='shrink-0 text-sm font-bold text-brand-600'>{p.pageCount} pages</span>
                      </div>
                      <ProgressBar value={barPct} showLabel={false} className='h-1.5' />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className='grid gap-6 lg:grid-cols-2'>

        {/* Recent activity */}
        <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
          <div className='flex items-center gap-2.5 border-b border-gray-100 px-5 py-4'>
            <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50'>
              <Activity className='h-4 w-4 text-blue-600' />
            </div>
            <span className='font-semibold text-gray-900'>Recent Activity</span>
          </div>
          <div className='divide-y divide-gray-50'>
            {recentActivity.length === 0 ? (
              <p className='px-5 py-10 text-center text-sm text-gray-400'>No activity yet</p>
            ) : recentActivity.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className='flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50'>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  p.status === 'completed' ? 'bg-green-100' :
                  p.status === 'failed'    ? 'bg-red-100'   :
                  p.status === 'running'   ? 'bg-blue-100'  :
                  p.status === 'paused'    ? 'bg-amber-100' : 'bg-gray-100'
                }`}>
                  {p.status === 'completed' && <CheckCircle2 className='h-4 w-4 text-green-600' />}
                  {p.status === 'failed'    && <XCircle      className='h-4 w-4 text-red-600' />}
                  {p.status === 'running'   && <Activity     className='h-4 w-4 text-blue-600' />}
                  {p.status === 'paused'    && <PauseCircle  className='h-4 w-4 text-amber-600' />}
                  {(p.status === 'idle' || p.status === 'stopping') && <Clock className='h-4 w-4 text-gray-500' />}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-semibold text-gray-900'>{p.name}</p>
                  <p className='text-xs text-gray-400'>{formatDate(p.updatedAt)}</p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Summary stats grid */}
        <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
          <div className='flex items-center gap-2.5 border-b border-gray-100 px-5 py-4'>
            <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50'>
              <BarChart3 className='h-4 w-4 text-purple-600' />
            </div>
            <span className='font-semibold text-gray-900'>Summary</span>
          </div>
          <div className='grid grid-cols-2 gap-px bg-gray-100'>
            {[
              { label: 'Completed',         value: completed,                   icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
              { label: 'Failed',            value: failed,                      icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50' },
              { label: 'Total Pages',       value: totalPages.toLocaleString(), icon: FileText,      color: 'text-brand-600',  bg: 'bg-brand-50' },
              { label: 'Screenshots',       value: (stats?.totalScreenshots ?? 0).toLocaleString(), icon: Image, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Avg Pages/Project', value: avgPages,                    icon: TrendingUp,    color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Documented Sites',  value: completed,                   icon: Globe,         color: 'text-blue-600',   bg: 'bg-blue-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className='flex items-center gap-3 bg-white p-4'>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className='min-w-0'>
                  <p className='text-lg font-bold text-gray-900'>{value}</p>
                  <p className='truncate text-xs text-gray-500'>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Failed projects list */}
          {projects.filter(p => p.status === 'failed').length > 0 && (
            <div className='border-t border-gray-100 px-5 py-4'>
              <p className='mb-3 flex items-center gap-1.5 text-xs font-semibold text-red-600'>
                <AlertCircle className='h-3.5 w-3.5' />
                Failed Projects
              </p>
              <div className='space-y-2'>
                {projects.filter(p => p.status === 'failed').slice(0, 3).map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`}
                    className='flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 hover:bg-red-100 transition-colors'>
                    <span className='truncate text-xs font-medium text-red-700'>{p.name}</span>
                    <ArrowRight className='h-3 w-3 shrink-0 text-red-400' />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
