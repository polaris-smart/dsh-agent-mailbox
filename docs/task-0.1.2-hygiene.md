# v0.1.2 卫生卡 任务书（起草稿 · 待批）

> 状态：**起草稿**——未派工、未发版、未动 tag/workflow。批后方可开工。
> 提出：ZC · 2026-09-16 · 依据 0.1.1 复核实测（HS 批注：三连实测 a/b/c 即为本卡验收标准原文）。

## 背景（实测锚，非推测）

0.1.1 起 `main` 指 `src/plugin.ts`，为 dsh loader strip-types 直载所必需；但 **vanilla Node 从 `node_modules` 加载 `.ts` 会被 Node 本体拒绝**。三连实测（对象＝registry 0.1.1 包体；Node v25.8.2 与 v22.22.2 双版本结论一致）：

- **(a)** 包体解到普通目录：`import('./src/plugin.ts')` → **LOAD_OK**（导出 `apply/inject/name`…）
- **(b)** npm 装包形态（包放 `node_modules/`）：`import('dsh-agent-mailbox')` → **FAIL `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`**
- **(c)** 同一包体仅把 `main` 改回 `dist/plugin.js`（+`types`）→ node_modules 形态 **LOAD_OK**

附带事实：`dist/plugin.js` 的 `.ts` 后缀引用已在 `830d4bd`＋`1c1d557` 修好（现 `import './mcp-client.js'`）；`types` 字段在两个已发布 tarball 内均不存在（0.1.0 packument 上有 npm 推断出的值，0.1.1 因 `main` 指 src 连该推断也丢失）。

## 目标（三项，按序）

1. **入口收口**：`package.json` → `"main": "dist/plugin.js"`；新增 `"types": "dist/plugin.d.ts"`；`files` 五项不变（`dist/`、`src/`、`cordis.patch.yml`、两个 README）。`src/` 保留不删（dsh 直载能力不回归）；README 补一句前提说明：*dsh loader 可直载 `.ts` 源码；其他 Node 消费方请走 `dist/` 入口*。
2. **CI 断言（新增，接 test job＝每次 push 都跑）**：node_modules 形态 import 冒烟——fixture 临时目录内布置 `node_modules/dsh-agent-mailbox`（由 `npm pack` 产物解包），执行 `node -e "import('dsh-agent-mailbox').then(m=>{if(!(m.apply&&m.name))process.exit(1)})"`。
   **验收标准原文（直接引用 (c)）**：*node_modules 形态 vanilla Node import 必须 LOAD_OK*。
3. **阴性对照（门禁有效性，防「断言在但永不触发」）**：把 `main` 临时改回 `src/plugin.ts` 跑同一断言，**必须红**（非零退出）。publish job 既有的 dist 入口断言保持不变。

## 验收清单

- [ ] CI 三平台（ubuntu/macos/windows）test job 绿，且含新断言与阴性对照步；
- [ ] `npm pack --dry-run` 清单与 0.1.1 对齐（16 文件；除 `package.json` 自身外零变化）；
- [ ] 真机：dsh profile 从 registry 装 0.1.2 后 `mailbox_check` 通（沿用 0.1.1 的 E2E 姿势：session 落盘 `tool/call` → `tool/result`）。

## 边界（红线）

- 本卡只做卫生收口＋门禁；**不发版、不派工、不动 tag、不动 workflow、不 publish**。
- 版本位 bump 到 0.1.2 的时机由发版令另定。

## 证据锚（供复算）

- registry 0.1.1 tarball sha1 `95734bdb4a1ad89b22346e4093b02d8c156130ba`；sha512 hex `3a6995920b…`（= integrity base64 `OmmVkgti…`）
- 本机 npm cache 中 10:04:16 CST 的 pack 产物（15819 B）与该 tarball `cmp` 逐字节全等
- dsh profile 安装件与 tarball 的 `src/`、`dist/` 逐字节同源；`package.json` md5 `a170d74e898cbde76e42d32b945dce12`
- 实测命令即上文 (a)(b)(c) 三条
