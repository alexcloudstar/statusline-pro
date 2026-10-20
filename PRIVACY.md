# Privacy

statusline-pro collects nothing and sends nothing.

- It makes no network calls. Nothing leaves your machine.
- It sends nothing to the model, so it adds nothing to the model's context or to your token use.
- It writes no files and keeps no logs on disk. Its figures live in the session's memory and are gone when the session ends.
- It has no accounts, analytics, telemetry or third-party services.

What it reads, all locally and only to draw the status line on your screen:

- Claude Code's own session figures: model, effort, context use, rate limits, cost and working directory.
- Read-only `git` output (branch name, whether the tree is dirty, number of unpushed commits) from the session's working directory.
- The `.json` files in `~/.claude/status-segments/` (or `$CLAUDE_CONFIG_DIR/status-segments/`), if you or another tool put any there.

The only thing it writes is its own settings fields (`statusline-pro.*`) through Claude Code's `/config`, when you change them in the settings pane.

The full list of engine calls it makes is in the [README](README.md#what-it-does-and-touches).

Questions: open an issue at https://github.com/alexcloudstar/statusline-pro/issues.
