# dsh-agent-mailbox PRD

> 版本：v0.1（2026-09-15 首发，随 0.1.0 建立）
> 定位：dsh (DeepSeek Harness) 会话内 agent 与本机其他 AI 宿主（Claude Code / OpenCode / Hermes / 任意 MCP host）之间的**信箱桥**。业务全在 agent-mailbox 侧，本插件只做 dsh 工具面 → MCP stdio 的一跳转发。

## 工具面（8 个，与 agent-mailbox MCP 面 1:1）

| 工具 | 语义 | 红线 |
|------|------|------|
| mailbox_send | 单发/群发(逗号)/广播(all) | from 缺省取 config.agentId，不伪造身份 |
| mailbox_check | 收未读（mark=false 只读） | |
| mailbox_reply | 线程回复，自动路由原发件人 | |
| mailbox_list | 收件箱（status 过滤） | |
| mailbox_done | 消息 done 归档 | |
| mailbox_broadcast | 全体公告 | |
| mailbox_task_create | 任务板建卡 → 自动向 assignee 发信唤醒 | |
| mailbox_task_list | 任务板列表 | |

## 兼容矩阵

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node | ≥22.18 | --experimental-strip-types |
| agent-mailbox | ≥0.4.0 | uvx --from git+… 或 python3 -m |
| dsh / cordis | 4.x | Config 必须带 ~standard.validate |

## 红线（继承 agent-mailbox 项目纪律）

1. **零 npm 依赖**（node: 内置模块之外不引包）
2. **命令字面量**：spawn 命令只能是 'uvx'/'python3' 常量 + 参数数组，无 shell 无拼接
3. **零业务复制**：状态机/锁/协议全在 agent-mailbox 侧，插件壳禁止第二实现
4. **config.agentId 必填校验**（Standard Schema validate 吵闹失败，不静默默认）

## 发布渠道

- npm `dsh-agent-mailbox`（repository 指回 GitHub，dshmarket 自动采集钩子）
- GitHub Releases（tag 触发，publish job 手动 dispatch）
- awesome-dsh-plugins 清单（PR #94 在审）
