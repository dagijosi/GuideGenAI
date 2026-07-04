import { Injectable, Logger } from '@nestjs/common';
import { LmStudioProvider } from './providers/lm-studio.provider';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { PageDocumentation } from '../../common/interfaces/documentation.interface';
import { AiMessage } from '../../common/interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly lmStudio: LmStudioProvider) {}

  async isAvailable(): Promise<boolean> {
    return this.lmStudio.isAvailable();
  }

  async generatePageDocumentation(metadata: PageMetadata): Promise<PageDocumentation> {
    this.logger.log(`Generating documentation for: ${metadata.title} (${metadata.url})`);

    // Build a compact, factual description of what was actually found on the page
    const pageContext = this.buildPageContext(metadata);

    const systemPrompt = `You are an expert technical documentation writer creating a comprehensive user guide for a web application.

Your goal is to help end users understand and use this page effectively.

Rules:
- Document ONLY what is in the provided page data. Never invent or assume features.
- Write in plain language suitable for non-technical users.
- Be thorough — cover every button, form, table, filter, and navigation element present.
- Be actionable — give step-by-step instructions, not just descriptions.
- Respond with valid JSON only. No markdown fences, no extra text.`;

    const userPrompt = `Create detailed documentation for this web page based ONLY on the data below.

=== PAGE DATA ===
${pageContext}
=== END ===

Respond with this JSON structure:
{
  "overview": "2-3 sentences explaining what this page is for, what users can accomplish here, and when they would visit it",
  "features": [
    "Feature Name: detailed description of what it does and how to use it",
    "Include ALL buttons, forms, inputs, tables, filters, search fields, navigation links, charts, and cards present"
  ],
  "userGuide": "Detailed step-by-step guide structured as:\\n\\n**Getting Here**\\nHow to navigate to this page.\\n\\n**Page Layout**\\nWhat the user sees when they arrive.\\n\\n**Common Tasks**\\nNumbered steps for each major task available on this page. Be specific: name the exact buttons to click, fields to fill, and what happens next.\\n\\n**Working with [main feature]**\\nIf the page has tables, forms, or complex features, explain them in detail.",
  "tips": [
    "Practical tip that saves time or helps users get the most out of this page",
    "Best practice or shortcut specific to features on this page"
  ],
  "warnings": [
    "Warning about any destructive actions (delete, remove, reset) — mention what cannot be undone",
    "Common mistake users make and how to avoid it"
  ],
  "faq": [
    {"question": "Specific question a user might have about this page", "answer": "Clear complete answer referencing actual features on this page"}
  ],
  "testCases": [
    "Verify [specific feature from this page] by [concrete action] — expected: [result]"
  ],
  "releaseNotes": "",
  "developerNotes": ""
}`;

    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 3000 });
    const parsed = this.parseJsonResponse<Omit<PageDocumentation, 'pageId' | 'url' | 'title' | 'generatedAt'>>(result.content);

    return {
      pageId: '',
      url: metadata.url,
      title: metadata.title,
      overview: parsed.overview ?? '',
      features: parsed.features ?? [],
      userGuide: parsed.userGuide ?? '',
      tips: parsed.tips ?? [],
      warnings: parsed.warnings ?? [],
      faq: parsed.faq ?? [],
      testCases: parsed.testCases ?? [],
      releaseNotes: parsed.releaseNotes ?? '',
      developerNotes: parsed.developerNotes,
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

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a technical writer. Write a clear, informative overview of a web application based ONLY on the pages provided. Do NOT invent features not listed.`,
      },
      {
        role: 'user',
        content: `Write a 3-4 paragraph overview for a web application called "${projectName}" at ${url}.

These are the actual pages discovered in the application:
${pageList}

Your overview should cover:
1. What the application is and who it's for
2. The main areas/modules of the application
3. Key capabilities users have access to
4. How the sections work together

Base everything strictly on the pages listed above.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 1000 });
    return result.content;
  }

  async generateGettingStarted(pages: PageMetadata[]): Promise<string> {
    const pageSummaries = pages
      .slice(0, 25)
      .map((p, idx) => {
        const actions = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 6).join(', ');
        const nav = p.navigationLinks.map((n) => n.text).filter(Boolean).slice(0, 6).join(', ');
        const extras: string[] = [];
        if (p.tables.length > 0) extras.push(`${p.tables.length} data table(s)`);
        if (p.forms.length > 0) extras.push(`${p.forms.length} form(s)`);
        if (p.searchFields.length > 0) extras.push('search');

        let line = `${idx + 1}. ${p.title} (${p.url})`;
        if (actions) line += `\n   Actions: ${actions}`;
        if (nav) line += `\n   Navigation: ${nav}`;
        if (extras.length > 0) line += `\n   Contains: ${extras.join(', ')}`;
        return line;
      })
      .join('\n\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are an expert technical writer. Create a comprehensive "Getting Started" guide for new users of a web application. Be practical, clear, and thorough. Only reference pages and features from the list provided.`,
      },
      {
        role: 'user',
        content: `Write a comprehensive "Getting Started" guide for new users of this web application.

Pages and their features:
${pageSummaries}

Structure the guide as:

## Welcome
Brief explanation of what the application does and who it's for.

## Before You Begin
Any setup or prerequisites (login, account setup, etc.)

## Your First Steps
Step-by-step walkthrough for a new user's first session — what to do first, second, third.

## Navigating the Application
Explain the main sections and how to move between them.

## Key Tasks
Step-by-step instructions for the 4-6 most common things users need to do.

## Next Steps
Pointers to more advanced features once users are comfortable.

Only reference pages and features from the list above.`,
      },
    ];

    const result = await this.lmStudio.complete(messages, { maxTokens: 2000 });
    return result.content;
  }

  async detectWorkflows(pages: PageMetadata[]): Promise<string[][]> {
    const pageSummary = pages.map((p) => ({
      title: p.title,
      url: p.url,
      actions: p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5),
    }));

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a business analyst. Identify user workflows from the ACTUAL pages provided.
Respond with valid JSON only. Do NOT invent pages not in the list.`,
      },
      {
        role: 'user',
        content: `Based ONLY on these actual pages, identify 2-4 common user workflows:
${JSON.stringify(pageSummary, null, 2)}

Respond with JSON: {"workflows": [["PageTitle1", "PageTitle2"], ...]}
Only use page titles from the list above.`,
      },
    ];

    try {
      const result = await this.lmStudio.complete(messages);
      const parsed = this.parseJsonResponse<{ workflows: string[][] }>(result.content);
      return parsed.workflows ?? [];
    } catch {
      return [];
    }
  }

  async generateFaq(pages: PageMetadata[]): Promise<Array<{ question: string; answer: string }>> {
    const appContext = pages
      .slice(0, 20)
      .map((p) => {
        const actions = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 8).join(', ');
        const inputs = p.inputs.map((i) => i.label || i.placeholder || i.type).filter(Boolean).slice(0, 5).join(', ');
        const parts = [`${p.title}`];
        if (actions) parts.push(`Actions: ${actions}`);
        if (inputs) parts.push(`Inputs: ${inputs}`);
        if (p.searchFields.length > 0) parts.push('Has search');
        if (p.tables.length > 0) parts.push(`Has ${p.tables.length} data table(s): ${p.tables.map(t => t.headers.slice(0, 4).join(', ')).join('; ')}`);
        if (p.filters.length > 0) parts.push(`Filters: ${p.filters.slice(0, 4).join(', ')}`);
        return parts.join(' | ');
      })
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a customer support expert creating an FAQ for a web application. Write clear, helpful answers. Only reference features that are listed. Respond with valid JSON only.`,
      },
      {
        role: 'user',
        content: `Generate 10-12 FAQ entries for this web application.

Pages and features:
${appContext}

Cover these types of questions:
- "How do I [common task]?" with step-by-step answers
- "What does [page/feature] do?"
- "Where can I find [functionality]?"
- Common mistakes and how to fix them
- How to use key features like search, filters, tables, forms

Respond with JSON only:
{
  "faq": [
    {"question": "...", "answer": "..."}
  ]
}

Every question and answer must relate to the pages and features listed above.`,
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
    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    // Find JSON object boundaries in case model adds extra text
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON object found in AI response');
    }

    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}
