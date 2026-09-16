#!/usr/bin/env node
// 产物门禁：dist 内**任何**相对 module specifier 都不得带 .ts/.tsx/.mts/.cts 后缀。
//
// 覆盖两类产物：
//   - dist/**/*.js    —— 0.1.0 坏包就是这里带 .ts（消费者 ERR_MODULE_NOT_FOUND）
//   - dist/**/*.d.ts  —— TS 只改写 JS 不改写声明，需构建后处理收口（.ts 后缀不断裂消费端，属卫生项）
// 任一类残留即 exit 1，用于「杜绝复发」（CI test job 每次 push 都跑 / publish job 发布前再跑一遍）。
//
// 用法：node scripts/assert-dist-ext.mjs
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const SPEC_RE = /(['"])(\.{1,2}\/[^'"]+?)(\.[cm]?tsx?)\1/
const STMT_RE = /^\s*(?:import|export)\b|(?:^|[^\w$.])import\s*\(/

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.js$/.test(e.name) || e.name.endsWith('.d.ts')) yield p
  }
}

const bad = []
let scanned = 0
for await (const file of walk(DIST)) {
  scanned++
  const txt = await readFile(file, 'utf8')
  txt.split('\n').forEach((line, i) => {
    if (STMT_RE.test(line) && SPEC_RE.test(line)) {
      bad.push(`${relative(DIST, file)}:${i + 1}: ${line.trim()}`)
    }
  })
}

console.log(`assert-dist-ext: 扫描 ${scanned} 个产物文件`)
if (bad.length) {
  console.error('发现 .ts 后缀引入（消费者会挂）：')
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}
console.log('EXT_OK: dist 内 .ts 后缀引入 = 0（.js 与 .d.ts 均通过）')
