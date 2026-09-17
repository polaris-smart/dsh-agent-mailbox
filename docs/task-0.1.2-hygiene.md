# v0.1.2 卫生卡 任务书（已批 · 执行中）

> 状态：**已批准开工**——HS 2026-09-17 信 `20260917135443-bd7bdb9b-zc` 拍板「v0.1.2 卫生批准加一项」，
> 本线可直接动工；**仍不发版、不 publish、不动 tag**（版本位 bump 与发版令另定，见「边界」）。
> 提出：ZC · 2026-09-16 · 依据 0.1.1 复核实测（HS 批注：三连实测 a/b/c 即为本卡验收标准原文）。
> 批准同日按 HS 第 ④ 项**新增第 4 条**（LICENSE 文件）；原三条不变。

## 背景（实测锚，非推测）

0.1.1 起 `main` 指 `src/plugin.ts`，为 dsh loader strip-types 直载所必需；但 **vanilla Node 从 `node_modules` 加载 `.ts` 会被 Node 本体拒绝**。三连实测（对象＝registry 0.1.1 包体；Node v25.8.2 与 v22.22.2 双版本结论一致）：

- **(a)** 包体解到普通目录：`import('./src/plugin.ts')` → **LOAD_OK**（导出 `apply/inject/name`…）
- **(b)** npm 装包形态（包放 `node_modules/`）：`import('dsh-agent-mailbox')` → **FAIL `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`**
- **(c)** 同一包体仅把 `main` 改回 `dist/plugin.js`（+`types`）→ node_modules 形态 **LOAD_OK**

附带事实：`dist/plugin.js` 的 `.ts` 后缀引用已在 `830d4bd`＋`1c1d557` 修好（现 `import './mcp-client.js'`）；`types` 字段在两个已发布 tarball 内均不存在（0.1.0 packument 上有 npm 推断出的值，0.1.1 因 `main` 指 src 连该推断也丢失）。

## 目标（四项，按序）

1. **入口收口**：`package.json` → `"main": "dist/plugin.js"`；新增 `"types": "dist/plugin.d.ts"`；`files` 五项不变（`dist/`、`src/`、`cordis.patch.yml`、两个 README）。`src/` 保留不删（dsh 直载能力不回归）；README 补一句前提说明：*dsh loader 可直载 `.ts` 源码；其他 Node 消费方请走 `dist/` 入口*。
2. **CI 断言（新增，接 test job＝每次 push 都跑）**：node_modules 形态 import 冒烟——fixture 临时目录内布置 `node_modules/dsh-agent-mailbox`（由 `npm pack` 产物解包），执行 `node -e "import('dsh-agent-mailbox').then(m=>{if(!(m.apply&&m.name))process.exit(1)})"`。
   **验收标准原文（直接引用 (c)）**：*node_modules 形态 vanilla Node import 必须 LOAD_OK*。
3. **阴性对照（门禁有效性，防「断言在但永不触发」）**：把 `main` 临时改回 `src/plugin.ts` 跑同一断言，**必须红**（非零退出）。publish job 既有的 dist 入口断言保持不变。
4. **LICENSE 补齐（HS 2026-09-17 批新增）**：仓内补 `LICENSE`（MIT 全文 + `Copyright (c) 2026 NoFox Team`），`package.json` 的 `files` 加 `"LICENSE"`。理由：已上架形态（`license: MIT`）不带版权行副本 = 不满足自家声明的 MIT 条款；预算一行文件。**随本卡其余项一起发。**

## 验收清单

- [x] **pack 清单对锚**（ZC 本地 2026-09-17 实测）：17 项 = 0.1.1 已上架 16 项 **+ `LICENSE`**；`diff -r` 逐文件比对——仅 `README.md`/`README.zh-CN.md`/`package.json` 三处 expected diff，`dist/`（8）+ `src/`（4）**逐字节同源**，零改名零丢失。
- [x] **装包形态门禁自查**（本地）：正向 `LOAD_OK dsh-agent-mailbox`；阴性对照如期红 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`；LICENSE 在位（`node scripts/assert-nm-entry.mjs` exit 0）。
- [ ] CI 三平台（ubuntu/macos/windows）test job 绿，且含新断言与阴性对照步（待 push 后据 run 结论回填）。
- [ ] 真机：dsh profile 从 registry 装 0.1.2 后 `mailbox_check` 通（沿用 0.1.1 的 E2E 姿势：session 落盘 `tool/call` → `tool/result`）——发版后执行。

## 边界（红线）

- 本卡只做卫生收口＋门禁；**不发版、不派工、不动 tag、不 publish**。
- 版本位 bump 到 0.1.2 的时机由发版令另定。
- workflow 改动限于 test job 加一步（第 2 条要求「接 test job＝每次 push 都跑」）；**publish job 一字不动**。

## 证据锚（供复算）

- registry 0.1.1 tarball sha1 `95734bdb4a1ad89b22346e4093b02d8c156130ba`；sha512 hex `3a6995920b…`（= integrity base64 `OmmVkgti…`）
- 本机 npm cache 中 10:04:16 CST 的 pack 产物（15819 B）与该 tarball `cmp` 逐字节全等
- dsh profile 安装件与 tarball 的 `src/`、`dist/` 逐字节同源；`package.json` md5 `a170d74e898cbde76e42d32b945dce12`
- 实测命令即上文 (a)(b)(c) 三条

## 执行记录（2026-09-17）

- 提交：`9836329`（①+④ package.json 入口收口 · LICENSE + files）／`632ebfd`（②+③ 门禁脚本 + ci.yml test job 接线）
- 本地门禁链：`tsc --noEmit` 0 错 · 单测 4/4 · `npm run build` exit 0（改写 2 处）· `assert-dist-ext` EXT_OK（8 产物 0 命中）· `assert-nm-entry` NM_ENTRY_OK
- 新包体（本地 pack，含未 bump 的 0.1.1 版本位）：16496 B / 17 文件，sha1 `10371add7124fafb0805611c26694ab6edcc2385`，sha512 `a9ca312f4f42…`（bump 后哈希会变，此处仅作本次对锚）
- 环境：本机 Node v25.8.2 / npm 11.11.1；CI 侧 Node 22（门禁内不传 `--experimental-strip-types`，跑的就是 vanilla Node）
