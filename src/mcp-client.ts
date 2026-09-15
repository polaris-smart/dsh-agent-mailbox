// agent-mailbox MCP stdio 客户端：spawn 一次、复用连接、JSON-RPC 2.0 调用。
// 零 npm 依赖（node:child_process）。MCP stdio 协议最小面：
// initialize → initialized 通知 → tools/call（逐请求排队）。
//
// 安全模型（对齐 dsh-devices ssh.ts 范式）：spawn 的命令字是字面量常量，
// 参数是数组，不经 shell——两条固定链在 spawnMcpProcess() 里各自内联，
// 没有变量命令字，没有字符串拼接。

import { spawn, type ChildProcess } from 'node:child_process';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export type Runner = 'uvx' | 'python3';

export class MailboxMcpClient {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private buffer = '';
  private ready: Promise<void> | null = null;
  private spawning = false;
  /** 防炸循环：连续启动失败计数。 */
  private failures = 0;

  private readonly runner: Runner;
  private readonly uvxFrom: string;
  private readonly homeArg: string;
  private readonly timeoutMs: number;

  constructor(
    /** 'uvx'（uvx --from <git> agent-mailbox）或 'python3'（-m agent_mailbox.server）。 */
    runner: Runner,
    /** uvx 链的 --from 来源（git URL 或 PyPI 包名，config 固定模板产出）。 */
    uvxFrom: string,
    /** --home=DIR 参数值（空串 = 不传，走默认 ~/.agent-mail）。 */
    homeArg: string,
    timeoutMs = 30_000,
  ) {
    this.runner = runner;
    this.uvxFrom = uvxFrom;
    this.homeArg = homeArg;
    this.timeoutMs = timeoutMs;
  }

  /** 确保 MCP 会话已建立（initialize + initialized）。 */
  async ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    if (this.spawning) {
      while (this.spawning) await sleep(50);
      if (this.ready) return this.ready;
    }
    this.spawning = true;
    this.ready = this.bootstrap().finally(() => {
      this.spawning = false;
    });
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    if (this.failures >= 3) {
      throw new Error('agent-mailbox spawn failed 3 times; check runner (uvx/python) and uv installation');
    }
    const proc = this.spawnMcpProcess();
    this.proc = proc;
    proc.on('error', (err: Error) => this.failAll(err));
    proc.stderr?.on('data', () => { /* MCP server 日志走 stderr，吞掉 */ });
    proc.stdout!.on('data', (chunk: Buffer) => this.onData(chunk));
    proc.on('exit', () => {
      this.proc = null;
      this.ready = null;
      this.failAll(new Error('agent-mailbox exited'));
    });

    // MCP initialize
    await this.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'dsh-agent-mailbox', version: '0.1.0' },
    });
    this.notify('notifications/initialized', {});
  }

  /**
   * 两条固定启动链，命令字均为内联字面量（静态可审计）：
   *   uvx    → uvx --from <uvxFrom> agent-mailbox [--home=DIR]
   *   python3 → python3 -m agent_mailbox.server [--home=DIR]
   */
  private spawnMcpProcess(): ChildProcess {
    if (this.runner === 'uvx') {
      const args = ['--from', this.uvxFrom, 'agent-mailbox'];
      if (this.homeArg) args.push(`--home=${this.homeArg}`);
      return spawn('uvx', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    }
    const args = ['-m', 'agent_mailbox.server'];
    if (this.homeArg) args.push(`--home=${this.homeArg}`);
    return spawn('python3', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    // MCP stdio = 换行分隔的 JSON-RPC
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message: string } };
        if (typeof msg.id === 'number') {
          const call = this.pending.get(msg.id);
          if (call) {
            this.pending.delete(msg.id);
            clearTimeout(call.timer);
            if (msg.error) call.reject(new Error(msg.error.message));
            else call.resolve(msg.result);
          }
        }
      } catch {
        // 非 JSON 行（横幅等）忽略
      }
    }
  }

  private failAll(err: Error): void {
    for (const [, call] of this.pending) {
      clearTimeout(call.timer);
      call.reject(err);
    }
    this.pending.clear();
  }

  private notify(method: string, params: Record<string, unknown>): void {
    const proc = this.proc;
    const stdin = proc?.stdin;
    if (!stdin?.writable) return;
    stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  call(method: string, params: Record<string, unknown>, timeoutMs = this.timeoutMs): Promise<unknown> {
    const stdin = this.proc?.stdin;
    if (!stdin) return Promise.reject(new Error('not spawned'));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`agent-mailbox ${method} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      stdin.write(payload);
    });
  }

  /** 调一个 MCP 工具，返回 text 内容拼接（agent 可读）。 */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ensureReady();
    const result = (await this.call('tools/call', { name, arguments: args }, 120_000)) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const texts = (result.content ?? [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!);
    const joined = texts.join('\n') || '(empty response)';
    if (result.isError) throw new Error(joined);
    return joined;
  }

  dispose(): void {
    this.proc?.kill();
    this.proc = null;
    this.ready = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
