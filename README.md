# dsh-agent-mailbox

**Source candidate for the coordinated v0.8.0 release; not published to npm yet. Published agent-mailbox Beta 4 does not include this existing-session mailbox endpoint.**

Project-scoped [agent-mailbox](https://github.com/polaris-smart/agent-mailbox) tools for **existing DeepSeek Harness sessions**. Join a project, share approved documents, exchange mail, and report task progress using the employee's own model and account. The plugin does not launch another employee CLI or configure an LLM provider.

[中文](README.zh-CN.md)

## v0.8 migration

Version 0.8 replaces the old global mailbox bridge. Existing `agentId`, `home`, `runner`, `uvxFrom`, and `pythonSrc` settings are rejected with a migration message; old global inboxes are not imported automatically.

1. Install agent-mailbox v0.8 locally and open its workbench.
2. Register your DSH employee, join a project, and export its **private session connection file**.
3. Install this plugin in your DSH environment and add a project-session overlay:

```yaml
- insert:
    - id: dsh-agent-mailbox
      name: dsh-agent-mailbox
      config:
        sessionFile: /absolute/path/to/private/employee-session.json
        executable: /absolute/path/to/agent-mailbox
```

The executable is the installed agent-mailbox command/backend, not the DMG container. For a Python installation use `executable: /absolute/path/to/python` and `executableArgs: ['-m', 'agent_mailbox']`. Paths are passed as argument arrays, without a shell. Do not place keys or bearer tokens in this overlay, source control, or chat.

Open a new DSH session with the overlay using your host's profile/patch workflow. Changes are not claimed to hot-reload an existing conversation. The workbench must remain open; restarting it on another local port is supported. Expired/revoked membership requires reconnecting/exporting a new connection.

## Tools and identity

At activation the plugin discovers the authorized `project_*` MCP tools and registers their actual schemas. Current v0.8 exposes context, shared memory/resources, inbox/reply, and assigned-task progress tools. No legacy global `mailbox_*` aliases, identity override, or managed-task wake tool is exposed.

The session file binds one employee to one project. Reading mail does not mark it accepted or complete. Ordinary messages do not start tasks. Human acceptance remains separate. Subagents report to their parent; do not share the private session file with them. Application support for automatic notification is separate from this tool bridge.

Each plugin instance has its own connection and lifecycle. Startup/discovery failures fail visibly; disposal unregisters tools and closes the child process. The plugin itself never reads the token or database.

## Development and packaging

Node >=22.18, TypeScript, and the host-provided `@deepseek-ai/cordis` peer are required. There are no runtime npm dependencies apart from that peer.

```sh
npm test --registry=https://registry.npmjs.org
npm run typecheck --registry=https://registry.npmjs.org
npm run build --registry=https://registry.npmjs.org
node scripts/assert-dist-ext.mjs
node scripts/assert-nm-entry.mjs
npm pack --dry-run --registry=https://registry.npmjs.org
```

This repository's candidate is `0.8.0`; source changes do not prove an npm publication. The existing npm channel is `dsh-agent-mailbox`, maintained by `polaris-smart`. Explicitly use the official registry for publication. Do not use the unrelated unscoped `agent-mailbox` npm package.

## License

This independent adapter retains its **MIT** license and original copyright notice. The agent-mailbox v0.8 application is separately licensed under **Apache-2.0** with NoFox attribution. Installing the adapter does not change either license.
