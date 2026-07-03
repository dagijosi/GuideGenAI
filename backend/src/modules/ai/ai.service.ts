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

    const systemPrompt = `You are a technical documentation writer.
Your job is to document a web application page STRICTLY based on the provided page data.

CRITICAL RULES:
- ONLY describe what is actually present in the provided page data.
- Do NOT invent, assume, or hallucinate any features, buttons, or content not listed.
- If the page has no login form, do NOT mention login.
- If a field is empty or unknown, write an empty string or empty array.
- Base ALL descriptions directly on the actual page elements provided.
- Respond with valid JSON only — no markdown, no extra text.`;

    const userPrompt = `Document this specific web page based ONLY on the data below.

=== PAGE DATA ===
${pageContext}
=== END PAGE DATA ===

Respond with this exact JSON structure (no other text):
{
  "overview": "1-2 sentences describing exactly what this page does, based only on the data above",
  "features": ["list only features/actions actually visible in the page data above"],
  "userGuide": "step-by-step guide based only on the actual UI elements listed above",
  "tips": ["practical tips based only on what is actually on this page"],
  "warnings": ["only real warnings relevant to elements that exist on this page"],
  "faq": [{"question": "question about actual page features", "answer": "answer based on actual data"}],
  "testCases": ["test scenarios for features that actually exist on this page"],
  "releaseNotes": "",
  "developerNotes": ""
}`;

    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await this.lmStudio.complete(messages);
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
   * Converts raw page metadata into a concise human-readable context string.
   * This prevents the AI from treating JSON structure as something to interpret freely.
   */
  private buildPageContext(metadata: PageMetadata): string {
    const lines: string[] = [];

    lines.push(`Title: ${metadata.title}`);
    lines.push(`URL: ${metadata.url}`);

    if (metadata.breadcrumbs.length > 0) {
      lines.push(`Breadcrumbs: ${metadata.breadcrumbs.join(' > ')}`);
    }

    if (metadata.textSections.length > 0) {
      lines.push(`Headings on page: ${metadata.textSections.join(', ')}`);
    }

    const buttonTexts = metadata.buttons
      .map((b) => b.text)
      .filter((t) => t.trim().length > 0)
      .slice(0, 20);
    if (buttonTexts.length > 0) {
      lines.push(`Buttons/actions: ${buttonTexts.join(', ')}`);
    }

    if (metadata.inputs.length > 0) {
      const inputDesc = metadata.inputs
        .map((i) => i.label || i.placeholder || i.type)
        .filter(Boolean)
        .slice(0, 15);
      lines.push(`Input fields: ${inputDesc.join(', ')}`);
    }

    if (metadata.tables.length > 0) {
      const tableDesc = metadata.tables
        .map((t) => `table with columns: ${t.headers.join(', ')} (${t.rowCount} rows)`)
        .join('; ');
      lines.push(`Tables: ${tableDesc}`);
    }

    if (metadata.forms.length > 0) {
      lines.push(`Forms: ${metadata.forms.join(', ')}`);
    }

    if (metadata.searchFields.length > 0) {
      lines.push(`Search fields: ${metadata.searchFields.join(', ')}`);
    }

    if (metadata.filters.length > 0) {
      lines.push(`Filters: ${metadata.filters.join(', ')}`);
    }

    const navLinks = metadata.navigationLinks
      .map((n) => n.text)
      .filter((t) => t.trim().length > 0)
      .slice(0, 15);
    if (navLinks.length > 0) {
      lines.push(`Navigation links: ${navLinks.join(', ')}`);
    }

    if (metadata.cards.length > 0) {
      lines.push(`Cards/panels: ${metadata.cards.slice(0, 10).join(', ')}`);
    }

    if (metadata.charts.length > 0) {
      lines.push(`Charts/graphs present: ${metadata.charts.join(', ')}`);
    }

    if (metadata.pagination) {
      lines.push('Pagination: yes');
    }

    return lines.join('\n');
  }

  async generateProjectOverview(
    projectName: string,
    url: string,
    pages: PageMetadata[],
  ): Promise<string> {
    const pageList = pages
      .map((p) => {
        const buttons = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5).join(', ');
        return `- ${p.title} (${p.url})${buttons ? ` — actions: ${buttons}` : ''}`;
      })
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a technical writer. Write ONLY based on the pages actually provided.
Do NOT invent features or functionality not listed. Be factual and concise.`,
      },
      {
        role: 'user',
        content: `Write a 2-3 paragraph overview for a web application called "${projectName}" at ${url}.

These are the ACTUAL pages found during crawling:
${pageList}

Describe what the application does based strictly on these pages. Do not add anything not shown above.`,
      },
    ];

    const result = await this.lmStudio.complete(messages);
    return result.content;
  }

  async generateGettingStarted(pages: PageMetadata[]): Promise<string> {
    const navSummary = pages
      .slice(0, 10)
      .map((p) => `- ${p.title}: ${p.buttons.map((b) => b.text).filter(Boolean).slice(0, 4).join(', ')}`)
      .join('\n');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a technical writer. Write ONLY based on the pages provided. Do NOT make assumptions.`,
      },
      {
        role: 'user',
        content: `Write a "Getting Started" guide for new users of this application.

The application has these pages and actions:
${navSummary}

Write a practical getting started guide using ONLY the pages and actions listed above.`,
      },
    ];

    const result = await this.lmStudio.complete(messages);
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
    const context = pages
      .slice(0, 15)
      .map((p) => {
        const actions = p.buttons.map((b) => b.text).filter(Boolean).slice(0, 5).join(', ');
        return `${p.title}${actions ? ` (${actions})` : ''}`;
      })
      .join(', ');

    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `You are a technical support expert. Generate FAQ entries based ONLY on what actually exists.
Do not invent features. Respond with JSON only.`,
      },
      {
        role: 'user',
        content: `Generate up to 8 FAQ entries for an application with ONLY these actual pages and features:
${context}

Respond with JSON: {"faq": [{"question": "...", "answer": "..."}]}
Every question and answer must relate directly to the pages and actions listed above.`,
      },
    ];

    try {
      const result = await this.lmStudio.complete(messages);
      const parsed = this.parseJsonResponse<{ faq: Array<{ question: string; answer: string }> }>(
        result.content,
      );
      return parsed.faq ?? [];
    } catch {
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
