import { Injectable, Logger } from '@nestjs/common';
import { LmStudioProvider } from './providers/lm-studio.provider';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { PageDocumentation } from '../../common/interfaces/documentation.interface';
import { AiMessage } from '../../common/interfaces/ai-provider.interface';

/**
 * A compact application map built once before any page is documented.
 * Every per-page prompt receives this context so the AI understands
 * where each page sits in the overall business process.
 */
export interface AppMap {
  /** One sentence: what the application does and who uses it */
  appPurpose: string;
  /** Primary user roles identified across all pages */
  userRoles: string[];
  /** High-level modules/sections with their page titles */
  modules: Array<{ name: string; pages: string[] }>;
  /** Ordered sequences of page titles that form natural workflows */
  workflows: string[][];
  /** Flat lookup: page title → { previousPage, nextPage, module } */
  pageContext: Record<string, { previousPage: string | null; nextPage: string | null; module: string }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly lmStudio: LmStudioProvider) {}

  async isAvailable(): Promise<boolean> {
    return this.lmStudio.isAvailable();
  }

  /**
   * Step 1 — called ONCE before any page is documented.
   * Builds a shared application map so every subsequent page prompt
   * already knows: what the app does, what module the page belongs to,
   * which page comes before it, and which comes after.
   */
  async buildAppMap(projectName: string, pages: PageMetadata[]): Promise<AppMap> {
    this.logger.log(`Building application map for: ${projectName} (${pages.length} pages)`);

    const pageSummary = pages.map((p) => ({
      title: p.title,
      url: p.url,
      hasForm: p.forms.length > 0,
      hasTable: p.tables.length > 0,
      actions: p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5),
      navLinks: p.navigationLinks.map((n) => n.text).filter(Boolean).slice(0, 5),
    }));

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a business analyst building a structured map of a business application.
Your output will be used to give context to a documentation AI so it can write better, more connected documentation for business users.
Respond with valid JSON only. No markdown fences, no extra text.`,
      },
      {
        role: 'user',
        content: `Analyze this application called "${projectName}" and build an application map.

Pages:
${JSON.stringify(pageSummary, null, 2)}

Respond with this exact JSON structure:
{
  "appPurpose": "One clear sentence describing what this application does and who uses it in their daily work (e.g. business staff, insurance officers, customer service representatives)",
  "userRoles": ["Role 1", "Role 2"],
  "modules": [
    { "name": "Module Name", "pages": ["Page Title 1", "Page Title 2"] }
  ],
  "workflows": [
    ["First Page Title", "Second Page Title", "Third Page Title"]
  ],
  "pageContext": {
    "Page Title": { "previousPage": "Page Title or null", "nextPage": "Page Title or null", "module": "Module Name" }
  }
}

Rules:
- Only use page titles from the list above. Do not invent pages.
- workflows: return an empty array [] — real workflows are detected separately from crawl navigation paths.
- pageContext must have an entry for EVERY page title in the list
- previousPage and nextPage reflect the natural workflow order — use null if there is none`,
      },
    ];

    try {
      const result = await this.lmStudio.complete(messages, { maxTokens: 2000 });
      const parsed = this.parseJsonResponse<AppMap>(result.content);

      // Ensure every page has a pageContext entry (fill gaps if AI missed any)
      for (const p of pages) {
        if (!parsed.pageContext[p.title]) {
          parsed.pageContext[p.title] = { previousPage: null, nextPage: null, module: 'General' };
        }
      }

      this.logger.log(`App map built: ${parsed.modules.length} modules, ${parsed.workflows.length} workflows`);
      return parsed;
    } catch (error) {
      this.logger.warn(`App map build failed: ${(error as Error).message} — using minimal fallback`);
      return this.buildFallbackAppMap(projectName, pages);
    }
  }

  /** Minimal app map when AI is unavailable — derived purely from metadata */
  buildFallbackAppMapPublic(projectName: string, pages: PageMetadata[]): AppMap {
    return this.buildFallbackAppMap(projectName, pages);
  }

  /** Minimal app map when AI is unavailable — derived purely from metadata */
  private buildFallbackAppMap(projectName: string, pages: PageMetadata[]): AppMap {
    const pageContext: AppMap['pageContext'] = {};
    for (let i = 0; i < pages.length; i++) {
      pageContext[pages[i].title] = {
        previousPage: i > 0 ? pages[i - 1].title : null,
        nextPage: i < pages.length - 1 ? pages[i + 1].title : null,
        module: pages[i].navigationPath[0] ?? 'General',
      };
    }
    return {
      appPurpose: `${projectName} is a business application used by staff to manage daily tasks.`,
      userRoles: ['Staff', 'Manager'],
      modules: [{ name: 'Application', pages: pages.map((p) => p.title) }],
      workflows: pages.length >= 2 ? [pages.slice(0, 3).map((p) => p.title)] : [],
      pageContext,
    };
  }

  /**
   * Step 2 — called once per page, enriched with the app map.
   *
   * Two-pass approach to preserve full documentation quality without truncation:
   *   Pass 1 — all structured short fields (overview, features, tips, FAQ, etc.)
   *   Pass 2 — userGuide as a dedicated call with its full token budget
   *
   * This means the rich trainer-style userGuide never competes for tokens with
   * the other fields, and neither pass risks hitting the token limit.
   */
  async generatePageDocumentation(metadata: PageMetadata, appMap: AppMap): Promise<PageDocumentation> {
    this.logger.log(`Generating documentation for: ${metadata.title} (${metadata.url})`);

    const pageContext = this.buildPageContext(metadata);
    const ctx = appMap.pageContext[metadata.title];
    const workflow = appMap.workflows.find((wf) => wf.includes(metadata.title));

    const appContextBlock = [
      `Application: ${appMap.appPurpose}`,
      `Module: ${ctx?.module ?? 'General'}`,
      ctx?.previousPage ? `Users arrive from: ${ctx.previousPage}` : null,
      ctx?.nextPage ? `Users go next to: ${ctx.nextPage}` : null,
      workflow ? `Workflow: ${workflow.join(' → ')}` : null,
    ].filter(Boolean).join('\n');

    const sharedSystemPrompt = `You are GuideGen AI, an intelligent documentation and training assistant.

Your audience is NOT software developers. Your audience includes new employees, customer service representatives, insurance officers, sales staff, managers, supervisors, and administrative staff who may have limited technical knowledge.

Rules:
- Document ONLY features visible in the provided page data. Never invent anything.
- Write in plain, friendly, encouraging language. Short sentences. No jargon.
- Always explain the PURPOSE of each action — not just what it is, but what it does for the user.
- Use the APPLICATION CONTEXT to connect this page to the broader workflow.
- Respond with valid, complete JSON only. No markdown fences. No text after the closing brace.`;

    // ── Pass 1: Structured fields (always fits within token budget) ─────────────
    const pass1Prompt = `Document this web page for a new business user.

=== APPLICATION CONTEXT ===
${appContextBlock}
=== PAGE DATA ===
${pageContext}
===

Respond with ONLY this JSON — complete and valid, no trailing text:
{
  "overview": "2-3 friendly sentences: what this page is, what business task it supports, who uses it, where they come from and where they go next.",
  "whenToUse": "Describe the real work situations when a user would visit this page. Reference the workflow it belongs to.",
  "beforeYouBegin": "What information or preparation does the user need before starting? If nothing special, reassure them.",
  "features": [
    "Element Name: one sentence explaining what it helps the user accomplish — not what it is technically, but what it does FOR them. Cover every button, form, table, filter, search field, card, and navigation link present."
  ],
  "tips": [
    "A practical tip that makes daily work easier or faster on this page.",
    "A best practice that helps users avoid common confusion."
  ],
  "commonMistakes": [
    "A common mistake new users make on this page and how to avoid or recover from it.",
    "Another frequent error — explain it in a reassuring, non-judgmental way."
  ],
  "afterCompletion": "Exactly what the user should do after finishing this page. Name the next page in the workflow.",
  "relatedTasks": [
    "Related page or task — one sentence explaining why the user might need it."
  ],
  "warnings": [
    "Only include if there are destructive or irreversible actions (delete, reset). Explain what cannot be undone."
  ],
  "faq": [
    {"question": "A realistic question a new employee would ask about this page.", "answer": "A clear, reassuring answer referencing actual features."},
    {"question": "Another realistic question.", "answer": "A clear, reassuring answer."},
    {"question": "A third question about a common task or concern.", "answer": "A clear, reassuring answer."}
  ]
}`;

    // ── Pass 2: userGuide — dedicated call, full token budget ───────────────────
    const pass2Prompt = `Write a step-by-step task guide for this web page, in the style of an experienced trainer speaking to a new employee on their first day.

=== APPLICATION CONTEXT ===
${appContextBlock}
=== PAGE DATA ===
${pageContext}
===

Structure your guide with these exact sections:

**How to Get Here**
Simple navigation instructions. Mention the previous page in the workflow if there is one.

**What You Will See**
A friendly, reassuring description of the page layout when the user arrives. Help them feel oriented.

**How to Complete Your Task**
Numbered steps for each main task on this page. For each step:
- Say exactly what to do (name the button, field, or link)
- Explain why it matters
- Describe what happens after

**What Happens Next**
Explain what comes after the main action — confirmation messages, where the data goes, and the next page in the workflow.

**Common Tasks**
If there are multiple distinct tasks on this page (e.g. both searching AND creating), give numbered steps for each separately.

Write in plain, warm, encouraging language. Short sentences. Name every button and field exactly as it appears. Make a nervous new employee feel confident they can do this.

Respond with ONLY this JSON — complete and valid, no trailing text:
{"userGuide": "Your full guide here as a single string. Use \\n\\n between sections and \\n between steps."}`;

    // Run both passes sequentially — LM Studio processes one inference at a time.
    // Promise.all would queue them and risk timeouts on a local single-GPU model.
    const pass1Result = await this.lmStudio.complete(
      [{ role: 'system', content: sharedSystemPrompt }, { role: 'user', content: pass1Prompt }],
      { maxTokens: 2000 },
    );
    const pass2Result = await this.lmStudio.complete(
      [{ role: 'system', content: sharedSystemPrompt }, { role: 'user', content: pass2Prompt }],
      { maxTokens: 2000 },
    );

    const pass1 = this.parseJsonResponse<Omit<PageDocumentation, 'pageId' | 'url' | 'title' | 'userGuide' | 'generatedAt' | 'testCases' | 'releaseNotes' | 'developerNotes'>>(pass1Result.content);
    const pass2 = this.parseJsonResponse<{ userGuide: string }>(pass2Result.content);

    return {
      pageId: '',
      url: metadata.url,
      title: metadata.title,
      overview: pass1.overview ?? '',
      whenToUse: pass1.whenToUse ?? '',
      beforeYouBegin: pass1.beforeYouBegin ?? '',
      features: pass1.features ?? [],
      userGuide: pass2.userGuide ?? '',
      tips: pass1.tips ?? [],
      commonMistakes: pass1.commonMistakes ?? [],
      afterCompletion: pass1.afterCompletion ?? '',
      relatedTasks: pass1.relatedTasks ?? [],
      warnings: pass1.warnings ?? [],
      faq: pass1.faq ?? [],
      testCases: [],
      releaseNotes: '',
      developerNotes: undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Converts raw page metadata into a detailed human-readable context string.
   * Includes all discovered UI elements so the AI can document everything.
   */
  private buildPageContext(metadata: PageMetadata): string {
    const lines: string[] = [];

    lines.push(`Title: ${metadata.title}`);
    lines.push(`URL: ${metadata.url}`);

    if (metadata.breadcrumbs.length > 0) {
      lines.push(`Breadcrumbs: ${metadata.breadcrumbs.join(' > ')}`);
    }

    if (metadata.navigationPath.length > 0) {
      lines.push(`Navigation path: ${metadata.navigationPath.join(' > ')}`);
    }

    if (metadata.textSections.length > 0) {
      lines.push(`Page headings: ${metadata.textSections.slice(0, 15).join(', ')}`);
    }

    const buttonTexts = metadata.buttons
      .map((b) => b.text)
      .filter((t) => t.trim().length > 1)
      .slice(0, 30);
    if (buttonTexts.length > 0) {
      lines.push(`Buttons and actions: ${buttonTexts.join(', ')}`);
    }

    if (metadata.inputs.length > 0) {
      const inputDesc = metadata.inputs
        .map((i) => [i.label, i.placeholder, i.type].filter(Boolean).join('/'))
        .filter(Boolean)
        .slice(0, 20);
      lines.push(`Input fields: ${inputDesc.join(', ')}`);
    }

    if (metadata.tables.length > 0) {
      const tableDesc = metadata.tables
        .map((t) => `table[${t.headers.join(', ')}](${t.rowCount} rows)`)
        .join('; ');
      lines.push(`Data tables: ${tableDesc}`);
    }

    if (metadata.forms.length > 0) {
      lines.push(`Forms: ${metadata.forms.join(', ')}`);
    }

    if (metadata.searchFields.length > 0) {
      lines.push(`Search fields: ${metadata.searchFields.join(', ')}`);
    }

    if (metadata.filters.length > 0) {
      lines.push(`Filters: ${metadata.filters.slice(0, 8).join(', ')}`);
    }

    if (metadata.dropdowns.length > 0) {
      lines.push(`Dropdowns: ${metadata.dropdowns.slice(0, 8).join(', ')}`);
    }

    const navLinks = metadata.navigationLinks
      .map((n) => n.text)
      .filter((t) => t.trim().length > 1)
      .slice(0, 20);
    if (navLinks.length > 0) {
      lines.push(`Navigation links: ${navLinks.join(', ')}`);
    }

    if (metadata.cards.length > 0) {
      lines.push(`Cards/panels: ${metadata.cards.slice(0, 15).join(', ')}`);
    }

    if (metadata.charts.length > 0) {
      lines.push(`Charts/graphs: ${metadata.charts.join(', ')}`);
    }

    if (metadata.dialogs.length > 0) {
      lines.push(`Dialogs/modals: ${metadata.dialogs.join(', ')}`);
    }

    if (metadata.pagination) lines.push('Pagination: yes');

    return lines.join('\n');
  }

  async generateProjectOverview(
    projectName: string,
    url: string,
    pages: PageMetadata[],
    appMap: AppMap,
  ): Promise<string> {
    const pageList = pages
      .slice(0, 30)
      .map((p) => {
        const buttons = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5).join(', ');
        const hasTable = p.tables.length > 0 ? ' [has data tables]' : '';
        const hasForms = p.forms.length > 0 ? ' [has forms]' : '';
        return `- ${p.title} (${p.url})${hasTable}${hasForms}${buttons ? ` — actions: ${buttons}` : ''}`;
      })
      .join('\n');

    const moduleSummary = appMap.modules
      .map((m) => `${m.name}: ${m.pages.join(', ')}`)
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are GuideGen AI, an intelligent documentation and training assistant. Your audience is ordinary business users — new employees, customer service staff, insurance officers, sales staff, and managers with limited technical knowledge.

Write in plain, warm, encouraging language. Make the user feel confident. Never use technical jargon. Do NOT invent features not listed in the page data provided.`,
      },
      {
        role: 'user',
        content: `Write a welcoming, friendly overview of a business application called "${projectName}" at ${url} for new employees who have never used it before.

Application purpose: ${appMap.appPurpose}
User roles: ${appMap.userRoles.join(', ')}

Application modules:
${moduleSummary}

All pages:
${pageList}

Write 3-4 paragraphs covering:
1. What this application is, what business purpose it serves, and who uses it in their daily work
2. The main modules and what each one helps staff accomplish
3. The key tasks users can complete — describe them in terms of real work (register a customer, create a policy, submit a claim) not technical features
4. How the modules connect as part of the daily workflow

Write like an experienced colleague welcoming someone on their first day. Be encouraging, clear, and practical.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 1000 });
    return result.content;
  }

  async generateGettingStarted(pages: PageMetadata[], appMap: AppMap): Promise<string> {
    const pageSummaries = pages
      .slice(0, 25)
      .map((p, idx) => {
        const actions = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5).join(', ');
        const extras: string[] = [];
        if (p.tables.length > 0) extras.push(`${p.tables.length} table(s)`);
        if (p.forms.length > 0) extras.push(`${p.forms.length} form(s)`);
        if (p.searchFields.length > 0) extras.push('search');
        let line = `${idx + 1}. ${p.title}`;
        if (actions) line += ` — actions: ${actions}`;
        if (extras.length > 0) line += ` [${extras.join(', ')}]`;
        return line;
      })
      .join('\n');

    const workflowSummary = appMap.workflows
      .map((wf, i) => `Workflow ${i + 1}: ${wf.join(' → ')}`)
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are GuideGen AI, an intelligent documentation and training assistant. Your audience is ordinary business users who may have limited technical knowledge.

Write like an experienced trainer on someone's first day. Be warm, encouraging, clear, and practical. Use short sentences. Avoid jargon. Make the reader feel confident. Only reference pages and features from the data provided.`,
      },
      {
        role: 'user',
        content: `Write a complete "Getting Started" guide for a new employee using this application for the first time.

Application: ${appMap.appPurpose}
User roles: ${appMap.userRoles.join(', ')}

Common workflows:
${workflowSummary}

Pages:
${pageSummaries}

Structure the guide as:

## Welcome
Warm, friendly welcome that explains what this application helps staff do in their daily work.

## Before You Begin
Login steps or information the user should have ready.

## Your First Steps
Numbered walkthrough of what a new user should do in their first session. Reference actual pages and workflows above.

## Navigating the Application
Explain the main sections. Help the user build a mental map using the modules and workflows above.

## Key Tasks
Step-by-step instructions for the 4-5 most common daily tasks. Reference the workflows above.

## If You Need Help
Short, reassuring closing about what to do if something goes wrong.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 2000 });
    return result.content;
  }

  /**
   * No longer makes a separate AI call — workflows were already identified in buildAppMap.
   * This method converts the app map workflow arrays into the format expected by the caller.
   */
  extractWorkflowsFromAppMap(appMap: AppMap): string[][] {
    return appMap.workflows;
  }

  /**
   * Generates a single continuous end-to-end walkthrough for a named workflow.
   * Unlike per-page docs, this produces ONE guide that narrates the entire journey
   * from the first page to the last, written as a coherent trainer-style document.
   * Used by "deep dive" / workflow-scoped generation mode.
   */
  async generateWorkflowGuide(
    workflowName: string,
    pages: PageMetadata[],
    appMap: AppMap,
  ): Promise<string> {
    this.logger.log(`Generating workflow guide: "${workflowName}" (${pages.length} pages)`);

    const pagesContext = pages.map((p, idx) => {
      const actions = p.buttons.map(b => b.text).filter(Boolean).slice(0, 8).join(', ');
      const inputs = p.inputs.map(i => i.label || i.placeholder || i.type).filter(Boolean).slice(0, 6).join(', ');
      const tables = p.tables.map(t => `table[${t.headers.slice(0, 5).join(', ')}]`).join('; ');
      const forms = p.forms.slice(0, 3).join(', ');
      return [
        `Step ${idx + 1}: ${p.title} (${p.url})`,
        actions ? `  Actions: ${actions}` : '',
        inputs ? `  Inputs: ${inputs}` : '',
        tables ? `  Tables: ${tables}` : '',
        forms ? `  Forms: ${forms}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are GuideGen AI, an intelligent documentation and training assistant.

Your mission is to write a complete end-to-end walkthrough that guides a new business user through an entire workflow — from beginning to end — as one continuous, coherent document.

Your audience: new employees, customer service staff, insurance officers, sales staff, managers.
Write like an experienced trainer on someone's first day. Warm, encouraging, clear, practical. Short sentences. No jargon.
Cover every step in the workflow. Tell the user exactly what to do on each page, what to expect, and how to move to the next step.`,
      },
      {
        role: 'user',
        content: `Write a complete end-to-end guide for this workflow: "${workflowName}"

Application: ${appMap.appPurpose}

Pages in this workflow (in order):
${pagesContext}

Structure your guide as:

## ${workflowName} — Complete Guide

### Overview
What is this workflow? Why does a staff member need to complete it? What is the outcome when finished?

### Before You Start
What information does the user need to have ready before beginning?

### Step-by-Step Walkthrough
For each page in order, write a section:

#### Step [N]: [Page Title]
- What they see when they arrive
- Exactly what to fill in or select (name every field and button)
- What happens when they proceed to the next step

### After You Finish
What happens when the workflow is complete? Where does the data go? What should the user do next?

### Common Problems
2-3 things that often go wrong in this workflow and how to fix them.

Write as a single flowing document. Make a nervous new employee feel they can complete this confidently.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 3000 });
    return result.content;
  }

  /**
   * Generates a lightweight system overview without per-page AI calls.
   * Used by "overview" / quick-scan mode — gives a high-level picture of the
   * application in 1 AI call instead of 2N calls (N pages × 2 passes each).
   */
  async generateQuickOverview(
    projectName: string,
    url: string,
    appMap: AppMap,
    pages: PageMetadata[],
  ): Promise<string> {
    this.logger.log(`Generating quick overview for: ${projectName}`);

    const moduleSummary = appMap.modules
      .map(m => `${m.name}: ${m.pages.join(', ')}`)
      .join('\n');

    const workflowSummary = appMap.workflows
      .map((wf, i) => `Workflow ${i + 1} — ${wf.join(' → ')}`)
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are GuideGen AI. Write a clear, welcoming overview of a business application for new staff.
Plain language. Encouraging tone. Focus on what staff can DO, not technical details.`,
      },
      {
        role: 'user',
        content: `Write a complete "Application Overview" document for "${projectName}" (${url}).

Application purpose: ${appMap.appPurpose}
User roles: ${appMap.userRoles.join(', ')}
Total pages: ${pages.length}

Modules and their pages:
${moduleSummary}

Common workflows:
${workflowSummary}

Structure as:

## Welcome to ${projectName}
3-4 sentences welcoming new staff and explaining what this application helps them do.

## What You Can Do Here
For each module, one paragraph explaining what staff accomplish in that area.

## Common Tasks
For each workflow above, 3-4 bullet points summarising the steps at a high level.

## Getting Around
How to navigate between the main areas. Which pages to start with on day one.

Keep it concise. This is a quick orientation, not a detailed manual.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 1500 });
    return result.content;
  }

  async generateFaq(pages: PageMetadata[], appMap: AppMap): Promise<Array<{ question: string; answer: string }>> {
    const appContext = pages
      .slice(0, 20)
      .map((p) => {
        const actions = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 6).join(', ');
        const inputs = p.inputs.map((i) => i.label || i.placeholder || i.type).filter(Boolean).slice(0, 4).join(', ');
        const parts = [p.title];
        if (actions) parts.push(`Actions: ${actions}`);
        if (inputs) parts.push(`Inputs: ${inputs}`);
        if (p.searchFields.length > 0) parts.push('Has search');
        if (p.tables.length > 0) parts.push(`Table columns: ${p.tables[0].headers.slice(0, 4).join(', ')}`);
        return parts.join(' | ');
      })
      .join('\n');

    const workflowSummary = appMap.workflows
      .map((wf) => wf.join(' → '))
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are GuideGen AI, an intelligent documentation and training assistant. You are writing an FAQ for business users — new employees, customer service staff, insurance officers, sales staff, and managers with limited technical knowledge.

Write questions the way a nervous new employee would actually ask them. Write answers that are clear, reassuring, and practical. Use plain language. Never use technical jargon. Only reference features that are listed. Respond with valid JSON only.`,
      },
      {
        role: 'user',
        content: `Generate 10-12 FAQ entries for this business application, written for new staff members learning the system for the first time.

Application: ${appMap.appPurpose}
Common workflows:
${workflowSummary}

Pages and features:
${appContext}

Include these types of questions:
- "How do I [complete a common daily task from the workflows above]?" — with numbered steps
- "What does [page name] do? When would I use it?"
- "Where do I go to [find or do something]?"
- "What happens if I make a mistake? How do I fix it?"
- "Do I need to save my work? What if I forget?"
- How to use search, filters, and tables

Write answers that are warm and encouraging, as if a colleague is explaining it patiently.

Respond with JSON only:
{
  "faq": [
    {"question": "...", "answer": "..."}
  ]
}`,
      },
    ];

    try {
      const result = await this.lmStudio.complete(messages, { maxTokens: 2000 });
      const parsed = this.parseJsonResponse<{ faq: Array<{ question: string; answer: string }> }>(
        result.content,
      );
      return parsed.faq ?? [];
    } catch (error) {
      this.logger.warn(`FAQ generation failed: ${(error as Error).message}`);
      return [];
    }
  }

  private parseJsonResponse<T>(content: string): T {
    // Strip markdown code fences if present
    let cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    // Find the first { — discard any preamble the model added
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON object found in AI response');
    cleaned = cleaned.slice(start);

    // Sanitize bare control characters inside string literals before parsing
    cleaned = this.sanitizeJsonControlChars(cleaned);

    // Try parsing as-is first (happy path)
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Fall through to repair attempts
    }

    // Repair attempt 1: truncate at the last valid closing brace.
    // Handles "Unexpected non-whitespace character after JSON" (trailing garbage).
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1) {
      try {
        return JSON.parse(cleaned.slice(0, lastBrace + 1)) as T;
      } catch {
        // Fall through to repair attempt 2
      }
    }

    // Repair attempt 2: the response was truncated mid-JSON (hit token limit).
    // Close all open brackets/braces so the parser can recover partial data.
    try {
      const repaired = this.repairTruncatedJson(cleaned);
      return JSON.parse(repaired) as T;
    } catch (finalError) {
      throw new Error(`JSON parse failed after repair attempts: ${(finalError as Error).message}`);
    }
  }

  /**
   * Attempts to close a truncated JSON string by tracking open brackets/braces
   * and string state, then appending the necessary closing characters.
   * This recovers partial responses when the model hits the token limit mid-output.
   */
  private repairTruncatedJson(raw: string): string {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    let lastValidPos = 0;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];

      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }

      if (ch === '"') {
        inString = !inString;
        if (!inString) lastValidPos = i + 1;
        continue;
      }

      if (inString) continue;

      if (ch === '{' || ch === '[') {
        stack.push(ch === '{' ? '}' : ']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0) {
          stack.pop();
          lastValidPos = i + 1;
        }
      } else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t' && ch !== ',' && ch !== ':') {
        // Non-structural character outside a string — track as potentially valid
      }
    }

    // If we ended inside a string, close it first
    let result = inString ? raw.slice(0, lastValidPos) + '"' : raw.trimEnd();

    // Remove trailing comma before we close (invalid JSON)
    result = result.replace(/,\s*$/, '');

    // Close all open structures in reverse order
    for (let i = stack.length - 1; i >= 0; i--) {
      result += stack[i];
    }

    return result;
  }

  /**
   * Walks a raw JSON string and fixes two classes of problems inside string literals:
   *
   * 1. Bare control characters (U+0000–U+001F) — real newlines/tabs the LLM emits
   *    inside JSON string values instead of the escape sequences \n / \t.
   *
   * 2. Unescaped double-quotes inside string values — e.g. the model writes
   *    "overview": "Welcome to the "Yene" shop" which breaks the JSON parser with
   *    "Expected ',' or '}' after property value".
   *
   * We can fix both safely because we track string boundaries exactly.
   */
  private sanitizeJsonControlChars(raw: string): string {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const code = raw.charCodeAt(i);

      // Currently processing the character after a backslash
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      // A backslash inside a string — next character is an escape sequence
      if (ch === '\\' && inString) {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        if (!inString) {
          // Opening quote — entering a string
          inString = true;
          result += ch;
          continue;
        }

        // We're inside a string and hit a `"`. Determine if this is the
        // legitimate closing quote or an unescaped quote within the value.
        //
        // A closing quote is followed (after optional whitespace) by one of:
        //   , } ] : (structural JSON characters)
        // An unescaped inner quote is followed by more string content.
        //
        // Look ahead past whitespace to decide.
        let lookahead = i + 1;
        while (lookahead < raw.length && (raw[lookahead] === ' ' || raw[lookahead] === '\t')) {
          lookahead++;
        }
        const nextMeaningful = lookahead < raw.length ? raw[lookahead] : '';
        const isClosingQuote = nextMeaningful === ',' || nextMeaningful === '}' ||
                               nextMeaningful === ']' || nextMeaningful === ':' ||
                               nextMeaningful === '' || nextMeaningful === '\n' ||
                               nextMeaningful === '\r';

        if (isClosingQuote) {
          inString = false;
          result += ch;
        } else {
          // Inner unescaped quote — escape it
          result += '\\"';
        }
        continue;
      }

      // Bare control character inside a string value
      if (inString && code < 0x20) {
        switch (ch) {
          case '\n': result += '\\n'; break;
          case '\r': result += '\\r'; break;
          case '\t': result += '\\t'; break;
          default:   result += `\\u${code.toString(16).padStart(4, '0')}`; break;
        }
        continue;
      }

      result += ch;
    }

    return result;
  }
}
