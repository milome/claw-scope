---
project_name: 'ClawForge / ClawScope (claw-scope)'
user_name: '{user-name}'
date: '2026-03-24'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
  - usage_guidelines
status: complete
optimized_for_llm: true
source_workflow: bmad-bmm-generate-project-context
---

# Project Context for AI Agents

_本文件供实现 ClawScope（`claw-scope/`）时代码代理遵循：优先写「易踩坑、与 PRD/UX 不一致会返工」的约束。_

**规划产物（勿与实现混淆）：** `_bmad-output/planning-artifacts/main/prd.md`、`ux-design-specification.md`；产品叙事名 ClawForge，**仓库与包名** `claw-scope`。

---

## Technology Stack & Versions

| 层级 | 版本 / 说明 |
|------|-------------|
| **Tauri** | 2.x（`Cargo.toml`：`tauri = "2"`，`tauri-build = "2"`，`tauri-plugin-shell = "2"`） |
| **Rust** | Edition **2021** |
| **前端** | **React 18** + **TypeScript ~5.2** + **Vite 5**；`@tauri-apps/api` ^2.10；`@tauri-apps/cli` ^2 |
| **构建** | `npm run build` → `tsc && vite build`；dev 端口 **1420**（`vite.config.ts` `strictPort: true`） |
| **窗口** | `tauri.conf.json`：`decorations: false`（自定义标题栏），默认 **1024×768**，`withGlobalTauri: true` |

---

## Critical Implementation Rules

### Language-Specific Rules（TypeScript）

- **`tsconfig.json` 开启 `strict: true`**，且 `noUnusedLocals` / `noUnusedParameters` 为 **true**：禁止留下未使用变量占位。
- **模块**：`"type": "module"`，`moduleResolution: "bundler"`；前端仅 **`src/`** 纳入 TS（`include: ["src"]`）。
- **环境变量前缀**：仅 **`VITE_`** 与 **`TAURI_`** 会暴露给前端（见 `vite.config.ts` `envPrefix`）。

### Framework-Specific Rules（React + Tauri）

- **自定义标题栏**：高度 **40px** 与 PRD/UX 一致；拖拽区需 **`data-tauri-drag-region`**（及现有 `startDragging` 逻辑）；窗口控制需 **`@tauri-apps/api/window`** `getCurrentWindow()`，且 `capabilities` 中已声明 `minimize` / `close` / `toggle-maximize` / `start-dragging`。
- **新增能力**：任何 **FS、shell、dialog** 等必须在 `src-tauri/capabilities/*.json` 显式授权；**禁止**在未扩展 capability 时假设可读写 `~/.openclaw/`（PRD：路径 scope 显式声明）。
- **UI 结构**：后续主界面应为 **侧栏（记忆/配置/进化）+ 主内容区**；记忆区 **表格｜每日足迹｜思维导图** 为 **同级分段 Tab**（见 UX 第 8.3 节），勿把导图做成每日足迹子视图。

### Testing Rules

- **当前 `package.json` 未配置 Jest/Vitest/Playwright**；`npm run lint` = `tsc --noEmit`。
- **新增测试时**：优先与 **Vite + React** 兼容；E2E 若引入 Playwright，需考虑 **Tauri 桌面** 与 webdriver 边界，单独约定。

### Code Quality & Style Rules

- **无 ESLint/Prettier 配置入仓**：风格以 **现有 `App.tsx` 内联 style + 严格 TS** 为准；新增文件避免引入另一套 CSS 体系除非 Story 要求。
- **命名**：包名 **`claw-scope`**；Rust crate/lib 名 **`claw_scope`**（`Cargo.toml`）。

### Development Workflow Rules

- **开发**：`npm run dev`（Vite 1420）+ 另开 Tauri 或 `npm run tauri dev`（以团队约定为准）。
- **规划/文档**：BMAD 产出在 **`_bmad-output/`**；勿把仅规划用的假设写进 `claw-scope` 源码当已实现。

### Critical Don't-Miss Rules

- **本地优先 / 隐私**：PRD NFR12–NFR13 — 不在此应用内持久化用户 API Key；记忆与配置读写限于用户 **OpenClaw 工作区**。
- **进化 MVP**：**不要**在 MVP 内实现「应用内 LLM SDK 自动生成并落盘进化」；进化路径为 **模板 + diff + 可选 doctor**（见 PRD「进化路径 — MVP 产品决策」）。
- **OpenClaw 路径**：默认 **`~/.openclaw/`**；实现适配层时应对 **CLI 不可用** 降级（PRD Assumptions）。
- **性能**：记忆列表、思维导图节点多时遵循 PRD **NFR1**（分页/懒加载/虚拟化）。

---

## Usage Guidelines

**对 AI 代理：**

- 实现新功能前阅读本文件与 **`prd.md` 相关 FR**。
- 不确定权限边界时：**先查 `capabilities`**，再改 Rust 侧，最后才在前端调用。
- 更偏「产品句」与验收时以 **`ux-design-specification.md`** 为准。

**对人：**

- 升级 **Tauri / React / Rust edition** 后同步更新本节表格。
- 引入 ESLint/测试框架后补充「Testing / Quality」条目。
- 季度检视：删除已变常识的条目，保持精简。

**Last Updated:** 2026-03-24
