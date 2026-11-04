const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const routeUrl = (id, fragment = '') => '/?doc=' + encodeURIComponent(id) +
  (fragment ? '#' + encodeURIComponent(fragment) : '');
const normalize = value => value.normalize('NFC').toLowerCase();
const kinds = { added: 'Added in this phase', modified: 'Modified in this phase',
  deleted: 'Deleted in this phase', renamed: 'Renamed in this phase' };

export function createRelatedFiles({ openDocument }) {
  const dialog = $('related-files-dialog');
  let currentId;
  let data = { files: [], sources: [], recordCount: 0, scope: 'document' };
  let needsRender = true;
  let renderedFilter = '';
  const expanded = new Set();
  const copyFallbacks = new Set();

  function close() {
    if (dialog.open) dialog.close();
    $('related-files-toggle').setAttribute('aria-expanded', 'false');
  }

  function navigate(event, id, anchor = '') {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
    void openDocument(id, { fragment: anchor, fromLink: true });
  }

  function fileRow(file) {
    const details = node('details', 'related-file');
    details.dataset.path = file.path;
    details.open = expanded.has(file.path);
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      if (details.open) expanded.add(file.path);
      else expanded.delete(file.path);
    });
    const summary = node('summary', 'file-summary');
    summary.dataset.focusKey = 'record:' + file.path;
    const label = node('div', 'file-label');
    const path = file.path.replace(/\/$/, '');
    const separator = path.lastIndexOf('/');
    label.append(node('span', 'file-name', path.slice(separator + 1) + (file.isDirectory ? '/' : '')));
    if (separator >= 0) label.append(node('span', 'file-directory', path.slice(0, separator + 1)));
    summary.append(label, node('span', 'file-record-count', file.records.length + (file.records.length === 1 ? ' record' : ' records')));
    const actions = node('div', 'file-actions');
    const copy = node('button', 'file-action', 'Copy path');
    copy.type = 'button';
    copy.setAttribute('aria-label', 'Copy path: ' + file.path);
    copy.dataset.focusKey = 'copy:' + file.path;
    function showCopyFallback() {
      copy.textContent = 'Select path below';
      let fallback = actions.querySelector('input');
      if (!fallback) {
        fallback = node('input', 'file-copy-fallback');
        fallback.readOnly = true;
        fallback.setAttribute('aria-label', 'File path');
        fallback.dataset.focusKey = 'fallback:' + file.path;
        fallback.value = file.path;
        actions.append(fallback);
      }
      return fallback;
    }
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(file.path);
        copy.textContent = 'Copied ✓';
      } catch {
        if (!copy.isConnected) return;
        copyFallbacks.add(file.path);
        const fallback = showCopyFallback();
        fallback.focus();
        fallback.select();
      }
    };
    actions.append(copy);
    if (file.targetId) {
      const link = node('a', 'file-action', 'Open document ↗');
      link.href = routeUrl(file.targetId);
      link.dataset.focusKey = 'open:' + file.path;
      link.onclick = event => navigate(event, file.targetId);
      actions.append(link);
    }
    if (copyFallbacks.has(file.path)) showCopyFallback();
    // Keep actions separate from the disclosure so clicks have one clear meaning.
    const container = node('div', 'file-card');
    const evidence = node('div', 'file-evidence');
    for (const record of file.records) {
      const entry = node('div', 'file-evidence-entry');
      const link = node('a', 'file-phase-link', record.title + ' ↗');
      link.href = routeUrl(record.documentId, record.anchor);
      link.dataset.focusKey = 'phase:' + JSON.stringify([file.path, record.documentId, record.anchor, record.kind, record.oldPath || '']);
      link.title = record.section;
      link.onclick = event => navigate(event, record.documentId, record.anchor);
      entry.append(node('span', 'file-change-kind', kinds[record.kind]), link);
      if (record.oldPath) entry.append(node('code', 'file-old-path', record.oldPath + ' → ' + file.path));
      if (record.refs.length) {
        const refs = node('div', 'file-refs');
        refs.append(...record.refs.map(ref => node('span', '', ref)));
        entry.append(refs);
      }
      entry.append(node('span', 'file-source-path', record.sourcePath));
      evidence.append(entry);
    }
    details.append(summary, evidence);
    container.append(details, actions);
    return container;
  }

  function render() {
    const list = $('files-list');
    const scroll = list.scrollTop;
    const active = document.activeElement;
    const hadListFocus = list.contains(active);
    const focusKey = hadListFocus ? active.dataset.focusKey : null;
    const selection = hadListFocus && active instanceof HTMLInputElement
      ? [active.selectionStart, active.selectionEnd] : null;
    const query = normalize($('files-search').value.trim());
    const terms = query.split(/\s+/).filter(Boolean);
    const files = data.files.filter(file => {
      const text = normalize(file.path + ' ' + file.records.map(record =>
        [record.oldPath || '', record.section, ...record.refs].join(' ')).join(' '));
      return terms.every(term => text.includes(term));
    });
    $('files-result-count').textContent = query
      ? files.length + ' of ' + data.files.length + ' paths'
      : data.files.length + ' unique paths · ' + data.recordCount + ' phase records';
    const groups = new Map();
    for (const file of files) {
      const name = /\.md$/i.test(file.path) ? 'Documentation' :
        file.path.includes('/') ? file.path.split('/')[0] + '/' : 'Project root';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(file);
    }
    const sections = [...groups].sort(([a], [b]) =>
      (a === 'Documentation') - (b === 'Documentation') || a.localeCompare(b));
    list.replaceChildren(...sections.map(([name, members]) => {
      const section = node(name === 'Documentation' ? 'details' : 'section', 'files-group');
      const heading = node(name === 'Documentation' ? 'summary' : 'h3', 'files-group-title', name);
      heading.append(node('span', '', String(members.length)));
      if (name === 'Documentation') heading.dataset.focusKey = 'group:docs';
      section.append(heading);
      if (name === 'Documentation') section.open = Boolean(query) || expanded.has('group:docs');
      section.addEventListener('toggle', () => {
        if (!section.isConnected || query) return;
        if (section.open) expanded.add('group:docs');
        else expanded.delete('group:docs');
      });
      section.append(...members.map(fileRow));
      return section;
    }));
    if (!files.length) {
      const empty = node('div', 'files-empty');
      empty.append(node('strong', '', query ? 'No matching files' : 'No file records yet'),
        node('p', '', query ? 'Try a file name, folder, or requirement ID.' :
          'This document and its implementation plan have no recorded files. Related files may still be mentioned in the document text.'));
      list.append(empty);
    }
    list.scrollTop = scroll;
    if (hadListFocus && dialog.open) {
      const target = focusKey ? list.querySelector('[data-focus-key="' + CSS.escape(focusKey) + '"]') : null;
      const next = target?.getClientRects().length ? target : $('files-search');
      next.focus({ preventScroll: true });
      if (next === target && selection && next instanceof HTMLInputElement) next.setSelectionRange(...selection);
    }
    needsRender = false;
    renderedFilter = $('files-search').value;
  }

  $('related-files-toggle').onclick = () => {
    dialog.showModal();
    if (needsRender || renderedFilter !== $('files-search').value) render();
    $('related-files-toggle').setAttribute('aria-expanded', 'true');
    $('files-search').focus({ preventScroll: true });
  };
  $('related-files-close').onclick = close;
  dialog.addEventListener('close', () => $('related-files-toggle').setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom)) close();
  });
  $('files-search').addEventListener('input', () => {
    needsRender = true;
    $('files-list').scrollTop = 0;
    if (dialog.open) render();
  });

  return {
    close,
    update(document) {
      if (currentId !== document.id) {
        close();
        currentId = document.id;
        expanded.clear();
        copyFallbacks.clear();
        $('files-search').value = '';
        $('files-list').scrollTop = 0;
      }
      data = document.relatedFiles || { files: [], sources: [], recordCount: 0, scope: 'document' };
      $('related-files-count').textContent = String(data.files.length);
      $('files-total').textContent = String(data.files.length);
      $('files-scope').textContent = data.scope === 'document'
        ? 'Recorded in this document' : 'From this feature’s implementation plan';
      $('files-origin').textContent = data.sources.join(' · ') || 'No implementation plan in this document group';
      needsRender = true;
      if (dialog.open) render();
      else $('files-list').replaceChildren();
    }
  };
}
