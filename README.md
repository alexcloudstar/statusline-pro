<div align="center">

# statusline-pro

**A configurable status line for Claude Code.**<br>
Model, effort, context, rate limits, directory, git and cost on one line under the prompt, plus badges from your other mods.

[![Version](https://img.shields.io/badge/version-1.0.0-61afef.svg)](https://github.com/alexcloudstar/statusline-pro/releases)
[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-c678dd.svg)](https://code.claude.com/docs/en/plugins/mods/overview)
[![License: MIT](https://img.shields.io/badge/license-MIT-98c379.svg)](LICENSE)

</div>

```text
Opus 5.5 · high · ctx ▰▰▱▱▱ 40% · 5h ▰▱▱▱▱ 20% ↻2h41m · ~/app · ⎇ main* ↑2
```

## Install

Needs a Claude Code build that supports [mods](https://code.claude.com/docs/en/plugins/mods/overview) (function hooks).

```text
/plugin marketplace add alexcloudstar/statusline-pro
/plugin install statusline-pro@statusline-pro
```

<details>
<summary>From a terminal instead</summary>

```sh
claude plugin marketplace add alexcloudstar/statusline-pro
claude plugin install statusline-pro@statusline-pro
```

</details>

The line replaces the hint row under the prompt ("? for shortcuts"). It does not touch a `statusLine` configured in `settings.json`; delete that entry if you want only this one.

## Segments

| Id | Shows | `auto` means |
| --- | --- | --- |
| `model` | the active model | always |
| `effort` | reasoning effort | when the model reports one |
| `context` | context window use | always |
| `five_hour` | 5-hour rate limit and reset | always |
| `week` | 7-day rate limit | once usage reaches `week_min_pct` (60) and the limit hasn't reset |
| `dir` | working directory, shortened | always |
| `git` | branch, `*` dirty, `↑n` unpushed | inside a git repo |
| `cost` | session cost | once it reaches `cost_min_usd` (1) |

Gauges turn to the theme's warning color from 60% and its error color from 85% (context: 50% and 80%).

## Settings

`/statusline-pro settings` opens a pane with a live preview. Click a segment's state to cycle `auto`, `always`, `never`; use the arrows to reorder. The same fields are in the `/config` menu and on the install screen.

| Field | Default | |
| --- | --- | --- |
| `show_<id>` | `auto` | `auto`, `always` or `never` for each segment above |
| `week_min_pct` | `60` | usage at which `auto` shows the 7-day limit |
| `cost_min_usd` | `1` | cost at which `auto` shows the cost |
| `separator` | ` · ` | text between segments |
| `order` | empty | comma list of ids, first to last; the rest follow in default order |
| `hidden_segments` | empty | comma list of drop-in ids to hide |

`/statusline-pro` with no argument hides or shows the whole line.

## Badges from other mods

Any mod or script can add a segment by writing a JSON file to `~/.claude/status-segments/<name>.json`:

```json
{ "label": "deploy", "text": "v42 live", "color": "warning" }
```

- `text` is required (40 characters). `label` is optional (16). `color` is a theme color name such as `claude`, `warning` or `error`.
- The line reads the folder every 10 seconds and after each turn. Delete the file to drop the segment.
- At most 12 files of 2 KB each. Symlinks are skipped. Control characters are stripped.
- Segments get the id `ext:<name>`. Use it in `order` and `hidden_segments`, or toggle it in the pane.

## What it reads

- Claude Code's own session figures: model, effort, context, rate limits, cost.
- `git` in the session's directory (`rev-parse`, `status`, `rev-list`), every 10 seconds and after each turn. Nothing leaves your machine.
- `~/.claude/status-segments/*.json` under `CLAUDE_CONFIG_DIR`, or `~/.claude`.

It sends nothing over the network and adds nothing to the model's context or your token use.

## Develop

```sh
claude plugin validate .
claude plugin test .
```

Type-check with `tsc` against the types Claude Code writes into `.claude-plugin/types/` once the mod has loaded (`claude --plugin-dir .`).

## License

[MIT](LICENSE)
