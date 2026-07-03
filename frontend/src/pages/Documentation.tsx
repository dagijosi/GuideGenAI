import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  TestTube,
  BookOpen,
  HelpCircle,
  Globe,
  Image,
  CheckSquare,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import RichText from '../components/ui/RichText';
import { useProjects } from '../hooks/useProjects';
import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import type { ProjectDocumentation, PageDocumentation } from '../types';
import { formatDate } from '../lib/utils';
import { toPlainText } from '../lib/formatText';

const btnActive =
  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors border-brand-500 bg-brand-50 text-brand-700';
const btnInactive =
  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors border-gray-200 text-gray-600 hover:border-brand-400 hover:text-gray-900';

const tabBase = 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors';
const tabActive = `${tabBase} bg-brand-500 text-white`;
const tabInactive = `${tabBase} text-gray-600 hover:bg-gray-100`;

function SectionLabel({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className='mb-2 flex items-center gap-1.5'>
      {Icon && <Icon className='h-3.5 w-3.5 text-gray-400' />}
      <p className='text-xs font-semibold uppercase tracking-wider text-gray-400'>{children}</p>
    </div>
  );
}

function PageDoc({ page }: { page: PageDocumentation }) {
  const [open, setOpen] = useState(false);

  const totalItems =
    page.features.length + page.testCases.length + page.tips.length + page.warnings.length;

  return (
    <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
      {/* Collapsed header */}
      <button
        type='button'
        className='flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50'>
          <FileText className='h-4 w-4 text-brand-500' />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-gray-900'>{page.title}</p>
          <p className='mt-0.5 truncate text-xs text-gray-400'>{page.url}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {page.features.length > 0 && (
            <span className='rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600'>
              {page.features.length} features
            </span>
          )}
          {page.testCases.length > 0 && (
            <span className='rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600'>
              {page.testCases.length} tests
            </span>
          )}
          {totalItems === 0 && (
            <span className='text-xs text-gray-400'>No content</span>
          )}
          {open
            ? <ChevronDown className='h-4 w-4 text-gray-400' />
            : <ChevronRight className='h-4 w-4 text-gray-400' />}
        </div>
      </button>

      {open && (
        <div className='border-t border-gray-100'>
          {/* URL bar */}
          <div className='flex items-center gap-2 bg-gray-50 px-5 py-2'>
            <ExternalLink className='h-3.5 w-3.5 text-gray-400' />
            <a
              href={page.url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-xs text-brand-600 hover:underline'
            >
              {page.url}
            </a>
          </div>

          <div className='space-y-6 px-5 py-5'>
            {/* Overview */}
            {page.overview && (
              <div>
                <SectionLabel>Overview</SectionLabel>
                <RichText content={page.overview} />
              </div>
            )}

            {/* Features */}
            {page.features.length > 0 && (
              <div>
                <SectionLabel icon={CheckSquare}>Features</SectionLabel>
                <ul className='space-y-2'>
                  {page.features.map((f, i) => (
                    <li key={i} className='flex items-start gap-2.5'>
                      <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400' />
                      <span className='text-sm leading-relaxed text-gray-700'>
                        {toPlainText(f)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* User Guide */}
            {page.userGuide && (
              <div>
                <SectionLabel icon={BookOpen}>User Guide</SectionLabel>
                <div className='rounded-lg bg-gray-50 p-4'>
                  <RichText content={page.userGuide} />
                </div>
              </div>
            )}

            {/* Tips + Warnings side by side */}
            {(page.tips.length > 0 || page.warnings.length > 0) && (
              <div className='grid gap-4 sm:grid-cols-2'>
                {page.tips.length > 0 && (
                  <div className='rounded-lg border border-amber-100 bg-amber-50 p-4'>
                    <div className='mb-3 flex items-center gap-1.5'>
                      <Lightbulb className='h-4 w-4 text-amber-500' />
                      <p className='text-xs font-semibold uppercase tracking-wider text-amber-700'>
                        Tips
                      </p>
                    </div>
                    <ul className='space-y-2'>
                      {page.tips.map((t, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm text-amber-900'>
                          <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400' />
                          {toPlainText(t)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {page.warnings.length > 0 && (
                  <div className='rounded-lg border border-red-100 bg-red-50 p-4'>
                    <div className='mb-3 flex items-center gap-1.5'>
                      <AlertTriangle className='h-4 w-4 text-red-500' />
                      <p className='text-xs font-semibold uppercase tracking-wider text-red-700'>
                        Warnings
                      </p>
                    </div>
                    <ul className='space-y-2'>
                      {page.warnings.map((w, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm text-red-900'>
                          <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400' />
                          {toPlainText(w)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Test Cases */}
            {page.testCases.length > 0 && (
              <div>
                <SectionLabel icon={TestTube}>Test Cases</SectionLabel>
                <div className='space-y-2'>
                  {page.testCases.map((tc, i) => (
                    <div key={i} className='flex items-start gap-3 rounded-lg bg-gray-50 p-3'>
                      <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700'>
                        {i + 1}
                      </span>
                      <span className='text-sm leading-relaxed text-gray-700'>
                        {toPlainText(tc)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Page FAQ */}
            {page.faq.length > 0 && (
              <div>
                <SectionLabel icon={HelpCircle}>FAQ</SectionLabel>
                <div className='space-y-3'>
                  {page.faq.map((item, i) => (
                    <div key={i} className='rounded-lg border border-gray-100 bg-gray-50 p-4'>
                      <p className='mb-1.5 text-sm font-semibold text-gray-900'>
                        {toPlainText(item.question)}
                      </p>
                      <p className='text-sm leading-relaxed text-gray-600'>
                        {toPlainText(item.answer)}
                      </p>
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

export default function Documentation() {
  const { data: projects = [] } = useProjects();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('project'));
  const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'faq'>('overview');

  useEffect(() => {
    const id = searchParams.get('project');
    if (id) {
      setSelectedId(id);
      setActiveTab('overview');
    }
  }, [searchParams]);

  const completedProjects = projects.filter((p) => p.status === 'completed');

  const { data: docs, isLoading } = useQuery({
    queryKey: ['docs', selectedId],
    queryFn: () =>
      api.get<ProjectDocumentation>(`/v1/documentation/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const totalTestCases = docs?.pages.reduce((s, p) => s + (p.testCases?.length ?? 0), 0) ?? 0;

  return (
    <div className='space-y-5'>
      {/* Project selector bar */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
          {docs && (
            <span className='text-sm text-gray-400'>
              {docs.pages.length} pages · {formatDate(docs.generatedAt)}
            </span>
          )}
        </CardHeader>
        {completedProjects.length === 0 ? (
          <div className='flex flex-col items-center py-10 text-center'>
            <Image className='mb-3 h-12 w-12 text-gray-200' />
            <p className='text-sm font-medium text-gray-500'>No completed projects yet</p>
            <p className='mt-1 text-xs text-gray-400'>
              Run documentation on a project first.
            </p>
          </div>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {completedProjects.map((p) => (
              <button
                key={p.id}
                type='button'
                onClick={() => { setSelectedId(p.id); setActiveTab('overview'); }}
                className={selectedId === p.id ? btnActive : btnInactive}
              >
                <Globe className='mr-1.5 inline h-3.5 w-3.5' />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className='space-y-3'>
          {[...Array(4)].map((_, i) => (
            <div key={i} className='h-20 animate-pulse rounded-xl bg-gray-100' />
          ))}
        </div>
      )}

      {docs && (
        <>
          {/* Tab navigation */}
          <div className='flex gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5'>
            <button type='button' className={activeTab === 'overview' ? tabActive : tabInactive} onClick={() => setActiveTab('overview')}>
              <BookOpen className='h-4 w-4' />
              Overview
            </button>
            <button type='button' className={activeTab === 'pages' ? tabActive : tabInactive} onClick={() => setActiveTab('pages')}>
              <FileText className='h-4 w-4' />
              Pages
              <span className='ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs'>
                {docs.pages.length}
              </span>
            </button>
            <button type='button' className={activeTab === 'faq' ? tabActive : tabInactive} onClick={() => setActiveTab('faq')}>
              <HelpCircle className='h-4 w-4' />
              FAQ
              <span className='ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs'>
                {docs.faq.length}
              </span>
            </button>
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className='space-y-4'>
              {/* Stats strip */}
              <div className='grid grid-cols-3 gap-3'>
                {[
                  { label: 'Pages', value: docs.pages.length, color: 'text-brand-500' },
                  { label: 'FAQ Entries', value: docs.faq.length, color: 'text-purple-500' },
                  { label: 'Test Cases', value: totalTestCases, color: 'text-green-500' },
                ].map(({ label, value, color }) => (
                  <Card key={label}>
                    <p className='text-xs text-gray-500'>{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
                  </Card>
                ))}
              </div>

              {/* Project overview */}
              <Card>
                <CardHeader>
                  <CardTitle>{docs.projectName}</CardTitle>
                </CardHeader>
                <RichText content={docs.overview} />
              </Card>

              {/* Getting started */}
              {docs.gettingStarted && (
                <Card>
                  <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                  </CardHeader>
                  <div className='rounded-lg bg-gray-50 p-4'>
                    <RichText content={docs.gettingStarted} />
                  </div>
                </Card>
              )}

              {/* Key features */}
              {docs.features.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Features</CardTitle>
                  </CardHeader>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {docs.features.map((f, i) => (
                      <div key={i} className='flex items-start gap-2.5 rounded-lg bg-gray-50 p-3'>
                        <CheckSquare className='mt-0.5 h-4 w-4 shrink-0 text-brand-500' />
                        <span className='text-sm text-gray-700'>{toPlainText(f)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── PAGES TAB ── */}
          {activeTab === 'pages' && (
            <div className='space-y-3'>
              {docs.pages.length === 0 ? (
                <Card>
                  <p className='text-sm text-gray-400'>No pages documented yet.</p>
                </Card>
              ) : (
                docs.pages.map((page) => <PageDoc key={page.pageId} page={page} />)
              )}
            </div>
          )}

          {/* ── FAQ TAB ── */}
          {activeTab === 'faq' && (
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
              </CardHeader>
              {docs.faq.length === 0 ? (
                <p className='text-sm text-gray-400'>No FAQ entries available.</p>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {docs.faq.map((item, i) => (
                    <div key={i} className='py-5 first:pt-0 last:pb-0'>
                      <div className='flex items-start gap-3'>
                        <span className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700'>
                          Q
                        </span>
                        <p className='text-sm font-semibold text-gray-900'>
                          {toPlainText(item.question)}
                        </p>
                      </div>
                      <div className='mt-3 pl-9'>
                        <RichText content={item.answer} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
