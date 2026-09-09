# Google Drive trigger stress test

A load test for the `google.drive` change-feed triggers, kept next to the connector so the
run that produced the numbers in
[appmixer-components#2829](https://github.com/Appmixer-ai/appmixer-components/issues/2829)
can be repeated with one command.

It is deliberately **not** an E2E test: it does not assert a component contract, it puts the
trigger under a change backlog it cannot process in one webhook and checks that nothing melts —
no lock storm, no lost events, no duplicates.

## What it proves

- **No lock storm.** `checkMonitoredFiles()` bounds its work per invocation and `tick()` skips a
  contended lock instead of retrying it 30 times. A failure here shows up as
  `LockError: Exceeded 30 attempts to lock the resource` in the report.
- **No lost events.** Every file created by the provoker reaches the trigger, even though the
  backlog spans several `changes.list` pages and several webhook deliveries.
- **No duplicates.** Google re-lists a freshly created file in the change feed with a higher
  `version` about 30 seconds and about 3 minutes after it was created, while
  `createdTime == modifiedTime` still holds, so the new-file filter matches it again. The
  processed-files buffer has to remember the id for long enough. The run window covers both
  re-lists, which is why the provoker waits five minutes before it cleans up.
- **Bounded lock hold.** With a connector that has the `changes-processed` log line, the report
  prints pages, deferred runs and the slowest run, so a regression in lock hold time is visible
  as a number rather than as a support ticket.

## Prerequisites

- The `appmixer` CLI logged in to the target instance (`appmixer url` prints which one).
- An `appmixer:google:drive` account with the full `drive` scope — the write components need
  more than `drive.readonly`. Its id goes into `--account`; the trigger components declare
  `auth.service: appmixer:google:drive`, so a connector-level `appmixer:google` account is not
  enough.
- Roughly 25 minutes of wall clock for the default size, most of it waiting.

## Running it

```bash
node src/appmixer/google/artifacts/stress-flows/run.js --account <accountId>
```

Options:

- `--files <n>` — files to create, default `300`.
- `--delay <ms>` — delay between two files, default `200`. Below roughly 60 ms per message the
  engine's own send quota starts cancelling messages (`Context send quota exceeded`), which
  fails the run for a reason that has nothing to do with the connector.
- `--keep` — leave both flows on the instance instead of removing them; the ids are printed.
- `--cleanup-wait <interval>` — how long the provoker waits before it deletes its folder,
  default `5m`. Only shorten it (`1m`) to smoke-test the harness itself: below three minutes the
  files are gone before Drive re-lists them, and the duplicate check stops meaning anything.
- `--connectors-dir <dir>` — pass the worktree root when you run this from a git worktree, so
  the CLI resolves `component.json` from the code under test rather than from the main checkout.

Exit code is `0` for a pass and `1` for a fail, so it can be wired into a release check.

## What the run does

1. Imports both flows under fresh component ids. Fresh ids matter: the component id is the key
   of the engine lock the trigger takes, so two runs sharing ids would contend for one lock.
2. Starts the trigger flow and waits a minute for the Drive change channel to be live.
3. Starts the provoker: `OnStart → SetVariable → CreateFolder → Each → CreateFileFromText`,
   `n` files into one `stress-burst-<timestamp>` folder.
4. Polls the provoker until it deletes its folder, which happens five minutes after the last
   file — past the window in which Drive re-lists a fresh file.
5. Reads every log entry of the trigger flow since the start and reports what the trigger
   emitted, how many runs it took and what errors it logged.
6. Stops and removes both flows (unless `--keep`). The burst folder and its files are deleted by
   the provoker itself, so nothing is left behind in the Drive account either.

## Reading the report

- `emitted` vs `distinct` — these must be equal. A gap means the same file was emitted twice,
  which is the dedupe regression described above.
- `distinct` must be at least `files + 1`; the extra one is the folder, which is also a new
  Drive item.
- `runs of checkMonitoredFiles` — one line per webhook or tick that did work. `deferred` counts
  runs that hit the page cap and handed the rest of the backlog to the next tick; that is
  healthy behaviour, not a failure.
- `lock / timeout errors` must be zero. Any `LockError`, `lock-lost`, `Cannot extend` or
  `timed out` entry fails the run.

## Things worth knowing before you run it

- **The trigger watches the whole drive**, on purpose — that is the shape the customer report in
  #2829 came from, and it needs no tenant-specific folder id. Run one stress test at a time on
  an account, and do not run it against an account a human is actively using: everything they
  create shows up as an extra emission.
- **Run it after a publish, not during one.** A flow started in the first seconds after
  `appmixer publish` can hit a worker that is still extracting the module; the runner retries a
  failed start a few times for that reason.
- **A worker can serve a stale shared `lib.js`** after a connector republish even when the
  components were removed first, because the module is extracted into a path that carries the
  *module* version. If the report shows behaviour the current code cannot produce, bump
  `module.json` and republish before believing it.
- While the flows exist they are tagged as E2E flows (that is what `appmixer e2e import` does,
  and it is also what binds the account), so they show up in `appmixer e2e list -c google` for
  the duration of the run. The runner removes them again at the end.
