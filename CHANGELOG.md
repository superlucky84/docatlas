# Changelog

Changes to the `docatlas` npm package. Dates are npm publish dates (UTC); Unreleased lists
changes on main that are not published yet.
Agent skill and rule versions are tracked separately in
[agent-kit/manifest.json](agent-kit/manifest.json).

## Unreleased

## 0.8.0 — 2026-11-08 (planned)

- Agent kit 1.5.0 adds optional `doc-driven-maintainer-v1` 1.0.0 for requested document
  inspection and repair, including code/document drift, historical records, and merge/move
  recommendations. Default installs keep the same three roles; use `--all` or
  `--only doc-driven-maintainer-v1`. It has no skill dependency and includes a Codex explicit-call policy.
- Designer 1.3.1 reads user-specified documents first and searches linked or nearby documents
  only when the existing requirements or design for the change are unclear.

## 0.7.0 — 2026-11-04

- Read phase `Files:` records from your documents in the new **Related files** panel.
  See unique paths, the phases and IDs behind each change, and follow a phase back to its
  document. Documents without their own records use the implementation plan in the same
  feature group, with its source clearly labeled. Records are historical hints, not a
  complete inventory or the current Git status.
- Search recorded file names, paths, and previous names in the map's existing search box.
  Results show matching paths and distinguish direct records from feature records, while
  preserving text search for older documents without phase records.
- Bundle and minify browser JavaScript and CSS before packaging. Build tools remain
  development dependencies; installed packages run without a UI build. The panel preserves
  keyboard focus during updates, defers closed lists, and reuses unchanged lists on reopen.

## 0.6.0 — 2026-11-03

- Optional `doc-driven-backup-v1` 1.0.0 in kit 1.4.0 helps with explicitly requested cloud
  backup and restore of private documents. Existing four skill/rule sources and default
  installation remain unchanged; `--all` adds the fifth pair and its Codex explicit-call policy.
- Zero-dependency `docatlas private-cloud` helpers connect to an existing sync folder,
  prepare plain tar/recovery lists, verify restore previews and apply through the existing
  local restore. Backup names, immutable tags/IDs, and selective paths keep other local
  documents. Equal contents are stored once per archive and local hard-link sharing is rebuilt.
  No background tasks, automatic prompts, cloud APIs, remote cleanup, or Git checkout are added.

## 0.5.0 — 2026-11-01

- Private documents: `docatlas private init|status|backup|list|restore|help` keeps documents that
  only you see in `.docatlas/private/<feature>/` at the project root (the repository top folder in
  git). `init` hides the folder from git through `.git/info/exclude`, for your clone only, and
  checks that git no longer sees it. `backup` copies the folder to
  `~/.docatlas/private-backups/<origin>/<time>/`, makes no copy when nothing changed, and keeps the
  newest ten backups of the project (`--keep <n>` to keep more in that run). Files that did not change
  are shared between backups with hard links, so ten backups take little more space than one; a zip or
  a plain copy keeps every file, only without the sharing. The origin can be on any host, such as
  GitHub or GitLab; without one, the folder name and a code from its path are used. A file whose name
  contains a backslash is left out with a warning, since Windows could not restore it. `restore`
  brings the documents and the hiding rule back in a new clone of the same repository, previews with
  `--dry-run`, and keeps files that differ unless you add `--force`, which saves them first. The
  commands never ask questions and print tab-separated lines, so an agent can run them.
- The document map shows private documents in a Private group marked "Only on this computer", with
  a Private badge in the reader and search results. Settings, `.gitignore`, `--docs-dir`, and
  `--all-md` do not change that group. When the private folder is empty and a backup exists, the
  map prints a one-line restore reminder; it never restores on its own.
- Agent kit 1.3.0 adds `doc-driven-private-v1` 1.0.0, a thin skill and rule on top of the designer
  for private documents. It is not installed by default: `docatlas agents install --all` installs
  all four pairs, or choose it with `--only` together with the designer. `docatlas agents help`
  shows which items need another one. Agents back up private documents on their own only once per
  implementation phase, when everything but your manual checks is done; otherwise only when you ask.
  `doc-driven-implementer-v1` 1.3.0 does the same when its phase documents are private, so the
  document map suggests updating it. The designer and reviewer did not change.

## 0.4.2 — 2026-11-01

- Agent kit 1.2.0 with `doc-driven-designer-v1` 1.3.0, `doc-driven-implementer-v1` 1.2.0, and
  `doc-driven-reviewer-v1` 1.5.0. Each phase in `IMPLEMENT.md` now gets a `Refs:` line with the
  IDs it covers and, once implemented, a `Files:` list of the files it changed, taken from git, in
  a fixed format that tools can read line by line. The designer alone writes both and leaves out
  files from earlier uncommitted phases; the implementer follows the same rules and returns the
  list in its report, and the reviewer reports a list that does not match the changes. Existing
  phases are left as they are. The records are a search aid, not a complete index, so agents still
  search the text of older documents. If you copied the `AGENTS.md` starter from METHOD.md, add its
  new last line so agents that load no skill know this too. If you installed the skills with
  `docatlas agents install`, the document map shows a one-line notice; run the same command again
  to update them.
- Codex rule copies from docatlas 0.3.0 to 0.4.1 are recognized as earlier versions even without
  an install record, so they are updated instead of skipped.

## 0.4.1 — 2026-10-30

- Agent kit 1.1.0 with `doc-driven-designer-v1` 1.2.0. The designer places new documents at the
  level of a group the code already shows instead of a `docs/` folder beside every module, gives a
  feature that spans several modules one location, and asks you where documents belong when the
  code layout does not make it clear. If you installed the skills with `docatlas agents install`,
  the document map shows a one-line notice; run the same command again to update them.

## 0.4.0 — 2026-10-29

- `docatlas agents install` now installs the designer, implementer, and reviewer by default.
  Add `--only <name>` to install fewer. After an earlier designer-only install, running the default
  command again adds the implementer and reviewer. Clients are still chosen from the folders in the
  home folder, so a Claude Code-only or Codex-only setup gets only its own files.
- `docatlas agents help` no longer tells AI agents to ask whether to add the implementer and
  reviewer, since the default already includes them.

## 0.3.1 — 2026-10-28

- Exclude `.conda` by default at any depth, so a conda environment created inside a project
  (the folder name VS Code uses) keeps its package docs off the map. Other names, such as `env`,
  are still included; add them to `.gitignore` or `exclude`.
- `docatlas --help` links to the configuration guide instead of a README section.
- `docatlas agents help` tells AI agents to ask whether to add the implementer and reviewer
  when the user did not say what to install, to report skipped or blocked files after an
  install, and never to add `--force` without the user's permission.
- For agents other than Claude Code and Codex, `docatlas agents help` prints where the skill and
  rule sources are, and the "no client folder" and unknown `--target` errors point to it.

## 0.3.0 — 2026-10-28

- Add `docatlas agents install` and `docatlas agents help`, which install the doc-driven
  designer, implementer, and reviewer skills and rules for Claude Code and Codex. Installs are
  previewable, protect edited and newer files, and can be re-run to update.
- Show a one-line notice when the document map starts and installed skills are older than the
  packaged agent kit. The notice never writes files.
- Ship the agent kit (`agent-kit/`) in the package.
- Exclude Python environments, caches, and package metadata (`.venv`, `venv`, `.tox`, `.nox`,
  `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.eggs`, `*.egg-info`) and Java
  build and dependency caches (`target`, `.gradle`, `.m2`) by default at any depth.
- Check macOS and Windows on Node 22 and 24 in CI.

## 0.2.0 — 2026-10-28

- Add `--docs-dir` to collect more directories and `--all-md` to collect all Markdown.
- Use `docatlas.config.json` as the configuration file, falling back to the legacy
  `ddd-docmap.config.json`.
- Show each search result's full path as a **Show in tree** button that reveals the document in
  the map without leaving the current reader.

## 0.1.0 — 2026-10-28

First release under the `docatlas` name, with the `docmap` and `ddd-docmap` commands kept as
aliases.

- Local document map of cards grouped by area and feature, with each feature's requirements,
  design, implementation, and manual-check documents.
- Markdown reader with server-side rendering, raw HTML disabled, an outline, source view,
  relative links and anchors, and local raster images.
- Search across titles, paths, descriptions, and document text.
- Live updates when documents, images, configuration, or ignore rules change.
- Optional configuration for include/exclude rules, group labels, and redirects.
- A foreground loopback server that stops cleanly with Ctrl+C.
