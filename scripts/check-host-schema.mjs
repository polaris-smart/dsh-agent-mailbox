// Real-host local gate: installed DSH registry, project MCP, no providers.
// Module settings are file paths, never credentials. Package fixture callers
// may point MAILBOX_PLUGIN_MODULE at the installed dist/plugin.js.
import { pathToFileURL } from 'node:url';
import { MailboxMcpClient } from '../dist/mcp-client.js';
const [sessionFile, executable = 'agent-mailbox', ...executableArgs] = process.argv.slice(2);
if (!sessionFile || !process.env.DSH_TOOLS_MODULE) {
  console.error('Usage: DSH_TOOLS_MODULE=<installed dsh-tools module> node scripts/check-host-schema.mjs <private session file> [executable] [prefix args...]');
  process.exit(1);
}
const hostUrl = pathToFileURL(process.env.DSH_TOOLS_MODULE);
const { assertSupportedJsonSchema, assertObjectJsonSchema, ToolRuntime } = await import(hostUrl.href);
const { Context } = await import(new URL('../../cordis/lib/index.js', hostUrl).href);
const { apply } = await import(process.env.MAILBOX_PLUGIN_MODULE ? pathToFileURL(process.env.MAILBOX_PLUGIN_MODULE).href : '../dist/plugin.js');
const config = {sessionFile, executable, executableArgs};
const client = new MailboxMcpClient(config);
const ctx = new Context();
ctx.provide('systemPrompt', {tools: () => () => {}});
const registry = new ToolRuntime(ctx, {mode:'native'});
try {
  const tools = await client.listTools();
  for (const tool of tools) { assertSupportedJsonSchema(tool.inputSchema); assertObjectJsonSchema(tool.inputSchema); }
  assertSupportedJsonSchema({type:'string'});
  await apply(ctx, config);
  const registered = registry.schemas();
  if (registered.length !== tools.length) throw new Error('Incomplete host registration');
  const context = await registry.get('project_context').execute({}, {signal:new AbortController().signal});
  if (typeof context !== 'string' || !context.length) throw new Error('No project context');
  console.log(JSON.stringify({hostSchemaGate:'passed',actualHostRegistry:true,toolCount:tools.length,contextSuccess:true,providerCalls:0}));
} catch {
  console.error('DSH host gate failed; check mailbox schemas, connection and installed host compatibility.');
  process.exitCode = 1;
} finally { client.dispose(); await ctx.fiber.dispose(); }
