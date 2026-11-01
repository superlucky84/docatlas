---
name: doc-driven-private-v1
description: Use only when the user explicitly asks for private, personal, or local-only documents that stay out of git. Writes the doc-driven document set in .docatlas/private/<feature>/ at the project root, hides that folder from git, and backs it up outside the project, following doc-driven-designer-v1 for the documents themselves.
metadata:
  short-description: private doc-driven documents
  version: 1.0.0
---

# Doc-Driven Private Documents Playbook

## Primary Goal
Keep documents that only this user sees in one hidden folder of the project, written the same way as doc-driven-designer-v1 documents, and never lose them when the clone is deleted.

## Scope
- Use this playbook only when the user asks for private, personal, or local-only documents. Otherwise use doc-driven-designer-v1 and its placement rules.
- This playbook adds location, hiding, and backup rules. For everything else (the four documents, decisions, phases, `Refs:` and `Files:`, the handoff block), follow doc-driven-designer-v1. If it is not available, tell the user that this playbook needs it.
- The `docatlas private` commands do the file work and never ask questions. If `docatlas` is not installed, run them as `npx docatlas private ...`. `docatlas private help` lists their output lines and exit codes.

## Location
- Private documents live in `.docatlas/private/<feature>/` at the project root, which inside git is the repository top folder wherever the command runs. All private documents share this one folder, one subfolder per feature; the designer's rule of placing documents beside the code does not apply.
- Name a feature folder in short lowercase words joined by hyphens. When the feature boundary is unclear, propose a name and ask.
- Leave other files in `.docatlas/`, such as `agents.json`, alone.

## Before Writing
1. Run `docatlas private init`. It creates the folder and hides it from git through `.git/info/exclude`, for this clone only.
2. If the folder has no files (`docatlas private status` shows `files 0`), run `docatlas private list`. If it lists a backup, ask the user whether to restore it before writing new documents.
3. To restore, run `docatlas private restore --dry-run`, show the lines to the user, and run `docatlas private restore` after they agree. Restore keeps files that differ; use `--force` only when the user asks, and it backs up the current files first.
4. If a command exits with 3, show its lines to the user and stop. Do not stage, commit, move, or delete files, or change ignore files, to get around it.

## Writing Rules
- Never stage or commit files under `.docatlas/private/`. Never link to them or name their paths in tracked files, commit messages, or pull requests.
- Private documents may link to public documents and code with relative links.
- Write `Refs:` and `Files:` as doc-driven-designer-v1 does, with repository-root paths, so the records point to the code the documents are not beside. git does not see private files, so `Files:` lists repository files only.
- Keep the handoff block in the feature's private `IMPLEMENT.md`.
- When an implementer or reviewer works from private documents, give it the private document path.

## Backup
- After changing private documents, and whenever the user asks, run `docatlas private backup`. It copies the folder to `~/.docatlas/private-backups/` and makes no copy when nothing changed.
- If the output has a `no-origin` warning, tell the user that a new clone needs `--key` with the printed key to find this backup.

## Finding Documents
- When finding documents about a feature, file, or ID, search both the public documents and `.docatlas/private/`.
