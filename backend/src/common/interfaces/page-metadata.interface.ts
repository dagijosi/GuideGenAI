export interface ButtonMeta {
  text: string;
  type: string;
  selector: string;
}

export interface InputMeta {
  label: string;
  type: string;
  name: string;
  placeholder: string;
}

export interface TableMeta {
  headers: string[];
  rowCount: number;
  actions?: string[];
}

export interface NavigationLinkMeta {
  text: string;
  href: string;
  isActive: boolean;
}

export interface PageMetadata {
  title: string;
  url: string;
  breadcrumbs: string[];
  navigationPath: string[];
  /** URL chain from crawl root to this page — ground truth for workflow detection */
  navigationUrlPath?: string[];
  buttons: ButtonMeta[];
  inputs: InputMeta[];
  dropdowns: string[];
  tabs: string[];
  tables: TableMeta[];
  cards: string[];
  charts: string[];
  dialogs: string[];
  forms: string[];
  searchFields: string[];
  filters: string[];
  pagination: boolean;
  images: string[];
  icons: string[];
  textSections: string[];
  navigationLinks: NavigationLinkMeta[];
  screenshotPath?: string;
  visitedAt: string;
}
