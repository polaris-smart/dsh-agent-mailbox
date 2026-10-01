import type { Context } from '@deepseek-ai/cordis';
export interface MailboxToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  output: { schema: { type: string }; render: (args: Record<string, unknown>, value: string) => Array<{ type: 'text'; text: string }> };
  execute: (args: Record<string, unknown>, exec: { signal: AbortSignal }) => Promise<string>;
}
export interface MailboxContext extends Context {
  tools: { register(def: MailboxToolDef): () => void };
}
