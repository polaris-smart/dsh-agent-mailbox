#!/usr/bin/env node
// 构建后处理：把 dist/**/*.d.ts 里残留的 `.ts` 相对引入改写成 `.js`。
//
// 为什么需要：TS 5.9 的 `rewriteRelativeImportExtensions` 只改写 JS emit，
// 声明文件里的 import specifier 原样保留（dist/plugin.d.ts 仍写 `'./config.ts'`）。
// 未开 `skipLibCheck` 的消费者解析该包时会撞 TS5097。
// 为什么不用源码侧规避：src 用 `.ts` 后缀是刻意的——`node --experimental-strip-types`
// 直接跑 src（smoke.sh / 单测）要靠它解析到真实文件。故改在构建产物侧收口。
//
// 用法：node scripts/fix-dts-ext.mjs   （已挂进 npm run build）
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const EXT_MAP = { '.ts': '.js', '.tsx': '.js', '.mts': '.mjs', '.cts': '.cjs' }

// 相对 module specifier：'./x.ts' / "../y.tsx" / './z.mts'
const SPEC_RE = /(['"])(\.{1,2}\/[^'"]+?)(\.[cm]?tsx?)\1/g
// 只处理 import/export 语句行，避免误伤普通字符串字面量
const STMT_RE = /^\s*(?:import|export)\b|(?:^|[^\w$.])import\s*\(/
const SPEC_TEST_RE = new RegExp(SPEC_RE.source) // 无 /g：test() 不带 lastIndex 状态

async function* walkDts(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walkDts(p)
    else if (e.name.endsWith('.d.ts')) yield p
  }
}

let rewritten = 0
const files = []

for await (const file of walkDts(DIST)) {
  const src = await readFile(file, 'utf8')
  const out = src
    .split('\n')
    .map((line) => {
      if (!STMT_RE.test(line)) return line
      return line.replace(SPEC_RE, (m, q, base, ext) => {
        if (base.endsWith('.d')) return m // 别把 './x.d.ts' 弄成 './x.d.js'
        const next = EXT_MAP[ext]
        if (!next) return m
        rewritten++
        return `${q}${base}${next}${q}`
      })
    })
    .join('\n')
  if (out !== src) {
    await writeFile(file, out, 'utf8')
    files.push(file.slice(DIST.length))
  }
}

// fail-loud：改完还有残留就报错，防止半途而废的产物被发出去
const leftovers = []
for await (const file of walkDts(DIST)) {
  const txt = await readFile(file, 'utf8')
  txt.split('\n').forEach((line, i) => {
    if (STMT_RE.test(line) && SPEC_TEST_RE.test(line)) {
      leftovers.push(`${file.slice(DIST.length)}:${i + 1}: ${line.trim()}`)
    }
  })
}
if (leftovers.length) {
  console.error('声明文件仍有 .ts 后缀引入：')
  for (const l of leftovers) console.error('  ' + l)
  process.exit(1)
}

console.log(
  files.length
    ? `fix-dts-ext: 改写 ${rewritten} 处 specifier（${files.join(', ')}）`
    : `fix-dts-ext: 无需改写（已全为 .js）`,
)
