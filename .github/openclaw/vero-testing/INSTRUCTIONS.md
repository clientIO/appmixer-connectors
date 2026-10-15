# Pipeline Testing stage — launcher

You were started by the `vero-testing` hook: a card of the @appmixer-connectors project moved to
**Testing**. Your only job is to start the deterministic Testing runner.

1. Run exactly the command from your instruction:
   `cd /root/.openclaw/workspace-vero/pipeline-testing && ./start.sh <pr> <item> <project> <field> <target>`
2. Reply with the single line it printed (`STARTED: …` or `REFUSED: …`) and stop.

Do not run tests yourself, do not read or change the repository, do not post to GitHub or Slack.
The runner (`testing.mjs`) works in the background and reports its result to Appmixer on its own.
