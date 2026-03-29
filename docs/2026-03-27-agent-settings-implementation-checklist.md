# Agent Settings Implementation Checklist

Date: 2026-03-27
Status: Wave 2 read path landed; write path still pending
Target Project: `claw-scope`
Scope: `Config` page, `OpenClawContext`, `src-tauri` gateway commands
Depends On:

- `docs/2026-03-27-agent-editing-boundaries.md`
- `docs/2026-03-27-memory-page-implementation-checklist.md`

## Goal

Add a minimal **Agent Settings** surface for non-document agent fields.

This page is the complement to **Profile**:

- **Profile** remains the only place that edits `IDENTITY.md` and `SOUL.md`
- **Agent Settings** only edits non-document operational settings such as `workspace` and `model`
- **Memory** will separately own `MEMORY.md`
- **Advanced Settings** will separately own config-heavy fields such as default agent, bindings, sandbox, and future memory config

The point of this implementation is to avoid slipping back into mixed responsibilities or dual-write drift.

## What this version includes

This implementation only needs:

- a new **Agent Settings** tab under **Config**
- agent selection
- read-only `agentId`
- read-only `workspace`
- read-only `model`
- explicit read / reload flow
- permission-aware editability

Wave 2 current state:

- `gateway_agent_settings_get` is wired
- `workspace` resolves from `agents.files.get(IDENTITY.md)`
- `model` resolves from `config.get`
- `Reload` is available
- `Save` remains intentionally disabled until the write path is implemented

## What this version does not include

Do not include these in the first pass:

- `Name`
- `Avatar`
- `Emoji`
- `Theme`
- `IDENTITY.md`
- `SOUL.md`
- `MEMORY.md`
- `TOOLS.md`
- `USER.md`
- default agent switching
- `agentDir`
- create / delete agent
- bindings, tools profile, sandbox, or advanced config trees
- memory search, memory health, or daily memory history

Those belong to other surfaces:

- `MEMORY.md` and memory-specific actions belong to **Memory**
- advanced config trees belong to **Advanced Settings**

## File-level task list

### 1. Add the `Agent Settings` tab entry

Update:

- `src/app/components/views/ConfigView.tsx`
- `src/app/contexts/I18nContext.tsx`

Done when:

- **Config** shows a third tab named **Agent Settings**
- the page description still keeps **General** and **Connection** separate from persona editing

### 2. Create the module skeleton

Add:

- `src/app/components/setup/AgentSettingsModule.tsx`

Done when:

- the module renders inside the new tab
- the layout clearly separates agent selection and settings form
- no identity or soul editor appears in this module

### 3. Add the read model in the frontend

Update:

- `src/app/contexts/OpenClawContext.tsx`

Add:

- `GatewayAgentSettingsResult`
- `gatewayAgentSettingsGet(agentId)`

Done when:

- the frontend can request `agentId`, `workspace`, and `model`
- the response shape is clearly separate from identity document reads

### 4. Add the write model in the frontend

Update:

- `src/app/contexts/OpenClawContext.tsx`

Add:

- `GatewayAgentSettingsUpdatePayload`
- `gatewayAgentSettingsUpdate(agentId, payload)`

Rules:

- payload only allows `workspace` and `model`
- payload must not accept `name`, `avatar`, `identity`, or `soul`

### 5. Build the form behavior

Update:

- `src/app/components/setup/AgentSettingsModule.tsx`

Done when:

- the selected agent loads its current settings
- the page supports `Reload`
- the page supports `Save`
- dirty state is tracked
- save success and failure show toast feedback
- read-only mode is shown when editing is not allowed

### 6. Add backend read command

Update:

- `src-tauri/src/gateway/commands.rs`
- `src-tauri/src/gateway/connector.rs`
- `src-tauri/src/lib.rs`

Add:

- `gateway_agent_settings_get`

Done when:

- Tauri exposes a read command for the frontend
- the backend returns only the allowlisted non-document fields

### 7. Add backend write command

Update:

- `src-tauri/src/gateway/commands.rs`
- `src-tauri/src/gateway/connector.rs`
- `src-tauri/src/lib.rs`

Add:

- `gateway_agent_settings_update`

Rules:

- only `workspace` and `model` are accepted
- `name`, `avatar`, `emoji`, `theme`, `identity`, and `soul` are rejected at the command boundary

### 8. Enforce the field whitelist in Rust

Update:

- `src-tauri/src/gateway/connector.rs`

Done when:

- upstream save logic maps only `workspace` and `model`
- unsupported fields return a clear error
- the code does not silently ignore forbidden identity-facing fields

### 9. Add permission-aware UI behavior

Update:

- `src/app/components/setup/AgentSettingsModule.tsx`

Rules:

- `operator.admin`: editable
- `operator.read`: visible but read-only

Done when:

- save is disabled without admin permission
- the module explains why editing is unavailable

### 10. Keep the boundary visible in the UI

Update:

- `src/app/components/setup/AgentSettingsModule.tsx`
- `src/app/contexts/I18nContext.tsx`

Done when:

- the page explicitly tells people that persona editing belongs in **Profile**
- the page does not imply that memory files belong here
- the page does not look like a second identity editor

## Suggested implementation order

Build in this order to keep risk low:

1. add the tab and i18n labels
2. scaffold `AgentSettingsModule`
3. add frontend read types and API
4. add backend read command
5. render read-only values
6. add frontend write types and API
7. add backend write command
8. add whitelist enforcement
9. add permission gating and save UX
10. run build and manual regression

## Acceptance criteria

This checklist is complete when all of the following are true:

- **Config** contains a distinct **Agent Settings** tab
- the page can select an agent and display `agentId`, `workspace`, and `model`
- `workspace` and `model` can be saved through a restricted save path
- `Profile` remains the only page that edits `IDENTITY.md` and `SOUL.md`
- the new save path does not accept `Name`, `Avatar`, or any other identity-facing field
- people without `operator.admin` can view but not edit

## Regression checklist

Before merging, verify:

- `npm run build`
- `cargo check`

Manual regression:

- **Profile** still edits `Name`, `Avatar`, `IDENTITY.md`, and `SOUL.md`
- **Config > General** still contains only app-level settings
- **Agent Settings** only contains `workspace` and `model`
- editing `workspace` or `model` does not change any Profile identity content
- the page still does not expose `MEMORY.md` or any other workspace file editor
