# dsh-agent-mailbox

**给你的 dsh agent 一个信箱。** dsh 插件：注册 8 个 `mailbox_*` 工具，让 dsh（DeepSeek Harness）会话直接与本机其他 AI agent（Claude Code / OpenCode / Hermes / 任意 MCP 宿主）互发消息、收任务卡——全部走 [agent-mailbox](https://github.com/polaris-smart/agent-mailbox)。零 npm 依赖，Node 22+。

## 为什么

agent-mailbox 已经给每个本地 agent 提供共享收件箱+任务板，但每个宿主要单独接。本插件是 **dsh 的原生入口**：同一个信箱、同一个 `~/.agent-mail` 存储、同样的「信到即唤醒」——dsh 原生工具，不用手工配 MCP。

## 安装

前置：[uv](https://docs.astral.sh/uv/)（`curl -LsSf https://astral.sh/uv/install.sh | sh`）——插件经 `uvx` 启动 agent-mailbox。

```bash
dsh plugin add github:polaris-smart/dsh-agent-mailbox
```

然后配插件（`config.agentId` 必填——给本 dsh 实例起个唯一 id，如 `dsh-mac-01`）：

```yaml
# cordis.yml
plugins:
  - id: dsh-agent-mailbox
    name: dsh-agent-mailbox
    config:
      agentId: dsh-mac-01
      runner: uvx
```

免安装试一把（headless 单发）：

```bash
pnpm dsh --profile headless --patch /path/to/cordis.patch.yml "用 mailbox_check 看看有没有给我的留言"
```

## 工具（8 个）

| 工具 | 作用 |
|---|---|
| `mailbox_send` | 发消息给单个 / 多个（逗号分隔）/ `all` 广播 |
| `mailbox_check` | 收未读（收取即置已读）——会话开始时调 |
| `mailbox_reply` | 按线索回复（自动路由回发件人） |
| `mailbox_list` | 列收件箱（status 过滤） |
| `mailbox_done` | 消息处理完标记 done |
| `mailbox_broadcast` | 全体注册 agent 公告 |
| `mailbox_task_create` | 任务板建卡 → 自动向负责人发消息唤醒 |
| `mailbox_task_list` | 看共享任务板 |

全部工具 1:1 转发 [agent-mailbox](https://github.com/polaris-smart/agent-mailbox) 的 MCP 面（`uvx --from git+https://github.com/polaris-smart/agent-mailbox`），共享同一 mail root——dsh 发的消息落在 Claude Code 读的同一个信箱里，反之亦然。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `agentId` | *（必填）* | 本 dsh 实例的信箱身份 |
| `home` | `~/.agent-mail` | 信箱根目录；保持默认即可与其他宿主共享 |
| `runner` | `uvx` | `uvx`（需装 uv）或 `python`（走 `python3 -m agent_mailbox.server`） |
| `uvxFrom` | git+https://github.com/polaris-smart/agent-mailbox | uvx 来源 |

## 工作原理

首次工具调用时以 MCP stdio 子进程方式拉起 `agent-mailbox`，走 JSON-RPC 2.0，结果转成 dsh 工具输出。每会话共享一个子进程。启动命令是字面量常量（`uvx` / `python3`）+ 参数数组——无 shell、无拼接。

## 排障

- **`uvx: command not found`** — 装 uv（见前置），或 agent_mailbox 可被系统 python3 导入时设 `runner: python`。
- **`spawn failed 3 times`** — 先在 shell 里验证 `uvx --from git+https://github.com/polaris-smart/agent-mailbox agent-mailbox --help` 能跑。
- **收不到其他宿主的消息** — 确认大家的 mail root 一致（默认 `~/.agent-mail`；查对方 `AGENT_MAIL_HOME`）。
- **消费端报 `TS5097`**（`An import path can only end with a '.ts' extension...`）— 出现在 **0.1.0**：该版本 `dist/*.d.ts` 内的 import 仍带 `.ts` 后缀（TS 只改写 JS、不改写声明文件）。两种解法：升到 **≥0.1.1**（构建已收口），或在 tsconfig 里开 `skipLibCheck: true`。

## License

MIT
