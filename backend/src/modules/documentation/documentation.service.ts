import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AiService } from '../ai/ai.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import {
  DocGenerationMode,
  PageDocumentation,
  ProjectDocumentation,
  WorkflowGuide,
} from '../../common/interfaces/documentation.interface';
import { IProject } from '../../common/interfaces/project.interface';
import { IWorkflow } from '../../common/interfaces/workflow.interface';
import { DeduplicationResult, PageDeduplicator } from '../../common/utils/page-deduplicator';
import { DetectedWorkflow, WorkflowDetector } from '../../common/utils/workflow-detector';
import { AppMap } from '../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../../common/utils/file.utils';

type ProgressCallback = (message: string, progress: number) => void;

export interface GenerateDocsOptions {
  mode?: DocGenerationMode;
  /** Required when mode === 'workflow' — name of the workflow to deep-dive */
  workflowName?: string;
}

@Injectable()
export class DocumentationService {
  private readonly logger = new Logger(DocumentationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC — Main entry point
  // ─────────────────────────────────────────────────────────────────────────────

  async generateProjectDocs(
    project: IProject,
    pages: PageMetadata[],
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
    options: GenerateDocsOptions = {},
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    const mode: DocGenerationMode = options.mode ?? 'full';
    this.logger.log(`[${project.id}] Starting doc generation — mode: ${mode}`);

    if (mode === 'discovery') {
      return this.generateDiscoveryMode(project, pages);
    }

    // ── Step 1: Build app map (1 AI call, all modes need it) ──────────────────
    onProgress?.('Analysing application structure...', 86);
    const appMap = signal?.aborted
      ? this.aiService.buildFallbackAppMapPublic(project.name, pages)
      : await this.generateWithFallback(
          () => this.aiService.buildAppMap(project.name, pages),
          this.aiService.buildFallbackAppMapPublic(project.name, pages),
          'application map',
        );

    // ── Step 1b: Detect workflows from real crawl navigation paths (no AI) ───
    const detectedWorkflows = this.detectNavigationWorkflows(pages, appMap);

    // ── Step 2: Deduplicate template pages ────────────────────────────────────
    const dedup = PageDeduplicator.deduplicate(pages);
    const dupCount = pages.length - dedup.representatives.length;
    if (dupCount > 0) {
      this.logger.log(`Deduplication: ${pages.length} pages → ${dedup.representatives.length} unique templates (${dupCount} duplicates skipped)`);
    }

    if (mode === 'overview') {
      return this.generateOverviewMode(project, pages, appMap, detectedWorkflows, signal);
    }

    if (mode === 'workflow') {
      return this.generateWorkflowMode(project, pages, appMap, dedup, detectedWorkflows, options.workflowName, onProgress, signal);
    }

    // mode === 'full'
    return this.generateFullMode(project, pages, appMap, dedup, detectedWorkflows, onProgress, signal);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Generation modes
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * DISCOVERY MODE — 0 AI calls.
   * Produces: A fast listing of all crawled pages using basic browse metadata.
   */
  private generateDiscoveryMode(
    project: IProject,
    pages: PageMetadata[],
  ): { docs: ProjectDocumentation; workflows: IWorkflow[] } {
    this.logger.log(`[${project.id}] Discovery mode — skipping AI generation`);

    return {
      docs: {
        projectId: project.id,
        projectName: project.name,
        overview: 'This is a route discovery crawl. AI documentation was skipped.',
        gettingStarted: '',
        features: [],
        pages: pages.map(p => this.buildBrowseOnlyPage(p)),
        workflows: [],
        workflowGuides: [],
        faq: [],
        troubleshooting: '',
        releaseNotes: '',
        developerGuide: '',
        glossary: {},
        generationMode: 'discovery',
        generatedAt: new Date().toISOString(),
      },
      workflows: [],
    };
  }

  /**
   * OVERVIEW MODE — 2 AI calls total regardless of page count.
   * Produces: app map + quick overview text + workflow names.
   * No per-page documentation. Good for a fast first look at a large site.
   */
  private async generateOverviewMode(
    project: IProject,
    pages: PageMetadata[],
    appMap: ReturnType<AiService['buildFallbackAppMapPublic']>,
    detectedWorkflows: DetectedWorkflow[],
    signal?: AbortSignal,
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    this.logger.log(`[${project.id}] Overview mode — 1 AI call`);

    const overview = signal?.aborted
      ? `${project.name} is a web application at ${project.url} with ${pages.length} pages.`
      : await this.generateWithFallback(
          () => this.aiService.generateQuickOverview(project.name, project.url, appMap, pages),
          `${project.name} is a web application at ${project.url} with ${pages.length} pages.`,
          'quick overview',
        );

    const workflows = this.buildWorkflowObjectsFromDetected(project.id, detectedWorkflows, pages);

    return {
      docs: {
        projectId: project.id,
        projectName: project.name,
        overview,
        gettingStarted: '',
        features: pages.flatMap(p => p.buttons.map(b => b.text)).filter(Boolean).slice(0, 20),
        pages: pages.map(p => this.buildBrowseOnlyPage(p)),
        workflows: workflows.map(w => w.name),
        workflowGuides: [],
        faq: [],
        troubleshooting: '',
        releaseNotes: '',
        developerGuide: '',
        glossary: {},
        generationMode: 'overview',
        generatedAt: new Date().toISOString(),
      },
      workflows,
    };
  }

  /**
   * WORKFLOW MODE — deep dive on one workflow's pages, overview-only for the rest.
   * AI calls: 1 (app map) + 2×R (R = unique template reps in workflow) + 1 (workflow guide).
   * Template dedup applies within the workflow. All other pages get fallback docs only.
   */
  private async generateWorkflowMode(
    project: IProject,
    pages: PageMetadata[],
    appMap: ReturnType<AiService['buildFallbackAppMapPublic']>,
    _dedup: DeduplicationResult,
    detectedWorkflows: DetectedWorkflow[],
    workflowName: string | undefined,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    const selected = WorkflowDetector.resolve(detectedWorkflows, workflowName);

    if (!selected || selected.pages.length === 0) {
      this.logger.warn(`[${project.id}] No valid navigation workflow found for "${workflowName ?? ''}"`);
    }

    const workflowPagesMeta = selected?.pages ?? [];
    const workflowUrls = new Set(workflowPagesMeta.map(p => p.url));
    const nonWorkflowPages = pages.filter(p => !workflowUrls.has(p.url));
    const resolvedName = selected?.name ?? workflowName ?? 'Workflow';

    // Deduplicate only within the selected workflow's pages
    const workflowDedup = PageDeduplicator.deduplicate(workflowPagesMeta);
    const dupCount = workflowPagesMeta.length - workflowDedup.representatives.length;
    if (dupCount > 0) {
      this.logger.log(`Workflow dedup: ${workflowPagesMeta.length} pages → ${workflowDedup.representatives.length} unique templates`);
    }

    this.logger.log(`[${project.id}] Workflow mode — "${resolvedName}" (${workflowDedup.representatives.length} AI pages, ${nonWorkflowPages.length} fallback-only)`);

    const workflowPageDocs = await this.generateDedupedPageDocs(
      workflowPagesMeta,
      workflowDedup,
      appMap,
      onProgress,
      signal,
      'Documenting workflow page',
    );

    // Fallback docs for non-workflow pages (no AI cost)
    const otherDocs = nonWorkflowPages.map(p => this.buildFallbackDoc(p));

    // Use workflow pages directly — already ordered by navigation path
    const guidePages = workflowPagesMeta;

    // Generate the end-to-end workflow guide
    onProgress?.('Generating workflow guide...', 93);
    const workflowGuideContent = signal?.aborted || guidePages.length === 0 ? '' : await this.generateWithFallback(
      () => this.aiService.generateWorkflowGuide(resolvedName, guidePages, appMap),
      `## ${resolvedName}\n\nThis guide covers the workflow: ${guidePages.map(p => p.title).join(' → ')}`,
      'workflow guide',
    );

    const workflowGuides: WorkflowGuide[] = guidePages.length > 0 && selected ? [{
      workflowName: resolvedName,
      pagetitles: guidePages.map((p, i) =>
        WorkflowDetector.stepLabel(p, selected.patternPath[i], pages),
      ),
      content: workflowGuideContent,
      stepScreenshots: this.buildStepScreenshotsFromPages(guidePages, selected.patternPath, pages),
      generatedAt: new Date().toISOString(),
    }] : [];

    onProgress?.('Generating overview...', 95);
    const overview = signal?.aborted ? '' : await this.generateWithFallback(
      () => this.aiService.generateQuickOverview(project.name, project.url, appMap, pages),
      `${project.name} — ${appMap.appPurpose}`,
      'quick overview',
    );

    const workflows = this.buildWorkflowObjectsFromDetected(project.id, detectedWorkflows, pages);

    return {
      docs: {
        projectId: project.id,
        projectName: project.name,
        overview,
        gettingStarted: '',
        features: pages.flatMap(p => p.buttons.map(b => b.text)).filter(Boolean).slice(0, 20),
        pages: [...workflowPageDocs, ...otherDocs],
        workflows: workflows.map(w => w.name),
        workflowGuides,
        faq: [],
        troubleshooting: '',
        releaseNotes: '',
        developerGuide: '',
        glossary: {},
        generationMode: 'workflow',
        generatedAt: new Date().toISOString(),
      },
      workflows,
    };
  }

  /**
   * FULL MODE — complete per-page AI documentation with deduplication.
   * AI calls: 1 (app map) + 2×R (R = unique representative pages) + 3 (overview/started/FAQ).
   * Duplicate pages get the representative's docs with a template note applied.
   */
  private async generateFullMode(
    project: IProject,
    pages: PageMetadata[],
    appMap: ReturnType<AiService['buildFallbackAppMapPublic']>,
    dedup: DeduplicationResult,
    detectedWorkflows: DetectedWorkflow[],
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    const pageDocs = await this.generateDedupedPageDocs(
      pages,
      dedup,
      appMap,
      onProgress,
      signal,
      'Documenting page',
    );

    // Round 3: overview + getting started + FAQ
    onProgress?.('Generating project overview...', 93);
    const overview = signal?.aborted
      ? `${project.name} is a web application at ${project.url} with ${pages.length} pages.`
      : await this.generateWithFallback(
          () => this.aiService.generateProjectOverview(project.name, project.url, pages, appMap),
          `${project.name} — ${appMap.appPurpose}`,
          'project overview',
        );

    onProgress?.('Generating getting started guide...', 94);
    const gettingStarted = signal?.aborted
      ? this.buildFallbackGettingStarted(pages)
      : await this.generateWithFallback(
          () => this.aiService.generateGettingStarted(pages, appMap),
          this.buildFallbackGettingStarted(pages),
          'getting started guide',
        );

    onProgress?.('Generating FAQ...', 95);
    const faq: Array<{ question: string; answer: string }> = signal?.aborted
      ? []
      : await this.generateWithFallback(
          () => this.aiService.generateFaq(pages, appMap),
          [],
          'FAQ',
        );

    // Workflow guides for full mode — one per navigation-detected workflow
    onProgress?.('Generating workflow guides...', 96);
    const workflowGuides: WorkflowGuide[] = [];
    if (!signal?.aborted) {
      for (const wf of detectedWorkflows) {
        if (signal?.aborted) break;
        if (wf.pages.length < 2) continue;
        const content = await this.generateWithFallback(
          () => this.aiService.generateWorkflowGuide(wf.name, wf.pages, appMap),
          `## ${wf.name}\n\nWorkflow: ${wf.name}`,
          `workflow guide: ${wf.name}`,
        );
        workflowGuides.push({
          workflowName: wf.name,
          pagetitles: wf.pages.map((p, i) => WorkflowDetector.stepLabel(p, wf.patternPath[i], pages)),
          content,
          stepScreenshots: this.buildStepScreenshotsFromPages(wf.pages, wf.patternPath, pages),
          generatedAt: new Date().toISOString(),
        });
      }
    }

    onProgress?.('Finalising workflows...', 97);
    const workflows = this.buildWorkflowObjectsFromDetected(project.id, detectedWorkflows, pages);

    return {
      docs: {
        projectId: project.id,
        projectName: project.name,
        overview,
        gettingStarted,
        features: pages.flatMap(p => p.buttons.map(b => b.text)).filter(Boolean).slice(0, 30),
        pages: pageDocs.filter(Boolean),
        workflows: workflows.map(w => w.name),
        workflowGuides,
        faq,
        troubleshooting: '',
        releaseNotes: '',
        developerGuide: '',
        glossary: {},
        generationMode: 'full',
        generatedAt: new Date().toISOString(),
      },
      workflows,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Deduplication helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Detects workflows from crawl navigation paths and syncs names into the app map
   * so AI overview/FAQ prompts reference real journeys (not AI-guessed duplicates).
   */
  private detectNavigationWorkflows(pages: PageMetadata[], appMap: AppMap): DetectedWorkflow[] {
    const detected = WorkflowDetector.detect(pages);
    appMap.workflows = WorkflowDetector.toTitlePaths(detected, pages);
    if (detected.length > 0) {
      this.logger.log(`Navigation workflows: ${detected.length} — ${detected.map(w => w.name).join('; ')}`);
    } else {
      this.logger.warn('No navigation workflows detected — pages may lack navigationUrlPath (re-crawl recommended)');
    }
    return detected;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Shared helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private buildWorkflowObjectsFromDetected(
    projectId: string,
    detected: DetectedWorkflow[],
    allPages: PageMetadata[],
  ): IWorkflow[] {
    return detected.map(wf => ({
      id: uuidv4(),
      projectId,
      name: wf.name,
      description: wf.description,
      steps: wf.pages.map((page, order) => ({
        order,
        pageTitle: WorkflowDetector.stepLabel(page, wf.patternPath[order], allPages),
        url: page.url,
        action: order === 0
          ? 'Start here'
          : `Continue to ${WorkflowDetector.stepLabel(page, wf.patternPath[order], allPages)}`,
        screenshotPath: page.screenshotPath,
      })),
      createdAt: new Date().toISOString(),
    }));
  }

  private buildStepScreenshotsFromPages(
    pathPages: PageMetadata[],
    patternPath: string[],
    allPages: PageMetadata[],
  ): WorkflowGuide['stepScreenshots'] {
    return pathPages.map((page, i) => ({
      pageTitle: WorkflowDetector.stepLabel(page, patternPath[i], allPages),
      url: page.url,
      screenshotPath: page.screenshotPath,
    }));
  }

  /** Generates AI documentation for deduplicated representative pages and
   * expands the result to cover all pages in the input set.
   */
  private async generateDedupedPageDocs(
    pages: PageMetadata[],
    dedup: DeduplicationResult,
    appMap: ReturnType<AiService['buildFallbackAppMapPublic']>,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
    progressLabel = 'Documenting page',
  ): Promise<PageDocumentation[]> {
    const total = dedup.representatives.length;
    let completed = 0;
    const repDocMap = new Map<string, PageDocumentation>();

    for (const page of dedup.representatives) {
      if (signal?.aborted) break;
      const progressPct = 87 + Math.round((completed / Math.max(total, 1)) * 5);
      onProgress?.(`${progressLabel} ${completed + 1}/${total}: ${page.title}`, progressPct);

      try {
        const doc = await this.aiService.generatePageDocumentation(page, appMap);
        doc.pageId = uuidv4();
        doc.screenshotPath = page.screenshotPath;

        const group = dedup.groups.get(page.url) ?? [page.url];
        if (group.length > 1) {
          const pattern = dedup.urlPatterns.get(page.url) ?? page.url;
          doc.overview += PageDeduplicator.buildDuplicateNote(page.url, group, pattern);
          doc.templateGroupSize = group.length;
        }

        repDocMap.set(page.url, doc);
        completed++;
      } catch (err) {
        this.logger.warn(`AI doc failed for "${page.title}": ${(err as Error).message} — fallback`);
        repDocMap.set(page.url, this.buildFallbackDoc(page));
        completed++;
      }
    }

    return pages.map(page => {
      const repUrl = dedup.urlToRepresentative.get(page.url) ?? page.url;
      const repDoc = repDocMap.get(repUrl);
      if (!repDoc) return this.buildFallbackDoc(page);
      if (repUrl === page.url) return repDoc;

      return {
        ...repDoc,
        pageId: uuidv4(),
        url: page.url,
        title: page.title,
        screenshotPath: page.screenshotPath ?? repDoc.screenshotPath,
        templateRepresentativeUrl: repUrl,
        templateGroupSize: repDoc.templateGroupSize,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Shared helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async generateWithFallback<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(`AI ${label} failed: ${(error as Error).message} — using fallback`);
      return fallback;
    }
  }

  private buildStepScreenshots(
    pageTitles: string[],
    pagesByTitle: Map<string, PageMetadata>,
  ): WorkflowGuide['stepScreenshots'] {
    return pageTitles.map(title => {
      const meta = pagesByTitle.get(title);
      return {
        pageTitle: title,
        url: meta?.url ?? '',
        screenshotPath: meta?.screenshotPath,
      };
    });
  }

  /** Lightweight page entry for overview mode — screenshot + browse info, no AI */
  private buildBrowseOnlyPage(page: PageMetadata): PageDocumentation {
    return {
      pageId: uuidv4(),
      url: page.url,
      title: page.title,
      screenshotPath: page.screenshotPath,
      overview: 'This page was discovered during the crawl. Run **Workflow Deep Dive** or **Full Documentation** from the project page for step-by-step guides.',
      whenToUse: '',
      beforeYouBegin: '',
      features: page.buttons.map(b => b.text).filter(Boolean).slice(0, 6),
      userGuide: '',
      tips: [],
      commonMistakes: [],
      afterCompletion: '',
      relatedTasks: page.navigationLinks.map(n => n.text).filter(Boolean).slice(0, 4),
      warnings: [],
      faq: [],
      testCases: [],
      releaseNotes: '',
      generatedAt: new Date().toISOString(),
    };
  }

  private buildFallbackDoc(page: PageMetadata): PageDocumentation {
    const actions = page.buttons.map(b => b.text).filter(Boolean);
    const navLinks = page.navigationLinks.map(n => n.text).filter(Boolean);
    const features: string[] = [
      ...actions.slice(0, 10).map(a => `${a}: Select this button to perform the "${a}" action.`),
      ...(page.tabs && page.tabs.length > 0 ? [`Tabs: Navigate between ${page.tabs.slice(0, 5).join(', ')}.`] : []),
      ...page.inputs.map(i => `${i.label || i.placeholder || i.type} field: Enter the required information here.`).slice(0, 5),
      ...(page.tables.length > 0 ? [`Data table with columns: ${page.tables[0].headers.join(', ')} ${page.tables[0].actions?.length ? `and actions: ${page.tables[0].actions.join(', ')}` : ''}`] : []),
      ...(page.searchFields.length > 0 ? ['Search: Use the search field to quickly find records.'] : []),
      ...(page.pagination ? ['Pagination: Use the page controls to move between pages of results.'] : []),
    ];
    return {
      pageId: uuidv4(),
      url: page.url,
      title: page.title,
      screenshotPath: page.screenshotPath,
      overview: `The ${page.title} page allows you to manage and work with the information shown below.`,
      whenToUse: `Visit this page when you need to work with ${page.title.toLowerCase()} as part of your daily tasks.`,
      beforeYouBegin: 'No special preparation is needed. Simply navigate to this page and follow the steps below.',
      features: features.length > 0 ? features : ['This page contains content for your daily work.'],
      userGuide: [
        `**How to Get Here**\nNavigate to this page via: ${page.url}`,
        actions.length > 0 ? `**Available Actions**\n${actions.slice(0, 8).map((a, i) => `${i + 1}. Select **${a}**.`).join('\n')}` : '',
        navLinks.length > 0 ? `**Navigation**\nFrom here you can go to: ${navLinks.slice(0, 6).join(', ')}` : '',
      ].filter(Boolean).join('\n\n'),
      tips: ['Take your time to review all information before saving or submitting.'],
      commonMistakes: ['Make sure all required fields are filled in before selecting Save or Submit.'],
      afterCompletion: navLinks.length > 0 ? `After completing your task, you can continue to: ${navLinks.slice(0, 3).join(', ')}.` : 'Return to the main menu or navigate to your next task.',
      relatedTasks: navLinks.slice(0, 4).map(n => `${n}: Continue your workflow here.`),
      warnings: [],
      faq: [],
      testCases: [],
      releaseNotes: '',
      developerNotes: undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildFallbackGettingStarted(pages: PageMetadata[]): string {
    const lines = ['## Getting Started', '', 'This guide will help you navigate the application.', '', '### Available Pages', ''];
    for (const page of pages) {
      lines.push(`**${page.title}** — ${page.url}`);
      const actions = page.buttons.map(b => b.text).filter(Boolean).slice(0, 5);
      if (actions.length > 0) lines.push(`Available actions: ${actions.join(', ')}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC — Persistence and retrieval
  // ─────────────────────────────────────────────────────────────────────────────

  async persistDocs(projectId: string, docs: ProjectDocumentation, workflows?: IWorkflow[], rawPages?: PageMetadata[]): Promise<void> {
    const project = this.db.getDb().prepare('SELECT storage_path FROM projects WHERE id = ?').get(projectId) as { storage_path: string } | undefined;
    if (!project) return;

    const docsDir = join(project.storage_path, 'docs');
    ensureDir(docsDir);

    writeFileSync(join(docsDir, 'documentation.json'), JSON.stringify(docs, null, 2));
    writeFileSync(join(docsDir, 'documentation.md'), this.buildMarkdown(docs));

    const now = new Date().toISOString();

    // Replace previous documentation — keep only the latest generation
    this.db.getDb().prepare('DELETE FROM documentation WHERE project_id = ?').run(projectId);
    this.db.getDb().prepare('DELETE FROM workflows WHERE project_id = ?').run(projectId);

    const stmt = this.db.getDb().prepare(`
      INSERT INTO documentation (id, project_id, page_id, type, content, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), projectId, null, 'project', JSON.stringify(docs), now);
    for (const page of docs.pages) {
      stmt.run(uuidv4(), projectId, page.pageId, 'page', JSON.stringify(page), now);
    }

    // Persist raw page metadata — upsert by (project_id, url) for scoped re-generation
    if (rawPages && rawPages.length > 0) {
      const existingStmt = this.db.getDb().prepare(
        'SELECT id FROM pages WHERE project_id = ? AND url = ?',
      );
      const insertStmt = this.db.getDb().prepare(`
        INSERT INTO pages (id, project_id, url, title, metadata, screenshot_path, visited_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStmt = this.db.getDb().prepare(`
        UPDATE pages SET title = ?, metadata = ?, screenshot_path = ?, visited_at = ?
        WHERE project_id = ? AND url = ?
      `);

      for (const p of rawPages) {
        const existing = existingStmt.get(projectId, p.url) as { id: string } | undefined;
        if (existing) {
          updateStmt.run(p.title, JSON.stringify(p), p.screenshotPath ?? null, p.visitedAt, projectId, p.url);
        } else {
          insertStmt.run(uuidv4(), projectId, p.url, p.title, JSON.stringify(p), p.screenshotPath ?? null, p.visitedAt);
        }
      }
    }

    if (workflows && workflows.length > 0) {
      const wfStmt = this.db.getDb().prepare(`
        INSERT INTO workflows (id, project_id, name, description, steps, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const wf of workflows) {
        wfStmt.run(wf.id, projectId, wf.name, wf.description, JSON.stringify(wf.steps), wf.createdAt);
      }
      this.db.getDb().prepare('UPDATE projects SET workflow_count = ? WHERE id = ?').run(workflows.length, projectId);
      this.logger.log(`Persisted ${workflows.length} workflow(s) for project: ${projectId}`);
    }

    this.logger.log(`Documentation persisted for project: ${projectId}`);
  }

  /** Reads raw PageMetadata back from the pages table for scoped re-generation. */
  getPagesForProject(projectId: string): PageMetadata[] {
    const rows = this.db.getDb()
      .prepare('SELECT metadata, url FROM pages WHERE project_id = ? ORDER BY visited_at ASC')
      .all(projectId) as Array<{ metadata: string; url: string }>;

    // Deduplicate by URL (guards against legacy duplicate rows)
    const seen = new Set<string>();
    const pages: PageMetadata[] = [];
    for (const row of rows) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      pages.push(JSON.parse(row.metadata) as PageMetadata);
    }
    return pages;
  }

  /**
   * Runs scoped documentation generation for an already-crawled project.
   * Reads persisted page metadata and re-runs generation in the requested mode.
   */
  async runScopedGeneration(
    project: IProject,
    options: GenerateDocsOptions,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    const pages = this.getPagesForProject(project.id);
    if (pages.length === 0) {
      throw new Error(`No crawled pages found for project ${project.id}. Run a crawl first.`);
    }
    const { docs, workflows } = await this.generateProjectDocs(project, pages, onProgress, signal, options);
    await this.persistDocs(project.id, docs, workflows);
    return { docs, workflows };
  }

  async getProjectDocs(projectId: string): Promise<ProjectDocumentation | null> {
    const row = this.db.getDb().prepare(
      "SELECT content FROM documentation WHERE project_id = ? AND type = 'project' ORDER BY generated_at DESC LIMIT 1",
    ).get(projectId) as { content: string } | undefined;
    if (!row) return null;
    const docs = JSON.parse(row.content) as ProjectDocumentation;
    return this.enrichDocsWithScreenshots(projectId, docs);
  }

  /** Joins crawl screenshots onto docs — works for existing docs without re-generation */
  private enrichDocsWithScreenshots(projectId: string, docs: ProjectDocumentation): ProjectDocumentation {
    const crawled = this.getPagesForProject(projectId);
    if (crawled.length === 0) return docs;

    const byUrl = new Map(crawled.map(p => [p.url, p]));
    const byTitle = new Map(crawled.map(p => [p.title, p]));

    const pages = docs.pages.map(page => ({
      ...page,
      screenshotPath: page.screenshotPath ?? byUrl.get(page.url)?.screenshotPath,
    }));

    const workflowGuides = docs.workflowGuides?.map(guide => ({
      ...guide,
      stepScreenshots: guide.stepScreenshots?.length
        ? guide.stepScreenshots.map(step => ({
            ...step,
            screenshotPath: step.screenshotPath ?? byTitle.get(step.pageTitle)?.screenshotPath,
          }))
        : this.buildStepScreenshots(guide.pagetitles, byTitle),
    }));

    return { ...docs, pages, workflowGuides };
  }

  async getProjectWorkflows(projectId: string): Promise<IWorkflow[]> {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as Array<Record<string, unknown>>;
    return rows.map(row => ({
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      name: row['name'] as string,
      description: row['description'] as string,
      steps: JSON.parse(row['steps'] as string) as IWorkflow['steps'],
      videoPath: row['video_path'] as string | undefined,
      createdAt: row['created_at'] as string,
    }));
  }

  async getProjectDocsSummary(projectId: string): Promise<{ pageCount: number; generatedAt: string; generationMode?: DocGenerationMode } | null> {
    const row = this.db.getDb().prepare(
      "SELECT content FROM documentation WHERE project_id = ? AND type = 'project' ORDER BY generated_at DESC LIMIT 1",
    ).get(projectId) as { content: string } | undefined;
    if (!row) return null;
    const docs = JSON.parse(row.content) as ProjectDocumentation;
    return { pageCount: docs.pages.length, generatedAt: docs.generatedAt, generationMode: docs.generationMode };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE — Markdown builder
  // ─────────────────────────────────────────────────────────────────────────────

  private buildMarkdown(docs: ProjectDocumentation): string {
    const lines: string[] = [`# ${docs.projectName}`, '', '## Overview', docs.overview, ''];

    if (docs.workflowGuides && docs.workflowGuides.length > 0) {
      lines.push('## Workflow Guides', '');
      for (const guide of docs.workflowGuides) {
        lines.push(guide.content, '');
      }
    }

    if (docs.gettingStarted) {
      lines.push('## Getting Started', docs.gettingStarted, '');
    }

    if (docs.pages.length > 0) {
      lines.push('## Pages', '');
      for (const page of docs.pages) {
        if (page.templateRepresentativeUrl) {
          lines.push(`### ${page.title}`, `**URL:** ${page.url}`, `> This page shares the same layout as [${page.templateRepresentativeUrl}](#). See that section for full documentation.`, '');
          continue;
        }
        lines.push(`### ${page.title}`, `**URL:** ${page.url}`, '');
        lines.push('#### What Is This Page?', page.overview, '');
        if (page.whenToUse) lines.push('#### When Should You Use It?', page.whenToUse, '');
        if (page.beforeYouBegin) lines.push('#### Before You Begin', page.beforeYouBegin, '');
        if (page.features.length > 0) {
          lines.push('#### Understanding the Page');
          page.features.forEach(f => lines.push(`- ${f}`));
          lines.push('');
        }
        lines.push('#### How to Complete This Task', page.userGuide, '');
        if (page.tips.length > 0) {
          lines.push('#### Helpful Tips');
          page.tips.forEach(t => lines.push(`> 💡 ${t}`));
          lines.push('');
        }
        if (page.commonMistakes?.length > 0) {
          lines.push('#### Common Mistakes');
          page.commonMistakes.forEach(m => lines.push(`- ⚠️ ${m}`));
          lines.push('');
        }
        if (page.warnings.length > 0) {
          lines.push('#### Important Warnings');
          page.warnings.forEach(w => lines.push(`🚨 ${w}`));
          lines.push('');
        }
        if (page.afterCompletion) lines.push('#### After Completing This Task', page.afterCompletion, '');
        if (page.relatedTasks?.length > 0) {
          lines.push('#### Related Tasks');
          page.relatedTasks.forEach(r => lines.push(`- ${r}`));
          lines.push('');
        }
        if (page.faq.length > 0) {
          lines.push('#### Frequently Asked Questions');
          page.faq.forEach(item => { lines.push(`**Q: ${item.question}**`, `A: ${item.answer}`, ''); });
        }
      }
    }

    if (docs.faq.length > 0) {
      lines.push('## Frequently Asked Questions', '');
      docs.faq.forEach(item => { lines.push(`**Q: ${item.question}**`, `A: ${item.answer}`, ''); });
    }

    return lines.join('\n');
  }
}
