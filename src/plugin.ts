// dsh-agent-mailbox：注册 mailbox_* 工具，让 dsh 会话内 agent 直接读写
// agent-mailbox（跨 agent 信箱 + 任务板）。业务全在 agent-mailbox 侧，
// 本插件只做「dsh 工具面 → MCP stdio」的一跳转发。

import { MailboxMcpClient, type Runner } from './mcp-client.ts'
import { Config, type ResolvedConfig } from './config.ts'
import { compileParameters, type MailboxContext, type MailboxToolDef } from './types.ts'

/** 稳定的 Cordis 插件名。 */
export const name = 'dsh-agent-mailbox'

/** 需要的服务：工具注册表。 */
export const inject = ['tools']

/** 合并配置 schema。 */
export { Config }

/** 模块级单例：整个 dsh 会话复用一个 MCP 子进程。 */
let client: MailboxMcpClient | null = null;
let agentId = '';

function getClient(cfg: ResolvedConfig): MailboxMcpClient {
  if (!client) {
    const runner: Runner = cfg.runner === 'python' ? 'python3' : 'uvx';
    const from = cfg.runner === 'python' ? '' : cfg.uvxFrom;
    client = new MailboxMcpClient(runner, from, cfg.home);
  }
  return client;
}

function me(cfg: ResolvedConfig, override: unknown): string {
  const id = typeof override === 'string' && override.length > 0 ? override : cfg.agentId;
  return id;
}

function register(ctx: MailboxContext, cfg: ResolvedConfig, def: Omit<MailboxToolDef, 'output'>): void {
  ctx.tools.register({
    ...def,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
  });
}

/**
 * 注册 8 个 mailbox_* 工具（对应 agent-mailbox MCP 面的一对一转发）。
 */
export function apply(ctx: MailboxContext, config: ResolvedConfig): void {
  agentId = config.agentId;

  register(ctx, config, {
    name: 'mailbox_send',
    description: '给本机其他 AI agent 发消息（收件人单个/多个/“all”广播）。收件人离线也没关系——消息留在信箱，对方下次 check 时唤醒。 agent 身份见 config.agentId。',
    parameters: compileParameters({
      to: { type: 'string', required: true, description: '收件人 agent id；多个用逗号分隔；"all" = 全体已注册 agent。' },
      subject: { type: 'string', required: true, description: '主题（一句话）。' },
      body: { type: 'string', required: true, description: '正文。' },
      priority: { type: 'string', description: 'normal（默认）/ urgent。' },
      from_id: { type: 'string', description: '发件人 id（默认用 config.agentId）。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('mailbox_send', {
        to: args.to,
        subject: args.subject,
        body: args.body,
        priority: typeof args.priority === 'string' ? args.priority : 'normal',
        from_id: typeof args.from_id === 'string' && args.from_id ? args.from_id : config.agentId,
      });
    },
  });

  register(ctx, config, {
    name: 'mailbox_check',
    description: '收自己的未读消息（收取即置已读）。会话开始时/任务完成时调用——别人给你的留言和任务卡通知都在这里。',
    parameters: compileParameters({
      agent_id: { type: 'string', description: '缺省用 config.agentId。' },
      mark: { type: 'string', description: '"false" 则只读不标记已读。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('mailbox_check', {
        agent_id: me(config, args.agent_id),
        mark: args.mark !== 'false',
      });
    },
  });

  register(ctx, config, {
    name: 'mailbox_reply',
    description: '回复一条收到的消息（自动路由回原发件人，主题带 Re:）。',
    parameters: compileParameters({
      msg_id: { type: 'string', required: true, description: '要回复的消息 id（msg-…）。' },
      body: { type: 'string', required: true, description: '回复正文。' },
      agent_id: { type: 'string', description: '缺省用 config.agentId。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('mailbox_reply', { msg_id: args.msg_id, body: args.body, agent_id: me(config, args.agent_id) });
    },
  });

  register(ctx, config, {
    name: 'mailbox_list',
    description: '列出收件箱（含已读/已归档，status 过滤：pending/acked/done/archived）。',
    parameters: compileParameters({
      agent_id: { type: 'string', description: '缺省用 config.agentId。' },
      status: { type: 'string', description: '按状态过滤，缺省全部。' },
    }),
    async execute(args) {
      const c = getClient(config);
      const status = typeof args.status === 'string' && args.status ? args.status : undefined;
      return c.callTool('mailbox_list', { agent_id: me(config, args.agent_id), status });
    },
  });

  register(ctx, config, {
    name: 'mailbox_done',
    description: '把一条消息标记 done（处理完毕归档）。',
    parameters: compileParameters({
      msg_id: { type: 'string', required: true, description: '消息 id。' },
      agent_id: { type: 'string', description: '缺省用 config.agentId。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('mailbox_done', { msg_id: args.msg_id, agent_id: me(config, args.agent_id) });
    },
  });

  register(ctx, config, {
    name: 'mailbox_broadcast',
    description: '给全体已注册 agent 广播公告（from 默认 config.agentId）。',
    parameters: compileParameters({
      subject: { type: 'string', required: true, description: '公告主题。' },
      body: { type: 'string', required: true, description: '公告正文。' },
      from_id: { type: 'string', description: '缺省用 config.agentId。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('mailbox_broadcast', {
        subject: args.subject,
        body: args.body,
        from_id: typeof args.from_id === 'string' && args.from_id ? args.from_id : config.agentId,
      });
    },
  });

  register(ctx, config, {
    name: 'mailbox_task_create',
    description: '在共享任务板建卡并派给某 agent（建卡自动发消息唤醒对方）。状态机 todo→doing→review→done。',
    parameters: compileParameters({
      title: { type: 'string', required: true, description: '任务标题。' },
      assignee: { type: 'string', required: true, description: '负责 agent id。' },
      due: { type: 'string', description: '截止时间（自由格式）。' },
      notify: { type: 'string', description: '"false" 则建卡不通知。' },
    }),
    async execute(args) {
      const c = getClient(config);
      return c.callTool('task_create', {
        title: args.title,
        assignee: args.assignee,
        due: typeof args.due === 'string' ? args.due : '',
        notify: args.notify !== 'false',
      });
    },
  });

  register(ctx, config, {
    name: 'mailbox_task_list',
    description: '看共享任务板（按 assignee/status 过滤）。',
    parameters: compileParameters({
      assignee: { type: 'string', description: '按负责 agent 过滤。' },
      status: { type: 'string', description: 'todo/doing/review/done。' },
    }),
    async execute(args) {
      const c = getClient(config);
      const assignee = typeof args.assignee === 'string' && args.assignee ? args.assignee : undefined;
      const status = typeof args.status === 'string' && args.status ? args.status : undefined;
      return c.callTool('task_list', { assignee, status });
    },
  });
}

/** dsh 卸载插件时释放 MCP 子进程。 */
export function dispose(): void {
  client?.dispose();
  client = null;
}

/** 供测试注入身份。 */
export function currentAgentId(): string {
  return agentId;
}
