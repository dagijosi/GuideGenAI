import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Play, Globe, FileText, Image, AlertCircle, CheckCircle2,
  Clock, GitBranch, ArrowLeft, Download, Pencil, RotateCcw,
  Square, XCircle, PauseCircle, Loader2, Zap, Timer, Layers,
  Camera, SlidersHorizontal, TrendingUp, Activity, ChevronRight,
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import {
  useProject, useStartProject, useResetProject,
  useStopProject, useCancelProject,
} from '../hooks/useProjects';
import { useProgress } from '../hooks/useProgress';
import { useAutoElapsedTime, formatDuration, useEtaEstimator } from '../hooks/useElapsedTime';
import { formatDate } from '../lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectFile } from '../hooks/useFiles';
import EditProjectModal from '../components/projects/EditProjectModal';
import { projectKeys } from '../hooks/useProjects';

interface DocSummary { pageCount: number; generatedAt: string; }
const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

type Tab = 'overview' | 'activity' | 'screenshots' | 'export';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]         = useState<Tab>('overview');
  const [showEdit, setShowEdit]           = useState(false);
  const [confirmReset, setConfirmReset]   = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isStopping, setIsStopping]       = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading } = useProject(id!);
  const { mutate: start,  isPending: isStarting }  = useStartProject();
  const { mutate: reset,  isPending: isResetting } = useResetProject();
  const { mutate: stopMutation }                    = useStopProject();
  const { mutate: cancelMutation, isPending: isCancelling } = useCancelProject();

  const isRunning = project?.status === 'running';
  const isStopped = project?.status === 'stopping';

  const { events, latest, livePageCount, clear } = useProgress(isRunning ? id! : null);

  const elapsed = useAutoElapsedTime(isRunning);
  const eta = useEtaEstimator();

  // Feed progress samples into the ETA estimator whenever a new event arrives
  useEffect(() => {
    if (latest?.progress !== undefined) {
      eta.recordProgress(latest.progress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  // Reset ETA when a new run starts
  useEffect(() => {
    if (!isRunning) eta.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const etaSecs = isRunning ? eta.getEta(project?.progress ?? 0) : null;

  const { data: docSummary } = useQuery<DocSummary | null>({
    queryKey: ['doc-summary', id],
    queryFn: () => api.get<DocSummary>(`/v1/documentation/${id}/summary`).then(r => r.data).catch(() => null),
    enabled: project?.status === 'completed',
  });

  const { data: screenshots = [] } = useQuery<ProjectFile[]>({
    queryKey: ['screenshots', id],
    queryFn: () => api.get<ProjectFile[]>(`/v1/files/${id}/screenshots`).then(r => r.data).catch(() => []),
    enabled: ['completed', 'failed', 'paused'].includes(project?.status ?? ''),
  });

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className='space-y-5 animate-pulse'>
        <div className='h-5 w-28 rounded-lg bg-gray-200' />
        <div className='h-40 rounded-2xl bg-gray-200' />
        <div className='h-10 rounded-xl bg-gray-200' />
        <div className='h-64 rounded-2xl bg-gray-200' />
      </div>
    );
  }

  if (!project) {
    return (
      <div className='flex flex-col items-center justify-center py-24 text-center'>
        <AlertCircle className='mb-3 h-12 w-12 text-gray-300' />
        <p className='text-lg font-medium text-gray-500'>Project not found</p>
        <Link to='/projects' className='mt-4 text-sm text-brand-600 hover:underline'>Back to Projects</Link>
      </div>
    );
  }

  const docPageCount = docSummary?.pageCount ?? project.pageCount;
  const canEdit  = !isRunning && !isStopped;
  const canReset = ['completed', 'failed', 'paused'].includes(project.status);
  const canStart = ['idle', 'failed', 'paused'].includes(project.status);

  const handleStop = () => {
    setIsStopping(true);
    queryClient.setQueryData(projectKeys.detail(id!), { ...project, status: 'paused' });
    stopMutation(project.id, {
      onSuccess: () => { clear(); queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) }); },
      onError:   () => { queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) }); },
      onSettled: () => setIsStopping(false),
    });
  };

  const handleCancel = () => {
    queryClient.setQueryData(projectKeys.detail(id!), { ...project, status: 'failed' });
    cancelMutation(project.id, {
      onSuccess: () => { clear(); setConfirmCancel(false); queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) }); },
      onError:   () => { queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) }); setConfirmCancel(false); },
    });
  };

  const handleStart = () => {
    start(project.id);
    setActiveTab('activity');
  };

  const statusGradient: Record<string, string> = {
    running:   'from-blue-500 to-blue-600',
    stopping:  'from-orange-400 to-orange-500',
    completed: 'from-green-500 to-emerald-600',
    failed:    'from-red-500 to-rose-600',
    paused:    'from-amber-500 to-yellow-600',
    idle:      'from-gray-400 to-gray-500',
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number | string }[] = [
    { id: 'overview',     label: 'Overview',     icon: SlidersHorizontal },
    { id: 'activity',     label: 'Activity',     icon: Activity, badge: isRunning ? '●' : undefined },
    { id: 'screenshots',  label: 'Screenshots',  icon: Camera, badge: screenshots.length || project.screenshotCount || undefined },
    { id: 'export',       label: 'Export',       icon: Download },
  ];

  return (
    <div className='flex flex-col gap-0'>
      {/* Back link */}
      <Link to='/projects'
        className='mb-5 inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors'>
        <ArrowLeft className='h-4 w-4' />
        Back to Projects
      </Link>

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className='relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'>
        {/* Status gradient bar */}
        <div className={`h-1 w-full bg-linear-to-r ${statusGradient[project.status] ?? statusGradient.idle}`} />

        <div className='px-6 pt-5 pb-0'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            {/* Left: title + url + meta */}
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-3'>
                <h1 className='text-xl font-bold text-gray-900'>{project.name}</h1>
                <StatusBadge status={project.status} />
                {isRunning && (
                  <span className='text-sm tabular-nums font-semibold text-blue-600'>
                    {project.progress}%
                  </span>
                )}
              </div>
              <a href={project.url} target='_blank' rel='noopener noreferrer'
                className='mt-1 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 transition-colors'>
                <Globe className='h-3.5 w-3.5' />
                {project.url}
              </a>
              <p className='mt-1 text-xs text-gray-400'>
                Created {formatDate(project.createdAt)}
                {project.status === 'completed' && ` · Finished ${formatDate(project.updatedAt)}`}
              </p>
            </div>

            {/* Right: action buttons */}
            <div className='flex flex-wrap items-center gap-2 shrink-0'>
              {canEdit && (
                <Button variant='secondary' size='sm' onClick={() => setShowEdit(true)}>
                  <Pencil className='h-3.5 w-3.5' /> Edit
                </Button>
              )}

              {isRunning && !confirmCancel && (
                <>
                  <Button variant='secondary' size='sm' onClick={handleStop} disabled={isStopping}>
                    {isStopping ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Square className='h-3.5 w-3.5' />}
                    {isStopping ? 'Stopping…' : 'Stop'}
                  </Button>
                  <Button variant='danger' size='sm' onClick={() => setConfirmCancel(true)}>
                    <XCircle className='h-3.5 w-3.5' /> Cancel
                  </Button>
                </>
              )}
              {isRunning && confirmCancel && (
                <div className='flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5'>
                  <span className='text-xs font-medium text-red-700'>Discard all progress?</span>
                  <button onClick={handleCancel}
                    className='text-xs font-bold text-red-700 hover:underline disabled:opacity-50'
                    disabled={isCancelling}>
                    {isCancelling ? 'Cancelling…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirmCancel(false)} className='text-xs text-gray-500 hover:underline'>No</button>
                </div>
              )}

              {canReset && !confirmReset && (
                <Button variant='secondary' size='sm' onClick={() => setConfirmReset(true)}>
                  <RotateCcw className='h-3.5 w-3.5' /> Re-run
                </Button>
              )}
              {confirmReset && (
                <div className='flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5'>
                  <span className='text-xs font-medium text-amber-700'>Clear results & re-run?</span>
                  <button onClick={() => reset(project.id, { onSuccess: () => { setConfirmReset(false); handleStart(); } })}
                    className='text-xs font-bold text-amber-700 hover:underline'>
                    {isResetting ? 'Resetting…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirmReset(false)} className='text-xs text-gray-500 hover:underline'>No</button>
                </div>
              )}

              {canStart && !confirmReset && (
                <Button size='sm' loading={isStarting} onClick={handleStart}>
                  <Play className='h-3.5 w-3.5' />
                  {project.status === 'paused' ? 'Resume' : 'Start'}
                </Button>
              )}

              {project.status === 'completed' && (
                <>
                  <Link to={`/documentation?project=${project.id}`}>
                    <Button variant='secondary' size='sm'><FileText className='h-3.5 w-3.5' /> Docs</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* ── Stats strip ── */}
          <div className='mt-5 grid grid-cols-2 gap-0 divide-x divide-gray-100 border-t border-gray-100 sm:grid-cols-4'>
            {[
              { icon: FileText,  color: 'text-brand-500',  label: 'Pages',        value: isRunning && livePageCount != null ? `${livePageCount} / ${project.maxPages ?? '?'}` : docPageCount, href: project.status === 'completed' ? `/documentation?project=${project.id}` : null },
              { icon: Image,     color: 'text-orange-500', label: 'Screenshots',  value: screenshots.length || project.screenshotCount, href: null },
              { icon: GitBranch, color: 'text-purple-500', label: 'Workflows',    value: project.workflowCount, href: project.status === 'completed' && project.workflowCount > 0 ? `/documentation?project=${project.id}&tab=workflows` : null },
              { icon: Clock,     color: 'text-green-500',  label: 'Last updated', value: new Date(project.updatedAt).toLocaleDateString(), href: null },
            ].map(({ icon: Icon, color, label, value, href }) => (
              <div key={label} className='flex items-center gap-3 px-4 py-3.5'>
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <div>
                  <p className='text-xs text-gray-400'>{label}</p>
                  {href ? (
                    <Link to={href} className='text-sm font-semibold text-brand-600 hover:underline'>{value}</Link>
                  ) : (
                    <p className='text-sm font-semibold text-gray-900'>{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className='mt-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm'>
        {tabs.map(({ id: tabId, label, icon: Icon, badge }) => (
          <button
            key={tabId}
            type='button'
            onClick={() => setActiveTab(tabId)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all
              ${activeTab === tabId
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
          >
            <Icon className='h-4 w-4 shrink-0' />
            <span className='hidden sm:inline'>{label}</span>
            {badge !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none
                ${activeTab === tabId
                  ? badge === '●' ? 'animate-pulse text-blue-300' : 'bg-white/20 text-white'
                  : badge === '●' ? 'animate-pulse text-blue-500' : 'bg-gray-100 text-gray-600'
                }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────── */}
      <div className='mt-4'>

        {/* ════ OVERVIEW TAB ════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className='space-y-4'>

            {/* Status panel — changes by status */}
            {isRunning && (
              <div className='rounded-2xl border border-blue-100 bg-blue-50 p-5'>
                <div className='mb-1 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <span className='relative flex h-2.5 w-2.5'>
                      <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75' />
                      <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500' />
                    </span>
                    <span className='text-sm font-semibold text-blue-800'>Running</span>
                  </div>
                  <button onClick={() => setActiveTab('activity')}
                    className='flex items-center gap-1 text-xs text-blue-600 hover:underline'>
                    View live log <ChevronRight className='h-3 w-3' />
                  </button>
                </div>
                {latest && <p className='mb-3 mt-1 truncate text-sm text-blue-700'>{latest.message}</p>}
                <ProgressBar value={project.progress} showLabel={false} className='mb-3' />
                <div className='grid grid-cols-3 gap-3 text-center'>
                  <div className='rounded-xl bg-white/70 py-2.5'>
                    <p className='text-xs text-gray-400'>Elapsed</p>
                    <p className='text-sm font-bold text-gray-800 tabular-nums'>{formatDuration(elapsed)}</p>
                  </div>
                  <div className='rounded-xl bg-white/70 py-2.5'>
                    <p className='text-xs text-gray-400'>Est. remaining</p>
                    <p className='text-sm font-bold text-gray-800 tabular-nums'>
                      {etaSecs == null ? '…' : etaSecs === 0 ? 'Almost done' : formatDuration(etaSecs)}
                    </p>
                  </div>
                  <div className='rounded-xl bg-white/70 py-2.5'>
                    <p className='text-xs text-gray-400'>Pages found</p>
                    <p className='text-sm font-bold text-gray-800 tabular-nums'>
                      {livePageCount ?? project.pageCount}
                      {project.maxPages ? <span className='text-xs font-normal text-gray-400'> / {project.maxPages}</span> : null}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isStopped && (
              <div className='flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4'>
                <Loader2 className='h-5 w-5 animate-spin text-orange-500' />
                <p className='text-sm font-medium text-orange-700'>Stopping — finishing current page…</p>
              </div>
            )}

            {project.status === 'paused' && (
              <div className='rounded-2xl border border-amber-200 bg-amber-50 p-5'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100'>
                    <PauseCircle className='h-4.5 w-4.5 text-amber-600' />
                  </div>
                  <div className='flex-1'>
                    <p className='font-semibold text-amber-800'>Job Paused</p>
                    <p className='text-sm text-amber-700'>
                      {project.pageCount > 0 ? `${project.pageCount} pages saved at ${project.progress}%.` : 'Stopped before any pages were saved.'}
                    </p>
                  </div>
                  <Button size='sm' loading={isStarting} onClick={handleStart}>
                    <Play className='h-3.5 w-3.5' /> Resume
                  </Button>
                </div>
                {project.progress > 0 && (
                  <ProgressBar value={project.progress} showLabel={false} />
                )}
              </div>
            )}

            {project.status === 'failed' && project.error && (
              <div className='rounded-2xl border border-red-200 bg-red-50 p-5'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100'>
                    <AlertCircle className='h-4.5 w-4.5 text-red-600' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-red-800'>Job Failed</p>
                    <p className='mt-0.5 text-sm text-red-700 wrap-break-word'>{project.error}</p>
                    <div className='mt-3 flex gap-2'>
                      <Button size='sm' loading={isStarting} onClick={handleStart}>
                        <Play className='h-3.5 w-3.5' /> Retry
                      </Button>
                      <Button size='sm' variant='secondary' onClick={() => setShowEdit(true)}>
                        <Pencil className='h-3.5 w-3.5' /> Edit & Retry
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {project.status === 'completed' && (
              <div className='flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4'>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100'>
                  <CheckCircle2 className='h-4.5 w-4.5 text-green-600' />
                </div>
                <div className='flex-1'>
                  <p className='font-semibold text-green-800'>Documentation Complete</p>
                  <p className='text-sm text-green-700'>
                    {docPageCount} pages · Finished {formatDate(project.updatedAt)}
                  </p>
                </div>
                <Link to={`/documentation?project=${project.id}`}>
                  <Button size='sm' variant='secondary'>
                    Open Docs <ChevronRight className='h-3.5 w-3.5' />
                  </Button>
                </Link>
              </div>
            )}

            {project.status === 'idle' && (
              <div className='flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4'>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100'>
                  <Zap className='h-4.5 w-4.5 text-gray-400' />
                </div>
                <div className='flex-1'>
                  <p className='font-semibold text-gray-700'>Ready to document</p>
                  <p className='text-sm text-gray-500'>
                    Will crawl up to {project.maxPages ?? 50} pages
                    {project.maxDepth != null ? ` (depth ${project.maxDepth})` : ''} and generate AI documentation.
                  </p>
                </div>
                <Button size='sm' loading={isStarting} onClick={handleStart}>
                  <Play className='h-3.5 w-3.5' /> Start
                </Button>
              </div>
            )}

            {/* Configuration card */}
            <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
              <div className='flex items-center gap-2 border-b border-gray-100 px-5 py-3.5'>
                <SlidersHorizontal className='h-4 w-4 text-gray-400' />
                <h3 className='text-sm font-semibold text-gray-700'>Configuration</h3>
              </div>
              <div className='grid grid-cols-2 divide-x divide-gray-100 sm:grid-cols-4'>
                {[
                  { icon: Layers,     label: 'Max Depth',   value: project.maxDepth   != null ? String(project.maxDepth)   : '—' },
                  { icon: TrendingUp, label: 'Max Pages',   value: project.maxPages   != null ? String(project.maxPages)   : '—' },
                  { icon: Camera,     label: 'Screenshots', value: project.includeScreenshots ? 'Enabled' : 'Disabled' },
                  { icon: Activity,   label: 'Progress',    value: `${project.progress}%` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className='flex items-center gap-3 px-5 py-4'>
                    <Icon className='h-4 w-4 shrink-0 text-gray-400' />
                    <div>
                      <p className='text-xs text-gray-400'>{label}</p>
                      <p className='text-sm font-semibold text-gray-800'>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ ACTIVITY TAB ════════════════════════════════════════════════ */}
        {activeTab === 'activity' && (
          <div className='space-y-4'>

            {/* Live progress — shown while running */}
            {(isRunning || isStopped) && (
              <div className={`rounded-2xl border shadow-sm ${isStopped ? 'border-orange-100 bg-linear-to-br from-orange-50 to-white' : 'border-blue-100 bg-linear-to-br from-blue-50 to-white'}`}>
                <div className='px-5 pt-5 pb-4'>
                  <div className='mb-4 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      {isStopped ? (
                        <>
                          <Loader2 className='h-4 w-4 animate-spin text-orange-500' />
                          <span className='text-sm font-semibold text-orange-700'>Stopping…</span>
                        </>
                      ) : (
                        <>
                          <span className='relative flex h-2.5 w-2.5'>
                            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75' />
                            <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500' />
                          </span>
                          <span className='text-sm font-semibold text-gray-800'>Live Progress</span>
                        </>
                      )}
                    </div>
                    <span className={`text-2xl font-bold tabular-nums ${isStopped ? 'text-orange-600' : 'text-blue-600'}`}>
                      {project.progress}%
                    </span>
                  </div>

                  <ProgressBar value={project.progress} showLabel={false} className='mb-4' />

                  {!isStopped && (
                    <div className='mb-4 grid grid-cols-3 gap-3'>
                      <div className='rounded-xl bg-white/80 border border-blue-100 px-3 py-2.5 text-center'>
                        <p className='text-xs text-gray-400 mb-0.5'>Elapsed</p>
                        <p className='text-sm font-bold text-gray-800 tabular-nums'>{formatDuration(elapsed)}</p>
                      </div>
                      <div className='rounded-xl bg-white/80 border border-blue-100 px-3 py-2.5 text-center'>
                        <p className='text-xs text-gray-400 mb-0.5'>Est. remaining</p>
                        <p className='text-sm font-bold text-gray-800 tabular-nums'>
                          {etaSecs == null ? '…' : etaSecs === 0 ? 'Almost done' : formatDuration(etaSecs)}
                        </p>
                      </div>
                      <div className='rounded-xl bg-white/80 border border-blue-100 px-3 py-2.5 text-center'>
                        <p className='text-xs text-gray-400 mb-0.5'>Pages found</p>
                        <p className='text-sm font-bold text-gray-800 tabular-nums'>
                          {livePageCount ?? project.pageCount}
                          {project.maxPages ? <span className='text-xs font-normal text-gray-400'> / {project.maxPages}</span> : null}
                        </p>
                      </div>
                    </div>
                  )}

                  {latest && !isStopped && (
                    <div className='flex items-center gap-2 rounded-lg bg-blue-100/60 px-3 py-2'>
                      <Timer className='h-3.5 w-3.5 shrink-0 text-blue-500' />
                      <p className='text-sm font-medium text-blue-800 truncate'>{latest.message}</p>
                    </div>
                  )}
                </div>

                {/* Terminal log */}
                {!isStopped && (
                  <div className='mx-5 mb-5 max-h-64 overflow-y-auto rounded-xl bg-gray-950 p-4 font-mono text-xs'>
                    {events.length === 0 && <p className='text-gray-500'>Waiting for events…</p>}
                    {events.map((e, i) => (
                      <div key={i} className='flex items-start gap-3 py-0.5'>
                        <span className='shrink-0 text-gray-500'>{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className='text-emerald-400'>{e.message}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Empty state for non-running projects */}
            {!isRunning && !isStopped && (
              <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center'>
                <Activity className='mb-3 h-10 w-10 text-gray-300' />
                <p className='text-sm font-medium text-gray-500'>No activity yet</p>
                <p className='mt-1 text-xs text-gray-400'>
                  {canStart ? 'Start the project to see live progress here.' : 'Activity log will appear here during the next run.'}
                </p>
                {canStart && (
                  <Button size='sm' className='mt-4' loading={isStarting} onClick={handleStart}>
                    <Play className='h-3.5 w-3.5' />
                    {project.status === 'paused' ? 'Resume' : 'Start'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ SCREENSHOTS TAB ════════════════════════════════════════════ */}
        {activeTab === 'screenshots' && (
          <>
            {screenshots.length === 0 ? (
              <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center'>
                <Camera className='mb-3 h-10 w-10 text-gray-300' />
                <p className='text-sm font-medium text-gray-500'>No screenshots yet</p>
                <p className='mt-1 text-xs text-gray-400'>
                  {project.includeScreenshots
                    ? 'Screenshots will appear here once the job runs.'
                    : 'Screenshots are disabled for this project. Edit the project to enable them.'}
                </p>
                {!project.includeScreenshots && canEdit && (
                  <Button variant='secondary' size='sm' className='mt-4' onClick={() => setShowEdit(true)}>
                    <Pencil className='h-3.5 w-3.5' /> Edit Project
                  </Button>
                )}
              </div>
            ) : (
              <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
                <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4'>
                  <h3 className='font-semibold text-gray-900'>Screenshots</h3>
                  <span className='rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600'>
                    {screenshots.length}
                  </span>
                </div>
                <div className='grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4'>
                  {screenshots.map((shot) => (
                    <a key={shot.name}
                      href={`${API_BASE}/v1/files/screenshot/${id}/${shot.name}`}
                      target='_blank' rel='noopener noreferrer'
                      className='group overflow-hidden rounded-xl border border-gray-100 bg-gray-50 transition-all hover:border-brand-300 hover:shadow-md'>
                      <div className='overflow-hidden'>
                        <img
                          src={`${API_BASE}/v1/files/screenshot/${id}/${shot.name}`}
                          alt={shot.name}
                          className='h-36 w-full object-cover object-top transition-transform duration-300 group-hover:scale-105'
                          loading='lazy'
                        />
                      </div>
                      <div className='border-t border-gray-100 bg-white px-2 py-1.5'>
                        <p className='truncate text-xs text-gray-500'>
                          {shot.name.replace(/_\d+\.png$/, '').replace(/_/g, ' ')}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════ EXPORT TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'export' && (
          <div className='space-y-4'>
            {project.status !== 'completed' ? (
              <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center'>
                <Download className='mb-3 h-10 w-10 text-gray-300' />
                <p className='text-sm font-medium text-gray-500'>Nothing to export yet</p>
                <p className='mt-1 text-xs text-gray-400'>Complete a documentation run first.</p>
              </div>
            ) : (
              <div className='rounded-2xl border border-gray-100 bg-white shadow-sm'>
                <div className='flex items-center gap-2 border-b border-gray-100 px-5 py-4'>
                  <Download className='h-4 w-4 text-gray-400' />
                  <h3 className='font-semibold text-gray-900'>Export Documentation</h3>
                </div>
                <div className='divide-y divide-gray-100'>
                  {[
                    { label: 'Markdown',  desc: 'All pages as individual .md files in a zip',  ext: 'md',  icon: FileText  },
                    { label: 'PDF',       desc: 'Full documentation as a single PDF',           ext: 'pdf', icon: FileText  },
                    { label: 'HTML',      desc: 'Standalone HTML site you can self-host',       ext: 'html', icon: Globe    },
                    { label: 'JSON',      desc: 'Raw structured data for custom integrations',  ext: 'json', icon: Activity },
                  ].map(({ label, desc, ext, icon: Icon }) => (
                    <div key={ext} className='flex items-center justify-between px-5 py-4'>
                      <div className='flex items-center gap-3'>
                        <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100'>
                          <Icon className='h-4 w-4 text-gray-500' />
                        </div>
                        <div>
                          <p className='text-sm font-semibold text-gray-800'>{label}</p>
                          <p className='text-xs text-gray-400'>{desc}</p>
                        </div>
                      </div>
                      <Button variant='secondary' size='sm'>
                        <Download className='h-3.5 w-3.5' /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
