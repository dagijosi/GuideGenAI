export const DEFAULT_CRAWL_OPTIONS = {
  maxDepth: 3,
  maxPages: 50,
  includeScreenshots: true,
  includeVideo: false,
  followExternalLinks: false,
  waitForNetworkIdle: false, // domcontentloaded is more reliable for SPAs
};

export const PROGRESS_GATEWAY = 'PROGRESS_GATEWAY';

export const SELECTORS = {
  NAV: 'nav, [role="navigation"], .nav, .navbar, .sidebar, .menu',
  BUTTONS: 'button, [role="button"], input[type="submit"], input[type="button"], a.btn',
  FORMS: 'form',
  INPUTS: 'input, textarea, select',
  TABLES: 'table',
  MODALS: '[role="dialog"], .modal, .dialog',
  TABS: '[role="tab"], .tab',
  CARDS: '.card, [class*="card"]',
  PAGINATION: '[aria-label*="pagination"], .pagination, nav[aria-label*="page"]',
  BREADCRUMBS: '[aria-label*="breadcrumb"], .breadcrumb',
};

export const EXCLUDED_EXTENSIONS = [
  '.pdf', '.zip', '.exe', '.dmg', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.mp4',
  '.mp3', '.avi', '.mov', '.css', '.js', '.ts',
];

export const EXCLUDED_URL_PATTERNS = [
  /[?&]logout/i,
  /\/logout\b/i,
  /\/sign-out\b/i,
  /\/signout\b/i,
  /^javascript:/i,
  /^mailto:/i,
  /^tel:/i,
  /^data:/i,
];
