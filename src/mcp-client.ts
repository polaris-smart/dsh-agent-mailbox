import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { ResolvedConfig } from './config.ts';
interface Pending { resolve(value: unknown): void; reject(error: Error): void; cleanup(): void }
export interface McpTool { name: string; description?: string; inputSchema: Record<string, unknown> }
/** Match the official DSH MCP seam: exclude ambient credentials and DSH controls. */
export function scrubEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.keys(env)
    .filter(name => !/KEY|PASSWORD|SECRET|TOKEN/i.test(name) && !/^DSH_/i.test(name))
    .map(name => [name, env[name]]));
}
/** One child process per Cordis plugin instance; no identity override or shell. */
export class MailboxMcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = '';
  private ready: Promise<void> | null = null;
  private disposed = false;
  private readonly config: ResolvedConfig;
  private readonly timeoutMs: number;
  constructor(config: ResolvedConfig, timeoutMs = 30_000) { this.config = config; this.timeoutMs = timeoutMs; }
  ensureReady(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Mailbox connection is disposed.'));
    if (!this.ready) this.ready = this.bootstrap();
    return this.ready;
  }
  private async bootstrap(): Promise<void> {
    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(this.config.executable, [...this.config.executableArgs, 'mailbox-mcp', '--session-file', this.config.sessionFile], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, env: scrubEnvironment() });
    } catch { throw new Error('Mailbox executable could not start. Check executable and sessionFile.'); }
    this.proc = proc;
    const decoder = new StringDecoder('utf8');
    proc.stdout.on('data', (chunk: Buffer) => this.onData(decoder.write(chunk)));
    proc.stderr.on('data', () => {}); // Never echo private backend diagnostics.
    proc.on('error', () => this.fail(new Error('Mailbox executable could not start. Check executable and sessionFile.')));
    proc.on('exit', () => { this.proc = null; this.fail(new Error('Mailbox connection exited. Reconnect the project employee.')); });
    try {
      await this.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dsh-agent-mailbox', version: '0.8.0' } });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    } catch (error) { this.dispose(); throw error; }
  }
  private onData(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 4 * 1024 * 1024) { this.fail(new Error('Mailbox response exceeded the safe limit.')); this.dispose(); return; }
    let index: number;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
      if (!line.trim()) continue;
      let response: { id?: number; result?: unknown; error?: unknown };
      try { response = JSON.parse(line); } catch { continue; }
      if (typeof response.id !== 'number') continue;
      const item = this.pending.get(response.id);
      if (!item) continue;
      this.pending.delete(response.id); item.cleanup();
      if (response.error) item.reject(new Error('Mailbox protocol request failed. Reconnect this project employee.'));
      else item.resolve(response.result);
    }
  }
  private fail(error: Error): void {
    for (const item of this.pending.values()) { item.cleanup(); item.reject(error); }
    this.pending.clear();
  }
  private call(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const proc = this.proc;
    if (!proc?.stdin.writable) return Promise.reject(new Error('Mailbox connection is unavailable.'));
    if (signal?.aborted) return Promise.reject(new Error('Mailbox request cancelled.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.pending.delete(id); cleanup();
        if (proc.stdin.writable) proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: id } }) + '\n');
        reject(new Error('Mailbox request cancelled.'));
      };
      const timer = setTimeout(() => { this.pending.delete(id); cleanup(); reject(new Error('Mailbox request timed out.')); }, this.timeoutMs);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', error => {
        if (error) { this.pending.delete(id); cleanup(); reject(new Error('Mailbox transport failed.')); }
      });
    });
  }
  async listTools(): Promise<McpTool[]> {
    await this.ensureReady();
    const result = await this.call('tools/list', {}) as { tools?: McpTool[]; nextCursor?: string };
    if (!result || result.nextCursor || !Array.isArray(result.tools) || !result.tools.length || result.tools.length > 64) throw new Error('Mailbox tool discovery failed. Install agent-mailbox v0.8 or newer.');
    const names = new Set<string>();
    for (const tool of result.tools) {
      if (!/^project_[a-z_]+$/.test(tool.name) || !tool.inputSchema || tool.inputSchema.type !== 'object' || names.has(tool.name)) throw new Error('Unsupported mailbox tools. Export a v0.8 project connection.');
      names.add(tool.name);
    }
    return result.tools;
  }
  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    await this.ensureReady();
    const result = await this.call('tools/call', { name, arguments: args }, signal) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
    if (!result || !Array.isArray(result.content)) throw new Error('Mailbox tool returned an invalid response.');
    if (result.isError) throw new Error('Mailbox tool rejected the request. Check membership, approval and session expiry in the workbench.');
    return (result.content ?? []).filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n') || '(empty response)';
  }
  dispose(): void { this.disposed = true; this.fail(new Error('Mailbox connection is disposed.')); this.proc?.kill(); this.proc = null; }
}
