/** Build file provenance from the same immutable generation as the selected document. */
export function relatedFilesFor(document, generation) {
  const own = generation.metadataCache.get(document.id)?.phaseRecords || [];
  const sources = own.length ? [document] : [...generation.documents.values()].filter(candidate =>
    candidate.groupId === document.groupId && candidate.kind === 'implementation' && !candidate.canonicalId);
  const files = new Map();
  let recordCount = 0;
  for (const source of sources) {
    for (const record of generation.metadataCache.get(source.id)?.phaseRecords || []) {
      recordCount++;
      for (const entry of record.files) {
        if (!files.has(entry.path)) {
          const target = generation.documents.get(entry.path);
          files.set(entry.path, {
            path: entry.path, isDirectory: entry.path.endsWith('/'),
            ...(target ? { targetId: target.canonicalId || target.id } : {}), records: []
          });
        }
        files.get(entry.path).records.push({
          documentId: source.id, sourcePath: source.relativePath,
          title: record.title, section: record.section, anchor: record.anchor, refs: record.refs,
          kind: entry.kind, ...(entry.oldPath ? { oldPath: entry.oldPath } : {})
        });
      }
    }
  }
  return {
    scope: own.length ? 'document' : 'feature', recordCount,
    sources: sources.map(source => source.relativePath),
    files: [...files.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  };
}
