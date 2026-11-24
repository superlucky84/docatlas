import MarkdownIt from 'markdown-it';
import GithubSlugger, { slug } from 'github-slugger';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const KIND = '(?: \\((added|modified|deleted|renamed)\\))?';
// RQ-20 list entries; DC-59 makes the kind optional and accepts any bullet marker.
const LIST_ENTRY = new RegExp('^[-*+] `([^`]+)`(?: -> `([^`]+)`)?' + KIND + '$');
// DC-59 fenced entries: one path per line, backticks optional.
const FENCE_ENTRY = new RegExp('^`?([^`]+?)`?(?: -> `?([^`]+?)`?)?' + KIND + '$');
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

/** Turn one matched entry into a file record, or null when its paths are unsafe or inconsistent. */
function toFile(match) {
  const [, first, second, written] = match;
  // An arrow already says the entry is a rename, so only a bare path falls back to unknown.
  const kind = written || (second ? 'renamed' : 'unknown');
  if (!safePath(first) || (second && !safePath(second)) || Boolean(second) !== (kind === 'renamed')) return null;
  return { path: second || first, kind, ...(second ? { oldPath: first } : {}) };
}

/** Find each top-level `Files:` paragraph and the list or fence after it, whatever blank lines separate them. */
function fileBlocks(tokens, lines) {
  const blocks = new Map();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'paragraph_open' || token.level !== 0) continue;
    const line = token.map[0];
    // A top-level paragraph may be indented up to three spaces.
    const label = lines[line].trim();
    if (label !== 'Files:' && label !== 'Files: none') continue;
    if (token.map[1] - line !== 1) {
      // Text right under the label joins its paragraph, so there is no list or fence to read.
      blocks.set(line, { broken: true, none: label === 'Files: none', entries: [] });
      continue;
    }
    const entries = [];
    const next = tokens[index + 3];
    if (label === 'Files:' && next?.type === 'bullet_list_open' && next.level === 0) {
      for (let item = index + 4; tokens[item] && tokens[item].type !== 'bullet_list_close'; item++) {
        if (tokens[item].type !== 'list_item_open' || tokens[item].level !== 1) continue;
        const at = tokens[item].map[0];
        entries.push({ line: at, match: lines[at].trim().match(LIST_ENTRY) });
      }
    } else if (label === 'Files:' && next?.type === 'fence' && next.level === 0) {
      next.content.split('\n').forEach((text, offset) => {
        if (text.trim()) entries.push({ line: next.map[0] + 1 + offset, match: text.trim().match(FENCE_ENTRY) });
      });
    }
    blocks.set(line, { none: label === 'Files: none', entries });
  }
  return blocks;
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
  const blocks = fileBlocks(tokens, lines);
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
    else if (!refs && text.startsWith('Refs:')) report(line, 'refs-format');
    const block = blocks.get(line);
    if (!block) {
      if (/^Files:\s*\S/.test(text)) report(line, 'files-inline');
      else if (text !== 'Files:' && LABEL_LIKE.test(text)) report(line, 'files-label');
      continue;
    }
    if (block.broken) {
      report(line, block.none ? 'files-label' : 'files-empty');
      continue;
    }
    const files = [];
    for (const entry of block.entries) {
      const file = entry.match && toFile(entry.match);
      if (!entry.match) report(entry.line, 'files-entry');
      else if (!file) report(entry.line, 'files-path');
      else {
        if (file.kind === 'unknown') report(entry.line, 'files-kind');
        files.push(file);
      }
    }
    if (!block.none && !block.entries.length) report(line, 'files-empty');
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
