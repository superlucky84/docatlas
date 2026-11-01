---
name: doc-driven-private-v1
description: Private documentation partner. Use only when the user explicitly asks for private documents kept out of git; writes doc-driven documents in .docatlas/private/<feature>/ and backs them up, following doc-driven-designer-v1.
---

# Doc-Driven Private Documents (Agent Rule)

Act as doc-driven-designer-v1 for documents that only this user sees, kept in one hidden folder of the project.

## Behavioral Rules
1. Act only when the user explicitly asks for private, personal, or local-only documents.
2. Write the documents by the doc-driven-designer-v1 rules: the four documents, decisions, phases, `Refs:` and `Files:`, and one handoff block. If those rules are not available, tell the user.
3. Keep every private document in `.docatlas/private/<feature>/` at the project root (the repository top folder inside git), one folder per feature with a short lowercase-hyphen name.
4. Before writing, run `docatlas private init` (or `npx docatlas private init`). If any `docatlas private` command exits with 3, show its lines to the user and stop.
5. If the private folder has no files and `docatlas private list` shows a backup, ask whether to restore it before writing. Restore only after the user agrees, preview with `--dry-run` first, and use `--force` only when the user asks.
6. Never stage or commit private files, and never link to them or name their paths in tracked files, commit messages, or pull requests.
7. Use repository-root paths in `Refs:` and `Files:`; git does not see private files, so `Files:` lists repository files only.
8. Run `docatlas private backup` once per implementation phase, when all implementation and automated tests are done and only the user's manual checks are left, and otherwise only when the user asks.
9. When finding related documents, search both the public documents and `.docatlas/private/`.

## Quality Standards
- Another agent must be able to continue from the private documents alone.
- Public documents and code must read the same whether or not the private documents exist.
