# Agent Editing Boundaries

Date: 2026-03-27
Status: Active Baseline
Target Project: `claw-scope`
Scope: Profile editing, future Agent Settings editing, gateway save interfaces

## Goal

Freeze one clear rule for agent editing in `claw-scope`:

- document-backed fields save through document files
- non-document operational settings save through dedicated settings interfaces

This document exists to prevent the project from drifting back into mixed save paths such as:

- one part of the UI writing `IDENTITY.md`
- another part writing `agents.update`
- the list view and detail view reading from different sources

## Decision Summary

As of 2026-03-27, the editing boundary is:

- `Name`, `Avatar`, `Emoji`, `Theme`, `Creature`, `Vibe`, and other identity-facing fields are owned by `IDENTITY.md`
- `Soul` content is owned by `SOUL.md`
- long-term memory content is owned by `MEMORY.md`
- Profile-facing identity edits must not call a generic `agents.update`
- the current codebase no longer exposes a public `gateway_agent_update` bridge
- if `claw-scope` later adds an Agent Settings page, it must use a new restricted save path for non-document fields only
- if `claw-scope` later adds a Memory page, it must treat `MEMORY.md` as a file-backed document page, not as a `workspace/model` settings form
- if `claw-scope` later adds more advanced config editing, it must go through a separate structured config surface such as `config.patch` / `config.apply`

## Source Of Truth

### Identity fields

The source of truth for identity-facing data is `IDENTITY.md`.

That includes:

- `Name`
- `Avatar`
- `Emoji`
- `Theme`
- `Creature`
- `Vibe`
- other markdown-defined identity descriptors

Read path:

- `agents.files.get(IDENTITY.md)` is the authoritative source
- `agent.identity.get` may still be used for preview, parsing help, or derived display data

Write path:

- `agents.files.set(IDENTITY.md)` only

### Soul fields

The source of truth for soul content is `SOUL.md`.

Read path:

- `agents.files.get(SOUL.md)`

Write path:

- `agents.files.set(SOUL.md)` only

### Memory fields

The source of truth for long-term memory content is `MEMORY.md`.

Read path:

- `agents.files.get(MEMORY.md)`

Write path:

- `agents.files.set(MEMORY.md)` only

Notes:

- `MEMORY.md` editing belongs to a dedicated Memory surface, not to Profile
- future memory status, search, or retrieval helpers may use `doctor.memory.status` or tool-mediated calls
- those helper reads must not replace `MEMORY.md` as the editable long-term memory source

### Other workspace document fields

Other workspace-level document files should stay file-backed as well.

Examples:

- `TOOLS.md`
- `USER.md`
- `AGENTS.md`
- `HEARTBEAT.md`

Recommended read/write path:

- `agents.files.get(<NAME>)`
- `agents.files.set(<NAME>)`

### Non-document settings

The following fields are not identity documents and should not be edited from the Profile page:

- `workspace`
- `model`
- default agent selection
- `agentDir`
- structured memory settings
- bindings, sandbox, tools profile, and other advanced config trees
- deletion options

These belong to a future Agent Settings or Advanced Settings surface, not to Profile identity editing.

## Page Responsibilities

### Profile page

The Profile page is the document-centric editing surface.

It is responsible for:

- rendering the parsed result of `IDENTITY.md`
- rendering the parsed result of `SOUL.md`
- editing `Name` and `Avatar` by patching `IDENTITY.md`
- editing raw identity markdown
- editing raw soul markdown

It is not responsible for:

- changing `workspace`
- changing `model`
- editing `MEMORY.md`
- changing default-agent configuration
- acting as a mixed document plus settings form

### Future Agent Settings page

If a separate Agent Settings page is added later, it should own only non-document operational settings.

Examples:

- `workspace`
- `model`

It may also show read-only references to:

- default agent
- other config-level fields returned by `config.get`

It must not rewrite `Name` or `Avatar` behind the Profile page's back.

### Future Memory page

If a separate Memory page is added later, it should own memory documents and memory-specific status.

Examples:

- `MEMORY.md`
- memory readiness or health summary
- future memory search or retrieval entry points

Recommended internal split:

- **Document**: `MEMORY.md` editing
- **Timeline**: daily footprints, history, and event browsing
- **Map**: graph or relationship visualization

Rules:

- **Document** is the editable source-of-truth layer
- **Timeline** and **Map** are derived, read-focused layers
- `Timeline` and `Map` must not be implemented as alternate write paths for memory content

It must not become a generic workspace file browser or a duplicate Agent Settings form.

### Future Advanced Settings page

If the project later exposes config-heavy controls, they should live in a separate Advanced Settings surface.

Examples:

- default agent selection
- `agentDir`
- bindings
- sandbox
- tools profile
- structured memory config

This page should read from `config.get` and save through `config.patch` / `config.apply`.

It should not edit `IDENTITY.md`, `SOUL.md`, or `MEMORY.md`.

## Recommended Page Split

The recommended long-term split is:

- **Profile**: `IDENTITY.md` and `SOUL.md`
- **Agent Settings**: `workspace` and `model`
- **Memory**: `MEMORY.md` plus later `Document / Timeline / Map` memory-specific sub-surfaces
- **Advanced Settings**: structured config such as default agent, bindings, sandbox, and future memory config

This split keeps each page tied to one save model:

- document save through `agents.files.set`
- restricted operational save through a dedicated settings update bridge
- structured config save through `config.patch` / `config.apply`

Within **Memory** itself:

- **Document** stays file-backed
- **Timeline** stays derived and browse-oriented
- **Map** stays derived and visualization-oriented

## Field Mapping Baseline

| Field                                                         | Page                      | Read source                                               | Write source                    | Rule                                                                |
| ------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `Name`                                                        | Profile                   | `IDENTITY.md`, preview may reference `agent.identity.get` | `IDENTITY.md`                   | File-backed only                                                    |
| `Avatar`                                                      | Profile                   | `IDENTITY.md`, preview may reference `agent.identity.get` | `IDENTITY.md`                   | File-backed only                                                    |
| `Emoji`                                                       | Profile                   | `IDENTITY.md` or `agent.identity.get` preview             | `IDENTITY.md`                   | File-backed only                                                    |
| `Theme`                                                       | Profile                   | `IDENTITY.md`, optional derived preview                   | `IDENTITY.md`                   | File-backed only unless a future config sync is explicitly designed |
| `Soul`                                                        | Profile                   | `SOUL.md`                                                 | `SOUL.md`                       | File-backed only                                                    |
| `MEMORY.md`                                                   | Memory                    | `MEMORY.md`                                               | `MEMORY.md`                     | File-backed only; not editable from Profile or Agent Settings       |
| workspace files such as `TOOLS.md` / `USER.md`                | Memory or Workspace Files | `agents.files.get(<NAME>)`                                | `agents.files.set(<NAME>)`      | File-backed only; keep out of Agent Settings                        |
| `workspace`                                                   | Agent Settings            | `config.get` or upstream settings read RPC                | restricted settings save path   | Not editable from Profile                                           |
| `model`                                                       | Agent Settings            | `config.get` or upstream settings read RPC                | restricted settings save path   | Not editable from Profile                                           |
| default agent                                                 | Advanced Settings         | `config.get`                                              | `config.patch` or equivalent    | Not editable from Profile or Memory                                 |
| bindings / sandbox / tools profile / structured memory config | Advanced Settings         | `config.get`                                              | `config.patch` / `config.apply` | Keep out of Profile, Agent Settings, and file-backed Memory editing |

## Current Implementation Baseline

The current codebase reflects this boundary:

- [ProfileView.tsx](D:/Dev/claw-scope/src/app/components/views/ProfileView.tsx) saves basic identity fields by patching `IDENTITY.md`
- [profileIdentityDocument.ts](D:/Dev/claw-scope/src/app/components/views/profileIdentityDocument.ts) contains the markdown patch helper for `Name` and `Avatar`
- [OpenClawContext.tsx](D:/Dev/claw-scope/src/app/contexts/OpenClawContext.tsx) exposes document file getters and setters, not a public generic update call
- [commands.rs](D:/Dev/claw-scope/src-tauri/src/gateway/commands.rs), [connector.rs](D:/Dev/claw-scope/src-tauri/src/gateway/connector.rs), and [lib.rs](D:/Dev/claw-scope/src-tauri/src/lib.rs) no longer publish `gateway_agent_update`

This means the active project baseline is already aligned with the rule in this document.

## What Is Explicitly Not Allowed

The following patterns should be treated as regressions:

- writing `Name` to `IDENTITY.md` and also writing `name` through a generic `agents.update`
- writing `Avatar` through a lightweight update RPC while the Profile page still edits `IDENTITY.md`
- letting the left-side list read one source while the right-side detail panel reads another
- introducing a generic save form that mixes identity markdown fields and settings fields in one submit action

## Extension Rule For Future Work

If the project needs non-document agent editing later, do not restore the old generic bridge.

Instead:

1. define a dedicated Agent Settings page for `workspace` and `model`
2. define an allowlisted save contract for non-document fields only
3. define a dedicated Memory page for `MEMORY.md` and memory-specific UI
4. keep `Name`, `Avatar`, and other identity-facing fields out of the Agent Settings contract
5. keep Profile as the only UI that edits `IDENTITY.md` and `SOUL.md`
6. route structured config such as default-agent or bindings through `config.patch` / `config.apply`

Recommended direction:

- add a new restricted command such as `gateway_agent_settings_update`
- allow only fields like `workspace` and `model`
- reject identity-facing fields at the type level and the Rust command boundary
- add separate file-backed bridges such as `gateway_agent_memory_get` / `gateway_agent_memory_set`
- keep future advanced config writes on a distinct `config`-backed path instead of extending the document editors

## Verification Rule

Any future change that touches agent editing should be checked against this document.

Minimum questions:

- Is the field document-backed or settings-backed?
- Does the save path match that ownership?
- Can this change reintroduce dual-write drift?
- Will list view, detail view, and raw document stay consistent after save, reconnect, and restart?

If the answer is unclear, the change is not ready to merge.
