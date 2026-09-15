// dsh-agent-mailbox 配置：stdio 直连 MCP（默认，agent-mailbox 装好即可用）。
//
// 桥接形态：dsh 插件是 TS/cordis 进程内工具，agent-mailbox 是 Python MCP server。
// 零依赖桥法 = 把 agent-mailbox 当 MCP stdio 子进程（uvx 冷启动），
// 每次工具调用走 JSON-RPC over stdio（MCP 2.1 只依赖标准库+httpx，冷启动 <1s）。
//
// 零依赖约定：不依赖 @deepseek-ai/schemastery——Config 必须带
// ['~standard'].validate（cordis 4.x resolveConfig 硬契约，纯默认值对象会炸：
// dph-fleet v0.2.10 Windows 实锤）。

/** 插件 Config（cordis.yml / cordis.patch.yml config 字段）。 */
export interface Config {
  /** 本 agent 在信箱里的身份 id（必填，如 dsh-mac-01）。 */
  agentId: string;
  /** mail root（空 = ~/.agent-mail，与 MCP 生态共享同一信箱）。 */
  home: string;
  /** agent-mailbox 的启动方式：uvx（默认，需装 uv）或 python -m。 */
  runner: 'uvx' | 'python';
  /** runner=uvx 时的来源（默认 GitHub 直装；发包 PyPI 后可换包名）。 */
  uvxFrom: string;
  /** runner=python 时的工作目录（含 agent_mailbox 包）。 */
  pythonSrc: string;
}

export type ResolvedConfig = Config & {
  argv: string[];
};

/** Standard Schema v1 最小契约（cordis 4.x resolveConfig 消费的全部）。 */
export interface StandardSchemaV1<T> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) =>
      | { readonly value: T; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<string | number | symbol> }> };
  };
}

function str(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = raw[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function buildDefaults(raw: Record<string, unknown>): ResolvedConfig {
  const agentId = str(raw, 'agentId', '');
  const home = str(raw, 'home', '');
  const runner = raw.runner === 'python' ? 'python' : 'uvx';
  const uvxFrom = str(raw, 'uvxFrom', 'git+https://github.com/polaris-smart/agent-mailbox');
  const pythonSrc = str(raw, 'pythonSrc', '');

  const argv: string[] = [];
  if (home) argv.push('--home', home);
  if (runner === 'uvx') {
    return { agentId, home, runner, uvxFrom, pythonSrc, argv: ['uvx', '--from', uvxFrom, 'agent-mailbox', ...argv] };
  }
  return { agentId, home, runner, uvxFrom, pythonSrc, argv: ['python3', '-m', 'agent_mailbox.server', ...argv] };
}

/** mini Standard Schema：validate 合并默认值 + 轻校验（agentId 必填）。 */
export const Config: Config & StandardSchemaV1<ResolvedConfig> = {
  agentId: '',
  home: '',
  runner: 'uvx',
  uvxFrom: 'git+https://github.com/polaris-smart/agent-mailbox',
  pythonSrc: '',

  '~standard': {
    version: 1,
    vendor: 'dsh-agent-mailbox',
    validate(value: unknown) {
      const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
      const resolved = buildDefaults(raw);
      if (!resolved.agentId) {
        return { issues: [{ message: 'config.agentId is required (本 agent 的信箱身份 id)' }] };
      }
      return { value: resolved };
    },
  },
} as unknown as Config & StandardSchemaV1<ResolvedConfig>;
