# Requested private cloud backups

Available in docatlas 0.6.0 and later. Earlier versions do not include these helpers.

The optional doc-driven-backup-v1 skill and agent rule help you back up or restore private
documents only when you ask. They do not run or remind you during coding, local phase
backups, startup, or merely because a cloud connection exists. The four existing skills and
their local backup behavior are unchanged.

The cloud app does the transfer. docatlas prepares a tar and a small recovery list in an
existing cloud folder; it does not log in or contact a cloud API. A prepared file is not proof
of upload. Check the cloud app before switching computers.

## Install the optional role

After installing a release that includes this feature:

    npx docatlas agents install --only doc-driven-backup-v1 --dry-run
    npx docatlas agents install --only doc-driven-backup-v1

The default install remains the designer, implementer and reviewer. --all adds both optional
private and backup roles. Codex also gets the new skill's explicit-invocation policy file.
No other skill or rule is updated by selecting this role.

The backup role does not need the designer. It uses the docatlas private-cloud helpers and
an installed system tar. If tar or the helper is unavailable, it explains the missing setup.

## Ask the agent

- "Use doc-driven-backup-v1. Back up my private documents to my Google Drive folder."
- "Back up only a and b, under the name personal, tagged before-release."
- "Restore tag before-release from personal; bring back only a and keep my local c."
- "On this new PC, help me restore this project's private documents from my cloud backup."

Paths are relative to .docatlas/private. Public docs/ is outside this role. Without a path
selection, a backup exports all private documents and a restore uses all files in the
chosen backup. A selected restore adds or updates only those files and never deletes
unlisted local files. Existing files with different contents are conflicts.

The first connection needs a location clue: the cloud service/folder or the backup location.
On a new machine the agent cannot infer your old account from a clone. It helps you connect
the cloud folder, reads the recovery lists, matches the repository key and backup name,
shows a restore preview, and applies after you agree. Origin-less or renamed repositories
may need the old project key from the recovery list.

For home/work use, connect each work folder once. Ask for a backup before leaving, confirm
cloud delivery, then ask for a restore on the other PC. Already imported content can be
reused. If both PCs have changed independently, choose a backup explicitly; the helper
does not merge or pick the newest-looking clock.

## Helper commands

These examples use an existing cloud folder outside the project. Replace the path with
the real directory on the current machine. The helper does not hardcode Drive mount paths.

    docatlas private-cloud connect --directory "/path/to/cloud folder" --name personal
    docatlas private-cloud connections
    docatlas private-cloud status --name personal
    docatlas private-cloud backup --name personal --tag v1 --path a --path b
    docatlas private-cloud list --name personal

Names isolate histories for the same repository. Tags label immutable backup versions,
not Git branches or code checkouts. A tag with different existing content is not replaced;
if two devices created the same tag concurrently, select an exact bundle ID.

Inspect on a fresh machine without saving a connection:

    docatlas private-cloud projects --directory "/path/to/cloud folder"
    docatlas private-cloud list --directory "/path/to/cloud folder" --name personal
    docatlas private-cloud restore --directory "/path/to/cloud folder" --name personal --tag v1 --path a

Restore is a read-only preview unless --apply is present. After agreeing to the preview:

    docatlas private-cloud restore --directory "/path/to/cloud folder" --name personal --tag v1 --path a --apply

Only add --force after explicitly deciding to replace differing files. It uses the existing
local restore and saves the current files first. Successful apply saves the new computer's
connection. You can choose --bundle <id> instead of --tag. Use --key <old-key> for a renamed
or origin-less project when needed.

Commands print one JSON result, except help. Exit codes: 0 complete/unconfigured,
1 operational failure, 2 invalid arguments, 3 needs attention. A lock, conflict,
incomplete download, unsafe path, or multiple history heads needs attention.

For an interrupted operation, inspect status. Only use unlock --lock-id <shown-id> when
the helper confirms that the owner stopped. A lock does not expire by age.

## Storage and limits

Local backups stay at ~/.docatlas/private-backups/. Cloud backup invokes the existing
local backup first, then exports only selected paths from up to ten snapshots.

The tar stores identical file contents once and a manifest records each snapshot's paths.
Import recreates complete local backups and shares unchanged content with hard links when
the filesystem supports them. Different tar files are independent; sharing does not extend
across those tar files.

The cloud app syncs docatlas-backups/<project-hash>/<name-hash>/<device-id>/ beneath the
selected directory. UUID file names avoid overwriting another device's backups. Small JSON
lists include the project key, name, tags, selected paths, checksums and history references.
They omit source absolute paths, credentials and host usernames.

Local connection and state files live in ~/.docatlas/private-cloud/<work-folder-hash>/<name-hash>/.
They are not written into tracked project configuration. The helper rechecks the actual
files and hashes instead of trusting a saved success timestamp.

The first format is a plain, unencrypted USTAR file, limited to 64 MiB per archive and
10,000 entries. No tar package or cloud SDK is installed. Imports accept only this helper's
bounded format; arbitrary tar links/extensions are rejected and never extracted by an OS command.
There is no remote automatic cleanup, background synchronization, encryption-key management,
automatic merge, or deletion of unlisted current documents.
