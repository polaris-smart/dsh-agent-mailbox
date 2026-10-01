# dsh-agent-mailbox


给**已有 DeepSeek Harness 会话**接入 [agent-mailbox](https://github.com/polaris-smart/agent-mailbox) 项目信箱：进组、读共享资料、发邮件、更新自己负责的任务。员工继续用自己的模型和账号；插件不会启动另一个员工 CLI，也不替你配置 LLM。

[English](README.md)

## 从旧版升级

0.8 替换旧版全局信箱桥接。旧的 `agentId`、`home`、`runner`、`uvxFrom`、`pythonSrc` 配置会明确报迁移提示；不会自动导入旧全局信箱。

1. 安装 agent-mailbox v0.8，打开工作台。
2. 登记 DSH 员工、加入项目，导出该员工的**私有会话连接文件**。
3. 在 DSH 环境安装插件，给项目会话加 overlay：

```yaml
- insert:
    - id: dsh-agent-mailbox
      name: dsh-agent-mailbox
      config:
        sessionFile: /absolute/path/to/private/employee-session.json
        executable: /absolute/path/to/agent-mailbox
```

`executable` 是已安装的 agent-mailbox 命令或后台程序，不是 DMG 文件。Python 安装可用 `executable: /absolute/path/to/python` 和 `executableArgs: ['-m', 'agent_mailbox']`。参数以数组传入，不经过 shell。不要在配置、仓库或聊天中放 provider key 或信箱 token。

使用宿主现有的 profile/patch 方式打开新会话；不承诺现有聊天自动热加载。工作台须保持运行，重启更换本机端口后连接仍能找到它。会话到期、撤销或成员退出，需要重新接入。

## 工具与职责

激活时发现服务器实际授权的 `project_*` 工具及参数 schema。当前包含项目上下文、共享资料/笔记、收发邮件，以及自己的任务进度接口。没有旧 `mailbox_*` 全局别名、发件人身份覆盖或启动受管任务的唤醒工具。

一个私有 session 文件绑定一个员工与一个项目。读信不代表接受任务或完成；普通邮件不启动任务；Human 验收独立记录。子代理向负责人汇报，不得共享负责人会话文件。自动提醒是否可用取决于宿主能力，不是装了此工具桥就保证自动唤醒。

插件实例各自连接、各自释放；启动失败明确报错，卸载时注销工具并退出 MCP 子进程。插件不读取 token 或数据库。

## 验证与发布

需要 Node >=22.18；宿主提供 `@deepseek-ai/cordis` peer。开发命令见英文 README。候选源码版本为 `0.8.0`，源码更新不等于 npm 已发布。

既有 npm 包名为 `dsh-agent-mailbox`，维护者 `polaris-smart`。发包必须显式指定 `--registry=https://registry.npmjs.org`；不要使用其他人的 npm 无 scope 同名包 `agent-mailbox`。

## 协议

独立适配器保留原有 **MIT** 协议与版权声明。agent-mailbox v0.8 应用另采用 **Apache-2.0**、NoFox 署名，两者分别适用。
