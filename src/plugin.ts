import { MailboxMcpClient } from './mcp-client.ts';
import { Config, type ResolvedConfig } from './config.ts';
import type { MailboxContext } from './types.ts';
export const name = 'dsh-agent-mailbox';
export const inject = ['tools'];
export { Config };
/** Async activation discovers the authorized server tools before publishing any. */
export async function apply(ctx: MailboxContext, config: ResolvedConfig): Promise<void> {
  const client = new MailboxMcpClient(config);
  const unregister: Array<() => void> = [];
  let closed = false;
  const cleanup = () => { closed = true; for (const dispose of unregister.splice(0)) dispose(); client.dispose(); };
  ctx.effect(() => cleanup, 'project mailbox connection');
  try {
    const tools = await client.listTools();
    if (closed) throw new Error('Mailbox plugin was disposed during activation.');
    for (const tool of tools) unregister.push(ctx.tools.register({
      name: tool.name, description: tool.description ?? `Project mailbox: ${tool.name}`,
      parameters: tool.inputSchema,
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: (args, exec) => client.callTool(tool.name, args, exec?.signal),
    }));
  } catch (error) { cleanup(); throw error; }
}
