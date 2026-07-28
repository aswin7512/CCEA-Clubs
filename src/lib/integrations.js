/**
 * Server-Defined Feature Integrations Registry & Helper Utilities
 */

export const AVAILABLE_INTEGRATIONS = [
  {
    key: 'leetcode',
    name: 'LeetCode Student Tracking',
    description: 'Assign LeetCode problems and track student problem-solving activity automatically.',
    icon: 'Code'
  },
  {
    key: 'tutor_view',
    name: 'Tutor View (Class-wise Tracking)',
    description: 'Split student members into classes (e.g. S7 CSE A) and assign faculty tutors per class to monitor class-specific statistics.',
    icon: 'Users'
  }
];

/**
 * Formats a student's class name from their profile attributes (semester, department, division)
 * Example output: "S7 CSE A", "S5 ECE", or "Unassigned Class"
 * @param {Object} profile 
 * @returns {string}
 */
export function formatStudentClass(profile) {
  if (!profile) return 'Unassigned Class';
  const sem = profile.semester ? `S${profile.semester}` : '';
  const dept = profile.department ? profile.department.trim() : '';
  const div = profile.division ? profile.division.trim() : '';

  const parts = [sem, dept, div].filter(Boolean);
  if (parts.length === 0) return 'Unassigned Class';
  return parts.join(' ');
}

/**
 * Checks if a specific feature integration is enabled for a given club chapter
 * @param {Object} chapter - Chapter object from club_chapters table
 * @param {string} integrationKey - Feature key e.g. 'leetcode'
 * @returns {boolean}
 */
export function isIntegrationEnabled(chapter, integrationKey) {
  if (!chapter || !chapter.feature_integrations) return false;
  
  let integrations = chapter.feature_integrations;
  if (typeof integrations === 'string') {
    try {
      integrations = JSON.parse(integrations);
    } catch (e) {
      return false;
    }
  }

  if (Array.isArray(integrations)) {
    return integrations.includes(integrationKey);
  }
  return false;
}

/**
 * Extracts raw LeetCode username from input which could be a raw handle, @handle, or profile URL.
 * Examples:
 *  - "https://leetcode.com/u/john_doe/" -> "john_doe"
 *  - "https://leetcode.com/john_doe" -> "john_doe"
 *  - "leetcode.com/u/john_doe" -> "john_doe"
 *  - "@john_doe" -> "john_doe"
 *  - "john_doe" -> "john_doe"
 * @param {string} input 
 * @returns {string}
 */
export function extractLeetCodeUsername(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();

  // Remove trailing slashes
  str = str.replace(/\/+$/, '');

  // Extract from URLs
  if (str.includes('leetcode.com')) {
    // Regex matching leetcode.com/u/username or leetcode.com/username
    const match = str.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Remove leading @ if user entered @username
  if (str.startsWith('@')) {
    str = str.substring(1);
  }

  // If path contains slashes, take last part
  if (str.includes('/')) {
    const parts = str.split('/').filter(Boolean);
    str = parts[parts.length - 1];
  }

  return str.trim();
}

/**
 * Extracts a single raw LeetCode problem slug from input string/URL.
 * @param {string} input 
 * @returns {string}
 */
export function extractSingleLeetCodeSlug(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();

  // Remove trailing slashes
  str = str.replace(/\/+$/, '');

  if (str.includes('leetcode.com/problems/')) {
    const match = str.match(/leetcode\.com\/problems\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }

  // If URL or path, clean up
  if (str.includes('/')) {
    const parts = str.split('/').filter(Boolean);
    // Find index of 'problems' if exists, take next part
    const probIdx = parts.indexOf('problems');
    if (probIdx !== -1 && parts[probIdx + 1]) {
      return parts[probIdx + 1].toLowerCase();
    }
    str = parts[parts.length - 1];
  }

  return str.toLowerCase().trim();
}

/**
 * Parses input string containing one or multiple LeetCode URLs/slugs (comma, space, newline, or semicolon separated)
 * @param {string} input 
 * @returns {string[]} Array of unique, clean problem slugs
 */
export function parseLeetCodeSlugs(input) {
  if (!input || typeof input !== 'string') return [];
  
  // Split by commas, newlines, semicolons, or spaces (if space occurs between URLs or words)
  const items = input.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
  const slugs = [];

  for (const item of items) {
    // If an item has whitespace (e.g. space separated URLs), further split by space
    const subItems = item.split(/\s+/).filter(Boolean);
    for (const sub of subItems) {
      const slug = extractSingleLeetCodeSlug(sub);
      if (slug && !slugs.includes(slug)) {
        slugs.push(slug);
      }
    }
  }

  return slugs;
}

/**
 * Extracts and formats problem slugs as a standardized comma-separated string for database storage.
 * @param {string} input 
 * @returns {string} Comma-separated list of clean slugs e.g. "two-sum, 3sum"
 */
export function extractLeetCodeSlug(input) {
  const slugs = parseLeetCodeSlugs(input);
  return slugs.join(', ');
}

/**
 * Automatically extracts LeetCode problem slugs from an array of task links or raw JSON string.
 * @param {Array|string} taskLinks - Array of { url, label } or JSON string of task links
 * @returns {string[]} Array of extracted unique problem slugs e.g. ["two-sum", "3sum"]
 */
export function extractSlugsFromTaskLinks(taskLinks) {
  if (!taskLinks) return [];
  let linksArray = [];

  if (typeof taskLinks === 'string') {
    try {
      linksArray = JSON.parse(taskLinks);
    } catch (e) {
      linksArray = [{ url: taskLinks }];
    }
  } else if (Array.isArray(taskLinks)) {
    linksArray = taskLinks;
  }

  const slugs = [];
  for (const item of linksArray) {
    const url = typeof item === 'string' ? item : item?.url;
    if (url) {
      const slug = extractSingleLeetCodeSlug(url);
      if (slug && !slugs.includes(slug)) {
        slugs.push(slug);
      }
    }
  }

  return slugs;
}


