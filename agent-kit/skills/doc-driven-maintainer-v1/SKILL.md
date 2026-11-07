---
name: doc-driven-maintainer-v1
description: Inspect existing project documents against code, tests, and recorded decisions only when documentation maintenance is requested. Report drift, missing records, and merge or move recommendations; apply only explicitly requested document changes. Do not invoke during ordinary design, implementation, or review.
metadata:
  short-description: requested documentation inspection and repair
  version: 1.0.0
---

# Documentation Maintainer

Make existing documents reliable for the next task. Use only for the maintenance scope the user or caller requests. Installation, an old date, changed code, and a phase ending are not requests. Do not add automatic checks, reminders, or calls from other roles.

## Inspect

1. Read project instructions and the supplied entry documents. Establish the requested document, feature, or repository scope, current commit, and existing uncommitted changes. A clean working tree still permits inspection. With no Git history, record that limitation and continue with available evidence.
2. Start with document paths, headings, links, IDs, and matching passages; read candidate documents and relevant code in detail. Follow references and search document text as well as recorded file paths: `Refs:` and `Files:` are hints, not a complete index. For a repository-wide request, inspect one feature at a time and identify skipped or unread areas.
3. Compare claims with current code, tests, confirmed requirements, and identifiable Git history. Distinguish a document error, suspected implementation error, unimplemented plan, and unknown. Current code describes what exists; it does not override user intent or confirmed requirements. An old date alone is not an error. Test presence and historical results are not a new passing test run.
4. Check IDs within their document or feature scope, broken references, conflicting or duplicated contracts, and possible shared document locations. A matching title or filename alone does not justify a merge. Explain the source, destination, rationale, preserved decisions/IDs/history, and affected links, entrypoints, commands, examples, or configuration for each proposed merge or move.

## Historical Records

`Files:` records what a phase changed, not all code currently related to it. Missing records from before the convention are not automatically defects. Only investigate backfilling older phases when requested, and only reconstruct a record when Git evidence identifies that phase and its changed files. If changes from several phases cannot be separated, report the uncertainty instead of guessing.

Preserve historical deleted/renamed paths and verification results. List current related code separately in the report; never turn today's inventory into a past phase's `Files:` block or silently resolve a `TBD`.

## Diagnose or Apply

Inspection is read-only by default, including report files. Return findings without changing documents, code, tests, or the Git index. Use provided test evidence; run only scoped, documented checks that leave tracked files unchanged. Do not install dependencies, create commits, publish, or push.

When the user or caller explicitly requests repairs, apply only the assigned items and their necessary reference updates. Re-read the affected documents and working-tree changes before editing; preserve unrelated user work. Change documents only. Keep confirmed intent, proposals, plans, and implemented behavior distinct. Update affected canonical documents and links, anchors, entrypoints, and the single current handoff when relevant. Leave conflicting intent or uncertain historical reconstruction as questions. Report the resulting diff and verification; do not expand diagnosis into unrequested merging, moving, or deletion.

## Return and Handoff

Return a concise report with:

- **Scope:** inspected documents/features, baseline commit and worktree state, and uninspected or inaccessible areas.
- **Findings:** actionable issues with category, impact, document and code `path:line` or heading anchors, and a recommended correction. Separate expected plans and unknowns from defects.
- **Proposed changes:** item identifiers, intended document edits or source/destination moves, preserved contracts, and necessary reference updates; identify applied items when repairs were requested.
- **Questions:** unresolved intent, conflicts, and missing historical evidence.
- **Verification:** checks actually run, evidence supplied by the caller, and remaining acceptance work.

As a subagent, use the caller's goal, scope, entrypoints, and baseline; return unresolved questions instead of waiting for user input. Do not copy whole documents or exploration logs into the result, delegate to more agents, or call other roles automatically. Separate context is provided by the client's subagent support; using this skill directly stays in the current conversation.
