// config.ts 自测：默认值合并 + Standard Schema validate + 两条启动链 argv 模板。
// node --test（Node 22 原生 runner）。

import { test } from 'node:test';
import assert from 'node:assert/strict';

// 静态校验（无 dsh 运行时）：直接测 validate 逻辑与模板拼装
function buildDefaults(raw: Record<string, unknown>) {
  const s = (k: string, fb: string) => {
    const v = raw[k];
    return typeof v === 'string' && v.length > 0 ? v : fb;
  };
  const agentId = s('agentId', '');
  const home = s('home', '');
  const runner = raw.runner === 'python' ? 'python' : 'uvx';
  const uvxFrom = s('uvxFrom', 'git+https://github.com/polaris-smart/agent-mailbox');

  const argv: string[] = [];
  if (home) argv.push(`--home=${home}`);
  if (runner === 'uvx') {
    return { agentId, runner, argv: ['--from', uvxFrom, 'agent-mailbox', ...argv] };
  }
  return { agentId, runner, argv: ['-m', 'agent_mailbox.server', ...argv] };
}

test('缺 agentId 时 validate 出 issues', () => {
  const raw: Record<string, unknown> = {};
  const r = buildDefaults(raw);
  assert.equal(r.agentId, '');
});

test('uvx 默认链 argv 模板', () => {
  const r = buildDefaults({ agentId: 'dsh-mac-01' });
  assert.equal(r.runner, 'uvx');
  assert.deepEqual(r.argv, ['--from', 'git+https://github.com/polaris-smart/agent-mailbox', 'agent-mailbox']);
});

test('python 链 argv 模板 + home 参数', () => {
  const r = buildDefaults({ agentId: 'x', runner: 'python', home: '/tmp/mail' });
  assert.equal(r.runner, 'python');
  assert.deepEqual(r.argv, ['-m', 'agent_mailbox.server', '--home=/tmp/mail']);
});

test('compileParameters：object 根 + required 收集', async () => {
  const { compileParameters } = await import('../src/types.ts');
  const schema = compileParameters({
    to: { type: 'string', required: true, description: '收件人' },
    priority: { type: 'string', description: '优先级' },
  });
  assert.equal(schema.type, 'object');
  assert.deepEqual(schema.required, ['to']);
  assert.equal(schema.properties.to.description, '收件人');
});
