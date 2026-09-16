# dsh-agent-mailbox 0.1.1 发版 checklist

> 背景：**0.1.0 是坏包** —— dist/plugin.js 的 import 仍带 `.ts` 后缀，而 dist 下只有 `.js`，
> 消费者 `import 'dsh-agent-mailbox'` 必 `ERR_MODULE_NOT_FOUND`（详见 worklog 2026-09-16）。
> 根因与修复：`830d4bd`（tsconfig.build.json + `rewriteRelativeImportExtensions`；CI TS→5.9.3；publish job 加 dist 入口断言）。
> 状态：**等老板 go**；本文件不构成发版动作。

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
- [ ] `package.json` version 0.1.0 → 0.1.1，commit `chore(release): 0.1.1`
- [ ] 本地四连（全过才准发）：
  1. `npx -y -p typescript@5.9.3 tsc --noEmit` → 0 错
  2. `npx tsc -p tsconfig.build.json` → exit 0；`grep -n 'from "\./' dist/plugin.js` 必须**全是 `.js`**
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

## 附：dist/\*.d.ts 内 `.ts` 后缀小账 —— 实测非缺陷，0.1.1 不改

- TS 5.9.3 实测：`rewriteRelativeImportExtensions` **只改写 JS**，不改写声明文件
  （dist/plugin.d.ts 仍写 `from './config.ts'`）
- 但消费者侧解析无碍：TS 会把 `./x.ts` 映射到同名 `x.d.ts`。strict + 无 skipLibCheck 的消费实测中，
  唯一报错是 `@deepseek-ai/cordis` 未安装（peer dep，dsh 宿主装齐即消），与 `.ts` 后缀无关
- 结论：**不改**。若日后要洁癖，可加一步 postbuild 把 dist/\*.d.ts 的 `.ts` 改 `.js` —— 不值得为它引入构建步骤
