/** Project mailbox credentials stay in a private manifest, never in plugin config. */
export interface Config {
  sessionFile: string;
  executable: string;
  executableArgs: string[];
}
export type ResolvedConfig = Config;
export interface StandardSchemaV1<T> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => { value: T } | { issues: Array<{ message: string }> };
  };
}
export const Config: Config & StandardSchemaV1<ResolvedConfig> = {
  sessionFile: '', executable: 'agent-mailbox', executableArgs: [],
  '~standard': {
    version: 1, vendor: 'dsh-agent-mailbox',
    validate(value: unknown) {
      const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      if (['agentId', 'home', 'runner', 'uvxFrom', 'pythonSrc'].some(key => key in raw)) {
        return { issues: [{ message: 'v0.7 global mailbox config is unsupported. Export a project mailbox connection and set sessionFile.' }] };
      }
      if (typeof raw.sessionFile !== 'string' || !raw.sessionFile.trim()) {
        return { issues: [{ message: 'sessionFile is required: export a private employee project connection from agent-mailbox.' }] };
      }
      if (raw.executable !== undefined && (typeof raw.executable !== 'string' || !raw.executable.trim())) {
        return { issues: [{ message: 'executable must be a nonempty executable path or command.' }] };
      }
      if (raw.executableArgs !== undefined && (!Array.isArray(raw.executableArgs) || raw.executableArgs.some(arg => typeof arg !== 'string'))) {
        return { issues: [{ message: 'executableArgs must be a string array.' }] };
      }
      return { value: {
        sessionFile: raw.sessionFile,
        executable: typeof raw.executable === 'string' ? raw.executable : 'agent-mailbox',
        executableArgs: Array.isArray(raw.executableArgs) ? [...raw.executableArgs] as string[] : [],
      } };
    },
  },
};
