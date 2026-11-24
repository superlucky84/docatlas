import MarkdownIt from 'markdown-it';
import GithubSlugger, { slug } from 'github-slugger';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const KIND = '(?: \\((added|modified|deleted|renamed)\\))?';
// RQ-20 list entries; DC-59 makes the kind optional and accepts any bullet marker.
const LIST_ENTRY = new RegExp('^ {0,3}[-*+] `([^`]+)`(?: -> `([^`]+)`)?' + KIND + '$');
// DC-59 fenced entries: one path per line. A path with spaces keeps its backticks, so trailing notes are errors.
const FENCE_PATH = '(?:`([^`]+)`|([^\\s`]+))';
const FENCE_ENTRY = new RegExp('^' + FENCE_PATH + '(?: -> ' + FENCE_PATH + ')?' + KIND + '$');
const LIST_ITEM = /^ {0,3}[-*+](?:\s|$)/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const LABEL = /^ {0,3}Files:(?: none)?\s*$/;
const ID = '[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?';
const REFS = new RegExp('^Refs: (none|' + ID + '(?:,\\s*' + ID + ')*)$');

function textOf(tokens = []) {
  return tokens.map(token => {
    if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
    if (token.type === 'image') return textOf(token.children || []) || token.content;
    if (token.children) return textOf(token.children);
    return ['text', 'code_inline'].includes(token.type) ? token.content : '';
  }).join('').trim();
}

function safePath(value) {
  return value && !/^[\/\\]|^[a-z]:/i.test(value) && !/[\\\u0000-\u001f]/.test(value) &&
    !value.split('/').some(part => part === '..' || part === '.') && !value.includes('//');
}

/** Turn one parsed entry into a file record, or null when its paths are unsafe or inconsistent. */
function toFile({ first, second, written }) {
  // An arrow already says the entry is a rename, so only a bare path falls back to unknown.
  const kind = written || (second ? 'renamed' : 'unknown');
  if (!safePath(first) || (second && !safePath(second)) || Boolean(second) !== (kind === 'renamed')) return null;
  return { path: second || first, kind, ...(second ? { oldPath: first } : {}) };
}

function parseList(text) {
  const match = text.match(LIST_ENTRY);
  return match && { first: match[1], second: match[2], written: match[3] };
}

function parseFenced(text) {
  const match = text.match(FENCE_ENTRY);
  return match && { first: match[1] ?? match[2], second: match[3] ?? match[4], written: match[5] };
}

/**
 * Read the list or fenced block after a `Files:` label, whatever blank lines separate them. This works
 * line by line, like RQ-20, so a label that Markdown joins to the text above it is still read.
 */
function readBlock(lines, label) {
  const entries = [];
  let line = label + 1;
  while (line < lines.length && !lines[line].trim()) line++;
  const fence = lines[line]?.match(FENCE_OPEN);
  if (fence) {
    const close = new RegExp('^ {0,3}' + fence[1][0].replace('`', '\\`') + '{' + fence[1].length + ',}\\s*$');
    for (line++; line < lines.length && !close.test(lines[line]); line++) {
      if (lines[line].trim()) entries.push({ line, entry: parseFenced(lines[line].trim()) });
    }
    return entries;
  }
  while (line < lines.length && LIST_ITEM.test(lines[line])) {
    entries.push({ line, entry: parseList(lines[line].trimEnd()) });
    let next = line + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    line = next;
  }
  return entries;
}

const LABEL_LIKE = /^(?:\*\*|__)?Files(?:\*\*|__)?\s*(?:\([^)]*\))?\s*:/;
const MESSAGES = {
  'files-label': 'Write the label as exactly "Files:" or "Files: none"; put status notes in the checklist.',
  'files-inline': 'List files on the lines after "Files:", not on the label line.',
  'files-empty': '"Files:" must be followed by a list or a fenced block of paths.',
  'files-entry': 'Not a file entry: use - `path` (kind) in a list, or path (kind) in a fenced block.',
  'refs-format': 'Write full IDs separated by ", " (for example RQ-1, DC-2), or "Refs: none".',
  'files-path': 'Skipped an absolute, parent-relative, or inconsistent rename path.',
  'files-kind': 'No change kind; add (added), (modified), (deleted), or (renamed).'
};
const LEVELS = { 'files-path': 'warning', 'files-kind': 'warning' };

/** Extract recorded changes only; paths are historical references, never file reads. */
export function extractPhaseRecords(markdown) {
  return extractRecordData(markdown).records;
}

/**
 * Extract phase records together with format issues (DC-60). Issue lines are 1-based lines of the
 * original file, front matter included, so people and agents can jump to them in an editor.
 */
export function extractRecordData(markdown) {
  const withoutBom = markdown.replace(/^﻿/, '');
  const frontMatter = withoutBom.match(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/)?.[0] || '';
  const offset = frontMatter.split(/\r?\n/).length - 1;
  const source = withoutBom.slice(frontMatter.length);
  const lines = source.split(/\r?\n/);
  const tokens = md.parse(source, {});
  const ignored = new Set();
  const headings = new Map();
  const slugger = new GithubSlugger();
  for (const [index, token] of tokens.entries()) {
    if (['fence', 'code_block'].includes(token.type)) {
      for (let line = token.map[0]; line < token.map[1]; line++) ignored.add(line);
    }
    if (token.type === 'heading_open') {
      const title = textOf(tokens[index + 1].children);
      headings.set(token.map[0], {
        title, depth: Number(token.tag.slice(1)), anchor: slugger.slug(slug(title) ? title : 'Section')
      });
    }
  }
  const stack = [];
  const records = [];
  const issues = [];
  const report = (line, code) => issues.push({
    line: line + 1 + offset, code, level: LEVELS[code] || 'error', message: MESSAGES[code],
    ...(stack.length ? { anchor: stack.at(-1).anchor } : {})
  });
  for (let line = 0; line < lines.length; line++) {
    if (ignored.has(line)) continue;
    const heading = headings.get(line);
    if (heading) {
      while (stack.length && stack.at(-1).depth >= heading.depth) stack.pop();
      stack.push({ ...heading });
    }
    const text = lines[line].trimEnd();
    const refs = text.match(REFS);
    if (refs && stack.length) stack.at(-1).refs = refs[1] === 'none' ? [] : refs[1].split(/,\s*/);
    // Ordinary prose that starts with "Refs:" is not reported unless it tries to name an ID.
    else if (!refs && text.startsWith('Refs:') && /[A-Z][A-Z0-9]*-[0-9]/.test(text)) report(line, 'refs-format');
    if (!LABEL.test(text)) {
      // Likewise "Files:" prose is reported only when the label line holds something path-like.
      if (/^Files:\s*\S/.test(text) && /[`/,]|\w\.\w/.test(text.slice(6))) report(line, 'files-inline');
      else if (!/^Files:/.test(text) && LABEL_LIKE.test(text)) report(line, 'files-label');
      continue;
    }
    const none = text.trim() === 'Files: none';
    const entries = none ? [] : readBlock(lines, line);
    const files = [];
    for (const { line: at, entry } of entries) {
      const file = entry && toFile(entry);
      if (!entry) report(at, 'files-entry');
      else if (!file) report(at, 'files-path');
      else {
        if (file.kind === 'unknown') report(at, 'files-kind');
        files.push(file);
      }
    }
    if (!none && !entries.length) report(line, 'files-empty');
    if (!stack.length) continue;
    records.push({
      title: stack.at(-1).title, section: stack.map(item => item.title).slice(1).join(' / ') || stack[0].title,
      anchor: stack.at(-1).anchor, line: line + 1,
      refs: [...stack].reverse().find(item => item.refs !== undefined)?.refs || [], files
    });
  }
  issues.sort((a, b) => a.line - b.line);
  return { records, issues };
}
