---
name: doc-driven-backup-v1
description: Help with explicitly requested cloud backup, restore, connection, or inspection of private project documents. Use existing local backups and a user-selected cloud folder. Do not invoke for ordinary coding, local phase backups, or unsolicited backup reminders.
metadata:
  short-description: requested private cloud backup and restore
  version: 1.0.0
---

# Private Cloud Backup and Restore

Use this skill only for the cloud management task the user requests. Installation, a saved connection, changed documents, a phase ending, and a local backup finishing are not requests. Do not suggest backing up during unrelated work or add automatic retries, hooks, watchers, or reminders. Other doc-driven skills remain independent.

## Tools and Boundaries

Run docatlas private-cloud help first; use npx docatlas private-cloud help if the command is not installed locally. If that version lacks the helper, explain the version gap instead of writing ad hoc archive/extraction scripts.

The helper returns JSON and exit codes: 0 complete/unconfigured, 1 failure, 2 invalid arguments, 3 needs attention. Read the result; stop on 3 and resolve only the reported choice or blocker. Use the existing docatlas private commands for local documents. Never stage private files or change shared project configuration to store cloud credentials or paths.

The helper uses installed system tar to prepare a plain, unencrypted archive with equal content stored once. It validates imported files and reconstructs local hard-link sharing. It does not contact a cloud API, log in, verify remote delivery, check out Git, merge documents, or delete remote backups. A prepared file is not proof of upload.

## Connect or Inspect, When Requested

1. Run docatlas private-cloud connections from the project, adding --root when needed, then status --name <name>. Saved connections are per work folder and backup name. Reuse the requested name or the only existing connection; ask when several names are plausible.
2. If none exists, ask for the cloud service/folder or a backup file location. A clone, OS, or installed cloud app cannot reveal the previous account. Help the user sign in and identify the real local folder; do not search their entire home.
3. Prefer their existing connected cloud app. Google Drive and Dropbox work on supported Windows/macOS versions. Check the actual OS, client, account and folder rather than hardcoding a path. If system tar is missing, explain the required setup.
4. To discover an old backup, use projects --directory <folder>, then list --directory <folder> --key <project-key> --name <backup-name>. Recovery lists identify the project, named collection, tags, device and archive without first downloading every document.
5. Use connect --directory <folder> [--name <backup-name>] [--key <old-key>] after the target is chosen. A connection does not authorize future automatic cloud operations.

Names default to default. Offer a name when the user wants separate plans for the same repository; preserve the chosen name. Use --tag for a version label and --bundle for an exact immutable backup ID. Tags are backup labels, not Git checkout instructions. Never replace an existing tag with different content; duplicate tags or divergent heads require an ID choice.

For selected folders, add --path a or repeat --path a --path b to backup or restore. Paths are relative to .docatlas/private, not public docs/. Omit --path to export all private documents or restore all files in the chosen backup. Preserve their original relative locations; restoring a into a work folder containing c leaves a and c. Other existing folders are never deleted.

## Requested Backup

Run docatlas private-cloud backup [--name <backup-name>] [--tag <label>]. It uses the local backup command, bundles up to ten snapshots and prepares a recovery list in the chosen folder. If private files are not hidden, use docatlas private init and inspect its result before retrying.

Report the name/tag, bundle ID, prepared path and local result. Say prepared, not uploaded; guide the user to check the cloud app before switching computers. If the same backup is already valid, report unchanged. Do not remove older cloud archives or broaden a local-only backup request into cloud backup.

## Requested Restore

1. Get a location clue only if the connection is missing. Discover names and backups, match the repository key, and let the user choose when names, tags, devices or history heads are ambiguous. For an origin-less or renamed repository, use the old key printed in the recovery list.
2. Run docatlas private-cloud restore [--name <name>] [--tag <tag> | --bundle <id>]. Without --apply this is a read-only preview. An incomplete download, bad checksum or unsafe path is a blocker; keep the current documents.
3. Show the preview, then apply the selected backup after the user agrees by repeating the command with --apply. Differing existing files remain conflicts. Add --force only after the user explicitly asks to replace those files; the existing restore saves a before-restore backup first.
4. Report what was restored or left unresolved. Unlisted current files are kept. A successful apply records the new computer's connection and history base. Do not start a new cloud backup to resolve a conflict unless requested.

For alternating home/work PCs, use the saved connection on each PC: a requested backup at the end, cloud delivery confirmation, and a requested restore on the other PC. Compare content/history; clocks alone do not choose the latest version.

## Interrupted Work

An operation lock blocks a second run on the same local profile. Use status to inspect it. Never delete or expire a lock based only on age. Only use unlock --lock-id <displayed-id> when the user requests recovery and the helper confirms the owner stopped. Keep failed or incomplete remote data for inspection; do not claim success from a timestamp or an old state record.
