export interface PageDocumentation {
  pageId: string;
  url: string;
  title: string;
  overview: string;
  features: string[];
  userGuide: string;
  tips: string[];
  warnings: string[];
  faq: Array<{ question: string; answer: string }>;
  testCases: string[];
  releaseNotes: string;
  developerNotes?: string;
  generatedAt: string;
}

export interface ProjectDocumentation {
  projectId: string;
  projectName: string;
  overview: string;
  gettingStarted: string;
  features: string[];
  pages: PageDocumentation[];
  workflows: string[];
  faq: Array<{ question: string; answer: string }>;
  troubleshooting: string;
  releaseNotes: string;
  developerGuide: string;
  glossary: Record<string, string>;
  generatedAt: string;
}
