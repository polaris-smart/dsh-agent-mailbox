# dsh-agent-mailbox 0.1.1 发版 checklist

> 背景：**0.1.0 是坏包** —— dist/plugin.js 的 import 仍带 `.ts` 后缀，而 dist 下只有 `.js`，
> 消费者 `import 'dsh-agent-mailbox'` 必 `ERR_MODULE_NOT_FOUND`（详见 worklog 2026-09-16）。
> 根因与修复：`830d4bd`（tsconfig.build.json + `rewriteRelativeImportExtensions`；CI TS→5.9.3；publish job 加 dist 入口断言）。
> 追加（老板令「一步到位」）：`.d.ts` 的 `.ts` 后缀已在 0.1.1 内收口 + 加扩展门禁（见文末附）；version 已 bump 0.1.1。
> 状态：**等老板 go**；本文件不构成发版动作。**禁 tag / 禁 dispatch / 禁 npm publish 三条红线维持**。

## 0. 前置（已完成）

- [x] 根因修复已推 main，CI run `35043905651` 三平台绿（publish job 非 tag dispatch 故 skip）
- [x] 坏包在架确认：`npm view dsh-agent-mailbox version` = 0.1.0；unpkg 侧 dist/plugin.js:4 仍是 `from './mcp-client.ts'`

## 1. 凭据闸（**当前唯一阻塞项，需老板侧动作**）

实测现状：

- 仓库 secrets 为空（`gh secret list --repo polaris-smart/dsh-agent-mailbox` 返回 0 条）
  ⇒ CI publish job 里的 `secrets.NPM_TOKEN` 未配置，`npm publish` 必 ENEEDAUTH
- 本机也未登录（`npm whoami` = ENEEDAUTH）⇒ 本地发同样缺凭据

三选一（任选其一即可解锁）：

- a. 老板在仓库加 secret `NPM_TOKEN`（npm Automation token，账号 polaris-smart）→ 走 CI dispatch
- b. npm 侧配 Trusted Publisher（GitHub Actions · `polaris-smart/dsh-agent-mailbox` · workflow `CI`）
  → 无需 secret，publish job 已声明 `permissions: id-token: write`
- c. 老板给一次性 token → 本机 `npm login` 或 `NPM_TOKEN=... npm publish`（注意勿把 token 写进仓库）

## 2. 版本与产物（go 之后第一步）

- [ ] `git fetch && git status`：工作树干净、HEAD == origin/main（确认无并发写者）
- [x] `package.json` version 0.1.0 → 0.1.1（本批已改；发版令仍等老板 go）
- [ ] 本地四连（全过才准发）：
  1. `npx -y -p typescript@5.9.3 tsc --noEmit` → 0 错
  2. `npm run build` → exit 0；`node scripts/assert-dist-ext.mjs` → `EXT_OK`（**.js 与 .d.ts 双口径**，`.ts` 后缀必须为 0）
  3. `node -e "import('./dist/plugin.js').then((m)=>{if(m.name!=='dsh-agent-mailbox')throw new Error('bad');console.log('DIST_OK')})"` → `DIST_OK`
     ← **0.1.0 坏包的拦截线**，CI publish job 已内置同款步骤
  4. `bash smoke.sh` → `SMOKE ALL GREEN`
- [ ] `npm pack --dry-run` 核对清单（应含 dist/\*.js + \*.d.ts、src/\*.ts、README×2、cordis.patch.yml、package.json）

## 3. 发布

- [ ] tag：`git tag v0.1.1 && git push origin main --tags`
- [ ] dispatch：`gh workflow run CI --ref v0.1.1`
      （publish job 的 if = `workflow_dispatch` + `refs/tags/v*`；需先过三平台 test matrix）
- [ ] 等 publish job 绿（含 dist 入口断言步）

## 4. 发布后复核（三条缺一不可）

- [ ] 拉回产物再验一次：`npm pack dsh-agent-mailbox@0.1.1` → 解包断言 dist/plugin.js 的 import 是 `.js`；
      装进临时目录 `import('dsh-agent-mailbox')` = OK
- [ ] `npm view dsh-agent-mailbox version` = 0.1.1（latest 已切）
- [ ] 建议同时 **deprecate 坏版本**：
      `npm deprecate dsh-agent-mailbox@0.1.0 "dist 入口坏包（TS5096 修复前发布），请用 >=0.1.1"`
      （防 dshmarket 等采集方继续取坏包；发布超 48h 后不可 unpublish，只能 deprecate）
- [ ] GitHub Release v0.1.1 + worklog 追加一条 + 告 HS 复核

## 5. 风险与回滚

- npm 已发布版本超过 48 小时只能 deprecate、不能 unpublish ⇒ **发前必须跑完第 2 节四连**
- 若 0.1.1 仍坏：直接发 0.1.2，不要在坏版本上打补丁

## 附：dist/\*.d.ts 内 `.ts` 后缀 —— **0.1.1 已修**（老板拍板「一步到位」）

**修法**（`scripts/fix-dts-ext.mjs`，挂在 `npm run build` 尾部）：

- TS 只改写 JS emit 的事实不变（`rewriteRelativeImportExtensions` 不碰声明文件），故在**产物侧收口**：
  构建后改写 `dist/**/*.d.ts` 里 import/export 语句的相对 specifier `.ts|.tsx|.mts|.cts` → `.js|.js|.mjs|.cjs`，
  改完自检残留，有残留即 exit 1（fail-loud，防半成品产物出门）
- **门禁**：`scripts/assert-dist-ext.mjs` 扫描 `dist/**/*.{js,d.ts}`，相对 specifier 带 `.ts` 后缀即红。
  接了两处——test job（每次 push 都跑，**杜绝复发**的主力）＋ publish job 的 dist 入口校验步（发布前再拦一次）
- 源码侧不动：src 用 `.ts` 后缀是刻意的（`node --experimental-strip-types` 直接跑 src 要靠它）

**性质更正（实测，2026-09-16）**：本账此前记「等日后洁癖再修」，且老板侧对其影响面的描述为「消费者不开
skipLibCheck 会报 TS5097」——**该失败模式实测不成立**：

| 探针（TS 5.9.3） | .d.ts 写 `.ts` | .d.ts 写 `.js` |
|---|---|---|
| 消费端 import（moduleResolution=NodeNext, skipLibCheck=false） | exit 0 | exit 0 |
| 消费端 import（moduleResolution=Node16, skipLibCheck=false） | exit 0 | exit 0 |
| 阳性对照：`.ts` **源文件**引一个真实存在的 `.ts` 路径 | **TS5097** | — |

⇒ TS 会在声明文件里把 `./x.ts` 映射到同名 `x.d.ts`，故 TS5097 的触发条件是「**源文件**引 `.ts`」，
不是「包的 .d.ts 里带 `.ts`」。0.1.0 真正的对外断裂是 **JS emit**（`ERR_MODULE_NOT_FOUND`，`830d4bd` 已修），
`.d.ts` 后缀属**卫生问题**而非功能缺陷。本次按老板令修掉并把门禁加上，属「一步到位」的洁癖收口，不是修 bug。
