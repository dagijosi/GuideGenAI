import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileText, ChevronDown, ChevronRight, AlertTriangle, Lightbulb,
  TestTube, BookOpen, HelpCircle, Globe, CheckSquare, ExternalLink,
  GitBranch, ArrowRight, Search, Download, Layers, BarChart3,
  MessageSquare, ChevronLeft,
} from 'lucide-react';
import RichText from '../components/ui/RichText';
import { useProjects } from '../hooks/useProjects';
import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import type { ProjectDocumentation, PageDocumentation, IWorkflow } from '../types';
import { formatDate } from '../lib/utils';
import { toPlainText } from '../lib/formatText';

/* ─── tiny helpers ──────────────────────────────────────────────────────── */

function SectionLabel({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className='mb-3 flex items-center gap-2'>
      {Icon && <Icon className='h-3.5 w-3.5 text-gray-400' />}
      <p className='text-xs font-semibold uppercase tracking-widest text-gray-400'>{children}</p>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

/* ─── PageDoc accordion ─────────────────────────────────────────────────── */

function PageDoc({ page, index }: { page: PageDocumentation; index: number }) {
  const [open, setOpen] = useState(false);

  const badges = [
    page.features.length > 0  && { label: `${page.features.length} features`,  color: 'bg-brand-50 text-brand-600' },
    page.testCases.length > 0  && { label: `${page.testCases.length} tests`,    color: 'bg-green-50 text-green-600' },
    page.tips.length > 0       && { label: `${page.tips.length} tips`,          color: 'bg-amber-50 text-amber-600' },
    page.warnings.length > 0   && { label: `${page.warnings.length} warnings`,  color: 'bg-red-50 text-red-600' },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-200 ${open ? 'border-brand-200 shadow-md' : 'border-gray-200 bg-white shadow-sm hover:border-gray-300'}`}>
      <button
        type='button'
        className='flex w-full items-center gap-4 px-6 py-4 text-left'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {/* Index number */}
        <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500'>
          {index + 1}
        </span>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-gray-900'>{page.title}</p>
          <p className='mt-0.5 truncate text-xs text-gray-400'>{page.url}</p>
        </div>
        <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
          {badges.map(({ label, color }) => (
            <Badge key={label} color={color}>{label}</Badge>
          ))}
          {badges.length === 0 && <span className='text-xs text-gray-300'>—</span>}
          <span className='ml-1 text-gray-300'>{open ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}</span>
        </div>
      </button>

      {open && (
        <div className='border-t border-gray-100'>
          {/* URL bar */}
          <div className='flex items-center gap-2 bg-gray-50 px-6 py-2.5'>
            <Globe className='h-3.5 w-3.5 shrink-0 text-gray-400' />
            <a href={page.url} target='_blank' rel='noopener noreferrer'
              className='text-xs text-brand-600 hover:underline truncate'>
              {page.url}
            </a>
            <ExternalLink className='h-3 w-3 shrink-0 text-gray-400' />
          </div>

          <div className='space-y-7 px-6 py-6'>
            {page.overview && (
              <div>
                <SectionLabel>Overview</SectionLabel>
                <RichText content={page.overview} />
              </div>
            )}

            {page.features.length > 0 && (
              <div>
                <SectionLabel icon={CheckSquare}>Features</SectionLabel>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {page.features.map((f, i) => (
                    <div key={i} className='flex items-start gap-2.5 rounded-xl bg-brand-50/60 px-3.5 py-3'>
                      <CheckSquare className='mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500' />
                      <span className='text-sm leading-snug text-gray-700'>{toPlainText(f)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page.userGuide && (
              <div>
                <SectionLabel icon={BookOpen}>User Guide</SectionLabel>
                <div className='rounded-xl border border-gray-100 bg-gray-50 px-5 py-4'>
                  <RichText content={page.userGuide} />
                </div>
              </div>
            )}

            {(page.tips.length > 0 || page.warnings.length > 0) && (
              <div className='grid gap-4 sm:grid-cols-2'>
                {page.tips.length > 0 && (
                  <div className='rounded-xl border border-amber-100 bg-amber-50 px-4 py-4'>
                    <div className='mb-3 flex items-center gap-2'>
                      <Lightbulb className='h-4 w-4 text-amber-500' />
                      <p className='text-xs font-semibold uppercase tracking-widest text-amber-600'>Tips</p>
                    </div>
                    <ul className='space-y-2'>
                      {page.tips.map((t, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm leading-snug text-amber-900'>
                          <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400' />
                          {toPlainText(t)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {page.warnings.length > 0 && (
                  <div className='rounded-xl border border-red-100 bg-red-50 px-4 py-4'>
                    <div className='mb-3 flex items-center gap-2'>
                      <AlertTriangle className='h-4 w-4 text-red-500' />
                      <p className='text-xs font-semibold uppercase tracking-widest text-red-600'>Warnings</p>
                    </div>
                    <ul className='space-y-2'>
                      {page.warnings.map((w, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm leading-snug text-red-900'>
                          <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400' />
                          {toPlainText(w)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {page.testCases.length > 0 && (
              <div>
                <SectionLabel icon={TestTube}>Test Cases</SectionLabel>
                <div className='space-y-2'>
                  {page.testCases.map((tc, i) => (
                    <div key={i} className='flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3'>
                      <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800'>{i + 1}</span>
                      <span className='text-sm leading-relaxed text-gray-700'>{toPlainText(tc)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page.faq.length > 0 && (
              <div>
                <SectionLabel icon={HelpCircle}>FAQ</SectionLabel>
                <div className='divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden'>
                  {page.faq.map((item, i) => (
                    <div key={i} className='px-4 py-3.5'>
                      <p className='mb-1 text-sm font-semibold text-gray-900'>{toPlainText(item.question)}</p>
                      <p className='text-sm leading-relaxed text-gray-600'>{toPlainText(item.answer)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── WorkflowCard ──────────────────────────────────────────────────────── */

function WorkflowCard({ workflow, index }: { workflow: IWorkflow; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-200 ${open ? 'border-purple-200 shadow-md' : 'border-gray-200 bg-white shadow-sm hover:border-gray-300'}`}>
      <button
        type='button'
        className='flex w-full items-center gap-4 px-6 py-4 text-left'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100'>
          <span className='text-sm font-bold text-purple-600'>{index + 1}</span>
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-gray-900'>{workflow.name}</p>
          <p className='mt-0.5 truncate text-xs text-gray-400'>{workflow.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Badge color='bg-purple-50 text-purple-600'>{workflow.steps.length} steps</Badge>
          <span className='text-gray-300'>{open ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}</span>
        </div>
      </button>

      {open && (
        <div className='border-t border-gray-100 px-6 py-5'>
          {/* Visual flow strip */}
          <div className='mb-5 flex flex-wrap items-center gap-2'>
            {workflow.steps.map((step, i) => (
              <div key={i} className='flex items-center gap-2'>
                <div className='flex items-center gap-1.5 rounded-lg border border-purple-100 bg-purple-50 px-3 py-1.5'>
                  <span className='h-1.5 w-1.5 rounded-full bg-purple-400' />
                  <span className='text-xs font-medium text-purple-800'>{step.pageTitle}</span>
                </div>
                {i < workflow.steps.length - 1 && (
                  <ArrowRight className='h-3.5 w-3.5 shrink-0 text-gray-300' />
                )}
              </div>
            ))}
          </div>

          {/* Step detail list */}
          <div className='relative'>
            {/* vertical connector line */}
            <div className='absolute left-[15px] top-0 bottom-0 w-px bg-purple-100' />
            <div className='space-y-3 pl-9'>
              {workflow.steps.map((step, i) => (
                <div key={i} className='relative rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5'>
                  {/* dot on the line */}
                  <div className='absolute left-[-25px] top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-purple-100 ring-2 ring-white'>
                    <span className='text-[10px] font-bold text-purple-700'>{i + 1}</span>
                  </div>
                  <p className='text-sm font-semibold text-gray-800'>{step.pageTitle}</p>
                  <p className='mt-0.5 text-xs text-gray-500'>{step.action}</p>
                  {step.url && (
                    <a href={step.url} target='_blank' rel='noopener noreferrer'
                      className='mt-1.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline'>
                      <ExternalLink className='h-3 w-3' />{step.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */

type Tab = 'overview' | 'pages' | 'workflows' | 'faq';

export default function Documentation() {
  const { data: projects = [] } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('project'));
  const [activeTab, setActiveTab]   = useState<Tab>((searchParams.get('tab') as Tab) ?? 'overview');
  const [pageSearch, setPageSearch] = useState('');

  const selectProject = (id: string) => {
    setSelectedId(id);
    setActiveTab('overview');
    setPageSearch('');
    setSearchParams({ project: id });
  };

  const completedProjects = projects.filter((p) => p.status === 'completed');
  const selectedProject   = completedProjects.find((p) => p.id === selectedId);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['docs', selectedId],
    queryFn: () => api.get<ProjectDocumentation>(`/v1/documentation/${selectedId}`).then(r => r.data),
    enabled: !!selectedId,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', selectedId],
    queryFn: () => api.get<IWorkflow[]>(`/v1/documentation/${selectedId}/workflows`).then(r => r.data),
    enabled: !!selectedId,
  });

  const totalTestCases = docs?.pages.reduce((s, p) => s + (p.testCases?.length ?? 0), 0) ?? 0;
  const filteredPages  = (docs?.pages ?? []).filter(p =>
    p.title.toLowerCase().includes(pageSearch.toLowerCase()) ||
    p.url.toLowerCase().includes(pageSearch.toLowerCase()),
  );

  /* ── no completed projects ── */
  if (completedProjects.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-32 text-center'>
        <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100'>
          <FileText className='h-8 w-8 text-gray-300' />
        </div>
        <p className='text-lg font-semibold text-gray-700'>No documentation yet</p>
        <p className='mt-1 text-sm text-gray-400'>Complete a project run to generate documentation.</p>
        <Link to='/projects' className='mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600'>
          Go to Projects
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview',   label: 'Overview',   icon: BookOpen },
    { id: 'pages',      label: 'Pages',      icon: FileText,   count: docs?.pages.length },
    { id: 'workflows',  label: 'Workflows',  icon: GitBranch,  count: workflows.length },
    { id: 'faq',        label: 'FAQ',        icon: MessageSquare, count: docs?.faq.length },
  ];

  return (
    <div className='flex gap-6 items-start'>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className='w-64 shrink-0 sticky top-6'>
        <div className='rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden'>
          {/* Sidebar header */}
          <div className='border-b border-gray-100 px-4 py-3.5'>
            <p className='text-xs font-semibold uppercase tracking-widest text-gray-400'>Projects</p>
          </div>
          <nav className='p-2'>
            {completedProjects.map((p) => (
              <button
                key={p.id}
                type='button'
                onClick={() => selectProject(p.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all
                  ${selectedId === p.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Globe className={`h-4 w-4 shrink-0 ${selectedId === p.id ? 'text-white' : 'text-gray-400'}`} />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{p.name}</p>
                  {selectedId === p.id && docs && (
                    <p className={`text-xs ${selectedId === p.id ? 'text-gray-300' : 'text-gray-400'}`}>
                      {docs.pages.length} pages
                    </p>
                  )}
                </div>
                {selectedId === p.id && <ChevronRight className='h-3.5 w-3.5 shrink-0 text-gray-400' />}
              </button>
            ))}
          </nav>

          {/* Stats for selected project */}
          {docs && (
            <>
              <div className='border-t border-gray-100 px-4 py-3'>
                <p className='mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400'>Stats</p>
                <div className='space-y-2'>
                  {[
                    { icon: Layers,       label: 'Pages',      value: docs.pages.length,  color: 'text-brand-500' },
                    { icon: GitBranch,    label: 'Workflows',  value: workflows.length,   color: 'text-purple-500' },
                    { icon: MessageSquare,label: 'FAQ',        value: docs.faq.length,    color: 'text-blue-500' },
                    { icon: TestTube,     label: 'Tests',      value: totalTestCases,     color: 'text-green-500' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className='flex items-center justify-between rounded-lg px-2 py-1.5'>
                      <div className='flex items-center gap-2'>
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className='text-xs text-gray-500'>{label}</span>
                      </div>
                      <span className={`text-sm font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className='border-t border-gray-100 px-4 py-3'>
                <p className='text-xs text-gray-400'>Generated {formatDate(docs.generatedAt)}</p>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className='min-w-0 flex-1 space-y-5'>

        {/* No project selected */}
        {!selectedId && (
          <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center'>
            <ChevronLeft className='mb-3 h-8 w-8 text-gray-300' />
            <p className='text-sm font-medium text-gray-500'>Select a project from the sidebar</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className='space-y-3'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='h-16 animate-pulse rounded-2xl bg-gray-100' />
            ))}
          </div>
        )}

        {docs && selectedProject && (
          <>
            {/* Page header */}
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-xl font-bold text-gray-900'>{selectedProject.name}</h1>
                <a href={selectedProject.url} target='_blank' rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600 transition-colors'>
                  <Globe className='h-3.5 w-3.5' />{selectedProject.url}
                </a>
              </div>
              <button type='button'
                className='flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50'>
                <Download className='h-4 w-4' /> Export
              </button>
            </div>

            {/* Tab bar */}
            <div className='flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm'>
              {tabs.map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  type='button'
                  onClick={() => setActiveTab(id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all
                    ${activeTab === id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  <Icon className='h-4 w-4 shrink-0' />
                  <span className='hidden sm:inline'>{label}</span>
                  {count !== undefined && count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none
                      ${activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className='space-y-5'>
                {/* Quick-jump cards */}
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                  {[
                    { tab: 'pages'     as Tab, icon: Layers,        label: 'Pages',     value: docs.pages.length,  color: 'bg-brand-50',   iconColor: 'text-brand-500',  textColor: 'text-brand-600' },
                    { tab: 'workflows' as Tab, icon: GitBranch,     label: 'Workflows', value: workflows.length,   color: 'bg-purple-50',  iconColor: 'text-purple-500', textColor: 'text-purple-600' },
                    { tab: 'faq'       as Tab, icon: MessageSquare, label: 'FAQ',       value: docs.faq.length,    color: 'bg-blue-50',    iconColor: 'text-blue-500',   textColor: 'text-blue-600' },
                    { tab: 'pages'     as Tab, icon: TestTube,      label: 'Tests',     value: totalTestCases,     color: 'bg-green-50',   iconColor: 'text-green-500',  textColor: 'text-green-600' },
                  ].map(({ tab, icon: Icon, label, value, color, iconColor, textColor }) => (
                    <button key={label} type='button' onClick={() => setActiveTab(tab)}
                      className={`rounded-2xl border border-gray-100 ${color} p-5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5`}>
                      <div className={`mb-2 inline-flex rounded-lg p-2 bg-white/70`}>
                        <Icon className={`h-4 w-4 ${iconColor}`} />
                      </div>
                      <p className='text-xs text-gray-500'>{label}</p>
                      <p className={`mt-0.5 text-2xl font-bold ${textColor}`}>{value}</p>
                    </button>
                  ))}
                </div>

                {/* Overview */}
                <div className='rounded-2xl border border-gray-200 bg-white shadow-sm'>
                  <div className='border-b border-gray-100 px-6 py-4'>
                    <h2 className='font-semibold text-gray-900'>{docs.projectName}</h2>
                    <p className='mt-0.5 text-xs text-gray-400'>Project overview</p>
                  </div>
                  <div className='px-6 py-5'>
                    <RichText content={docs.overview} />
                  </div>
                </div>

                {/* Getting started */}
                {docs.gettingStarted && (
                  <div className='rounded-2xl border border-gray-200 bg-white shadow-sm'>
                    <div className='flex items-center gap-2 border-b border-gray-100 px-6 py-4'>
                      <BookOpen className='h-4 w-4 text-gray-400' />
                      <h2 className='font-semibold text-gray-900'>Getting Started</h2>
                    </div>
                    <div className='px-6 py-5'>
                      <RichText content={docs.gettingStarted} />
                    </div>
                  </div>
                )}

                {/* Key features */}
                {docs.features.length > 0 && (
                  <div className='rounded-2xl border border-gray-200 bg-white shadow-sm'>
                    <div className='flex items-center gap-2 border-b border-gray-100 px-6 py-4'>
                      <BarChart3 className='h-4 w-4 text-gray-400' />
                      <h2 className='font-semibold text-gray-900'>Key Features</h2>
                    </div>
                    <div className='grid gap-2 p-5 sm:grid-cols-2'>
                      {docs.features.map((f, i) => (
                        <div key={i} className='flex items-start gap-2.5 rounded-xl bg-gray-50 px-3.5 py-3'>
                          <CheckSquare className='mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500' />
                          <span className='text-sm text-gray-700'>{toPlainText(f)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PAGES TAB ── */}
            {activeTab === 'pages' && (
              <div className='space-y-3'>
                {/* Search bar */}
                <div className='relative'>
                  <Search className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
                  <input
                    type='search'
                    placeholder='Search pages…'
                    value={pageSearch}
                    onChange={e => setPageSearch(e.target.value)}
                    className='w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
                  />
                </div>

                {filteredPages.length === 0 ? (
                  <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center'>
                    <FileText className='mb-3 h-10 w-10 text-gray-200' />
                    <p className='text-sm text-gray-500'>{pageSearch ? 'No pages match your search' : 'No pages documented yet'}</p>
                  </div>
                ) : (
                  <>
                    <p className='text-xs text-gray-400'>
                      {filteredPages.length} {filteredPages.length === 1 ? 'page' : 'pages'}
                      {pageSearch && ` matching "${pageSearch}"`}
                    </p>
                    {filteredPages.map((page, i) => <PageDoc key={page.pageId} page={page} index={i} />)}
                  </>
                )}
              </div>
            )}

            {/* ── WORKFLOWS TAB ── */}
            {activeTab === 'workflows' && (
              <div className='space-y-3'>
                {workflows.length === 0 ? (
                  <div className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center'>
                    <GitBranch className='mb-3 h-10 w-10 text-gray-200' />
                    <p className='text-sm font-medium text-gray-500'>No workflows detected</p>
                    <p className='mt-1 text-xs text-gray-400 max-w-xs'>
                      Workflows are inferred from navigation patterns during the crawl. Re-run the project to generate them.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className='text-xs text-gray-400'>{workflows.length} user workflow{workflows.length !== 1 ? 's' : ''} detected</p>
                    {workflows.map((wf, i) => <WorkflowCard key={wf.id} workflow={wf} index={i} />)}
                  </>
                )}
              </div>
            )}

            {/* ── FAQ TAB ── */}
            {activeTab === 'faq' && (
              <div className='rounded-2xl border border-gray-200 bg-white shadow-sm'>
                <div className='flex items-center gap-2 border-b border-gray-100 px-6 py-4'>
                  <HelpCircle className='h-4 w-4 text-gray-400' />
                  <h2 className='font-semibold text-gray-900'>Frequently Asked Questions</h2>
                  <span className='ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500'>{docs.faq.length}</span>
                </div>
                {docs.faq.length === 0 ? (
                  <p className='px-6 py-8 text-center text-sm text-gray-400'>No FAQ entries available.</p>
                ) : (
                  <div className='divide-y divide-gray-50'>
                    {docs.faq.map((item, i) => (
                      <div key={i} className='px-6 py-5'>
                        <div className='flex items-start gap-3'>
                          <span className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700'>Q</span>
                          <p className='font-semibold text-gray-900 text-sm'>{toPlainText(item.question)}</p>
                        </div>
                        <div className='mt-3 pl-9'>
                          <RichText content={item.answer} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
