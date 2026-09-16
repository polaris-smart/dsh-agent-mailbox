# dsh-agent-mailbox 冒烟：类型检查 + 单测 + 真实 spawn 链路（uvx 冷启动 → initialize → whoami）。
# 判据：三项全过 exit 0。
set -e
cd "$(dirname "$0")"

echo "== 1/3 typecheck =="
npx -y -p typescript@5.9.3 tsc --noEmit

echo "== 2/3 unit tests =="
node --test --experimental-strip-types test/*.test.ts

echo "== 3/3 real MCP spawn (uvx cold start) =="
node --experimental-strip-types -e "
import('./src/mcp-client.ts').then(async ({ MailboxMcpClient }) => {
  const c = new MailboxMcpClient('uvx', 'git+https://github.com/polaris-smart/agent-mailbox', '', 60000);
  try {
    const out = await c.callTool('mailbox_whoami', {});
    console.log('SMOKE_OK', out.slice(0, 200));
  } finally {
    c.dispose();
  }
}).catch((e) => { console.error('SMOKE_FAIL', e.message); process.exit(1); });
"

echo "SMOKE ALL GREEN"
