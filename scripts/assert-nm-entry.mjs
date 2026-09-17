#!/usr/bin/env node
// 装包形态门禁：`npm pack` 产物装进 `node_modules/` 后，vanilla Node 必须能 import 到插件导出面。
//
// 为什么单列一条：0.1.1 的 `main` 指 `src/plugin.ts` —— dsh loader 能直载 `.ts`，但 **Node 本体
// 拒绝从 node_modules 加载 `.ts`**（`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`）。同一包体解到
// 普通目录可加载、落进 `node_modules/` 即失败 ⇒ 只 import 本地路径的断言会漏，必须按装包形态跑。
//
// 两步，缺一不可：
//   正向：pack → 临时 fixture 装包 → `import('dsh-agent-mailbox')` 必须 LOAD_OK（导出 apply/name）
//   阴性对照：同 fixture 把 `main` 改回 `src/plugin.ts` 再跑 → 必须红（非零退出，且理由为 .ts 入口被拒）
//            —— 防「断言在但永不触发」。
//
// 顺带断言 pack 产物两件事（files 白名单漏项即红）：`main`/`types` 指 dist 入口；LICENSE 在位。
//
// 用法：node scripts/assert-nm-entry.mjs         （CI test job 每次 push 都跑）
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const PKG = 'dsh-agent-mailbox'
const WIN = process.platform === 'win32'
const NPM = WIN ? 'npm.cmd' : 'npm'

// 与验收标准原文同形：import 后校验导出面（apply/name 是插件契约）
const PROBE = `import(${JSON.stringify(PKG)})
  .then((m) => {
    if (!(m.apply && m.name)) { console.error('unexpected exports: ' + Object.keys(m).join(',')); process.exit(1) }
    console.log('LOAD_OK ' + m.name)
  })
  .catch((e) => { console.error('LOAD_FAIL ' + (e.code || e.name) + ' ' + e.message); process.exit(1) })`

const npm = (args, cwd) =>
  execFileSync(NPM, args, { cwd, encoding: 'utf8', shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] })

function probe(fixture) {
  try {
    const out = execFileSync(process.execPath, ['-e', PROBE], {
      cwd: fixture,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, out: out.trim() }
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}\n${e.stderr || ''}`.trim() }
  }
}

const work = mkdtempSync(join(tmpdir(), 'nm-entry-'))
const fail = (msg) => {
  console.error('NM_ENTRY_FAIL: ' + msg)
  process.exitCode = 1
}

try {
  // 1) pack 到临时目录（不脏工作区）
  npm(['pack', '--pack-destination', work, '--silent'], ROOT)
  const tgz = readdirSync(work).find((f) => f.endsWith('.tgz'))
  if (!tgz) throw new Error('npm pack 未产出 tarball')
  console.log(`pack: ${tgz}`)

  // 2) fixture 装包（--legacy-peer-deps：peer 由宿主提供，此处不拉 @deepseek-ai/cordis）
  const fixture = join(work, 'fixture')
  mkdirSync(fixture)
  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify({ name: 'nm-entry-fixture', version: '0.0.0', private: true }, null, 2) + '\n',
  )
  npm(['install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', '--legacy-peer-deps', join(work, tgz)], fixture)

  const installed = join(fixture, 'node_modules', PKG)
  const pkgPath = join(installed, 'package.json')
  const pj = JSON.parse(readFileSync(pkgPath, 'utf8'))
  console.log(`installed: main=${pj.main} types=${pj.types}`)
  if (pj.main !== 'dist/plugin.js') fail(`产物 package.json 的 main 应为 dist/plugin.js，实为 ${pj.main}`)
  if (pj.types !== 'dist/plugin.d.ts') fail(`产物 package.json 缺 types=dist/plugin.d.ts，实为 ${pj.types}`)

  // 3) LICENSE 在位（MIT 义务：版权行随副本分发）
  try {
    const lic = readFileSync(join(installed, 'LICENSE'), 'utf8')
    if (!lic.startsWith('MIT License') || !lic.includes('Copyright (c) 2026 NoFox Team'))
      fail('LICENSE 内容不符：应为 MIT 全文 + Copyright (c) 2026 NoFox Team')
    else console.log('LICENSE: MIT 全文 + 版权行在位')
  } catch {
    fail('pack 产物内无 LICENSE（files 白名单漏项）')
  }

  // 4) 正向：装包形态 import 必须 LOAD_OK
  const pos = probe(fixture)
  if (pos.ok) console.log(`正向（node_modules 形态 import）: ${pos.out}`)
  else fail(`正向必须 LOAD_OK，实际：\n${pos.out}`)

  // 5) 阴性对照：main 改回 src/plugin.ts，同一断言必须红
  pj.main = 'src/plugin.ts'
  writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + '\n')
  const neg = probe(fixture)
  if (neg.ok) fail('阴性对照未触发：main=src/plugin.ts 时 import 竟然成功 ⇒ 断言形同虚设')
  else if (!/ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING|ERR_UNKNOWN_FILE_EXTENSION|stripp/i.test(neg.out))
    fail(`阴性对照红了，但不是「node_modules 下 .ts 入口被 Node 拒绝」这一原因，对照无效：\n${neg.out}`)
  else console.log(`阴性对照（main=src/plugin.ts）: 如期红 — ${neg.out.split('\n')[0]}`)
} catch (e) {
  fail(e.message)
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (process.exitCode) console.error('NM_ENTRY: 未通过')
else console.log('NM_ENTRY_OK: node_modules 形态 import LOAD_OK · 阴性对照如期红 · LICENSE 在位')
