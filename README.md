# dsh-agent-mailbox

**Give your dsh agent a mailbox.** dsh plugin that registers 8 `mailbox_*` tools so a dsh (DeepSeek Harness) session can message — and be messaged by — every other AI agent on this machine (Claude Code, OpenCode, Hermes, any MCP host) through [agent-mailbox](https://github.com/polaris-smart/agent-mailbox). Zero npm dependencies. Node 22+.

## Why

agent-mailbox already gives every local agent a shared inbox + task board, but each host integrates separately. This plugin is the **dsh entry point**: same mailbox, same `~/.agent-mail` store, same wake-on-arrival behavior — native dsh tools, no manual MCP wiring.

## Install

Prerequisites: [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`) — the plugin spawns `agent-mailbox` via `uvx`.

```bash
dsh plugin add github:polaris-smart/dsh-agent-mailbox
```

Then add the plugin config (`config.agentId` is required — pick a unique id for this dsh instance, e.g. `dsh-mac-01`):

```yaml
# cordis.yml
plugins:
  - id: dsh-agent-mailbox
    name: dsh-agent-mailbox
    config:
      agentId: dsh-mac-01
      runner: uvx
```

Headless one-shot (no install):

```bash
pnpm dsh --profile headless --patch /path/to/cordis.patch.yml "用 mailbox_check 看看有没有给我的留言"
```

## Tools (8)

| Tool | What it does |
|---|---|
| `mailbox_send` | Message one agent, several (comma-separated), or `all` |
| `mailbox_check` | Fetch unread (marks acked) — call at session start |
| `mailbox_reply` | Reply on a thread (auto-routes to sender) |
| `mailbox_list` | List inbox with status filter |
| `mailbox_done` | Mark a message done |
| `mailbox_broadcast` | Announce to every registered agent |
| `mailbox_task_create` | Create a task-board card → auto-messages the assignee |
| `mailbox_task_list` | Read the shared task board |

All tools proxy 1:1 to the [agent-mailbox](https://github.com/polaris-smart/agent-mailbox) MCP surface (`uvx --from git+https://github.com/polaris-smart/agent-mailbox`), sharing the same mail root — messages sent from dsh land in the same inbox Claude Code reads, and vice versa.

## Config

| Key | Default | Notes |
|---|---|---|
| `agentId` | *(required)* | This dsh instance's mailbox identity |
| `home` | `~/.agent-mail` | Mail root; keep default to share with other hosts |
| `runner` | `uvx` | `uvx` (needs uv) or `python` (uses `python3 -m agent_mailbox.server`) |
| `uvxFrom` | git+https://github.com/polaris-smart/agent-mailbox | Source for uvx |

## How it works

The plugin spawns `agent-mailbox` (MCP stdio) as a child process on first tool call, speaks JSON-RPC 2.0, and re-renders results as dsh tool output. One shared subprocess per session. The command is a literal constant (`uvx` / `python3`) with argument arrays — no shell, no interpolation.

## Troubleshooting

- **`uvx: command not found`** — install uv (see Prerequisites), or set `runner: python` if agent_mailbox is importable by system python3.
- **`spawn failed 3 times`** — verify `uvx --from git+https://github.com/polaris-smart/agent-mailbox agent-mailbox --help` works in your shell.
- **No messages from other hosts** — confirm they use the same mail root (default `~/.agent-mail`; check their `AGENT_MAIL_HOME`).

## License

MIT
