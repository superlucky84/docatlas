import MarkdownIt from 'markdown-it';
import GithubSlugger, { slug } from 'github-slugger';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const FILE = /^- `([^`]+)`(?: -> `([^`]+)`)? \((added|modified|deleted|renamed)\)$/;
const REFS = /^Refs: (none|[A-Z][A-Z0-9]*-[0-9]+(?:, [A-Z][A-Z0-9]*-[0-9]+)*)$/;

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

/** Extract recorded changes only; paths are historical references, never file reads. */
export function extractPhaseRecords(markdown) {
  const source = markdown.replace(/^\uFEFF/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
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
  for (let line = 0; line < lines.length; line++) {
    if (ignored.has(line)) continue;
    const heading = headings.get(line);
    if (heading) {
      while (stack.length && stack.at(-1).depth >= heading.depth) stack.pop();
      stack.push({ ...heading });
    }
    if (!stack.length) continue;
    const refs = lines[line].match(REFS);
    if (refs) stack.at(-1).refs = refs[1] === 'none' ? [] : refs[1].split(', ');
    if (lines[line] !== 'Files:' && lines[line] !== 'Files: none') continue;
    const record = {
      title: stack.at(-1).title, section: stack.map(item => item.title).slice(1).join(' / ') || stack[0].title,
      anchor: stack.at(-1).anchor, line: line + 1,
      refs: [...stack].reverse().find(item => item.refs !== undefined)?.refs || [], files: []
    };
    if (lines[line] === 'Files:') {
      while (line + 1 < lines.length && !ignored.has(line + 1)) {
        const file = lines[line + 1].match(FILE);
        if (!file) break;
        line++;
        if (!safePath(file[1]) || (file[2] && !safePath(file[2])) ||
            Boolean(file[2]) !== (file[3] === 'renamed')) continue;
        record.files.push({ path: file[2] || file[1], kind: file[3], ...(file[2] ? { oldPath: file[1] } : {}) });
      }
    }
    records.push(record);
  }
  return records;
}
