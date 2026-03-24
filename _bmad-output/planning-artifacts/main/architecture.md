---
stepsCompleted:
  - step-01-init
  - step-02-context
  - consolidated-solutioning
inputDocuments:
  - _bmad-output/planning-artifacts/main/prd.md
  - _bmad-output/planning-artifacts/main/ux-design-specification.md
  - _bmad-output/project-context.md
workflowType: architecture
project_name: ClawForge / ClawScope
user_name: '{user-name}'
date: '2026-03-24'
branchFolder: main
note: 'Planning folder uses main because workspace has no git repository.'
---

# Architecture Decision Document — ClawForge（代号 ClawScope）

**仓库与包名：** `claw-scope`（Rust crate `claw_scope`）。  
**关联：** PRD、UX 规格、以及下文「实现约束」中的 **Project Context**。

---

## 实现约束（对实现代理为强制性）

**所有实现工作（代码、配置变更、Tauri capabilities、依赖升级）必须同时满足：**

1. **`_bmad-output/project-context.md`** — 技术栈版本、TypeScript 严格模式、Tauri capabilities 与路径、自定义标题栏约定、**禁止**在未扩展 capability 时假设可读写 `~/.openclaw/`、记忆 Tab 结构（表格｜每日足迹｜思维导图**同级**）、进化 MVP 边界（无应用内 LLM SDK 自动落盘）、CLI 降级策略等。**若本架构文档与 Project Context 冲突，以 Project Context 为准并更新本文件。**
2. **`_bmad-output/planning-artifacts/main/prd.md`** — 功能范围、FR、NFR、阶段 P1–P5。
3. **`_bmad-output/planning-artifacts/main/ux-design-specification.md`** — 交互与验收层面的「产品句」；尤其是记忆主区 Tab（UX 第 8.3 节）与 PRD FR7a 一致。

**生成/维护：** Project Context 由 `bmad-bmm-generate-project-context`（或等价流程）产出；栈变更后**必须**同步更新 `project-context.md`，再反映到实现。

---

## 1. 系统上下文与目标

| 角色 | 说明 |
|------|------|
| **用户** | 在本地桌面使用 ClawScope，管理 OpenClaw 工作区（默认 `~/.openclaw/`）。 |
| **ClawScope** | Tauri 2 壳 + React 18 前端；Rust 侧负责受控 FS、CLI 调用、路径解析。 |
| **OpenClaw** | 上游：配置文件（如 `openclaw.json`）、记忆文件、`agents/`、可选 CLI（`doctor`、`memory index` 等）。 |

**架构目标：** 本地优先（NFR12–13）、适配层与上游格式解耦（NFR10）、沙箱下可读写工作区（NFR9）、性能满足 NFR1/NFR3（列表/导图/搜索）。

---

## 2. 逻辑分层（C4 容器级）

```
┌─────────────────────────────────────────────────────────────┐
│  React UI (Vite, src/)                                       │
│  主导航：记忆 / 配置 / 进化；记忆区 Tab：表格｜每日足迹｜思维导图   │
└──────────────────────────┬──────────────────────────────────┘
                           │ invoke / events
┌──────────────────────────▼──────────────────────────────────┐
│  Tauri 命令层 (Rust, src-tauri/)                              │
│  工作区发现、读写字节、CLI 编排、适配层调用                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  OpenClaw 适配层 (Rust 模块，建议独立 crate 或 mod 边界)       │
│  配置解析、记忆解析、版本探测、记忆树聚合（供导图）、CLI 可用性检测  │
└──────────────────────────┬──────────────────────────────────┘
                           │ 读/写
┌──────────────────────────▼──────────────────────────────────┐
│  用户工作区（~/.openclaw/ 或用户配置路径）                       │
└─────────────────────────────────────────────────────────────┘
```

**前端职责：** 展示、表单、diff 预览、加载状态、空状态与引导（FR16–18a）；不直接假设 FS 权限——通过 **已声明的** Tauri API 与命令访问。

**Rust 职责：** 所有对工作区路径的访问经 **capabilities 中显式 path scope**；shell/CLI 仅经已授权插件与参数白名单（若使用 `tauri-plugin-shell`）。

---

## 3. 主要架构决策（摘要）

| 决策 | 选择 | 理由 |
|------|------|------|
| 壳与 UI | Tauri 2 + React 18 + Vite 5 | 与 Project Context、PRD 一致；桌面单包。 |
| 跨边界通信 | Tauri command + 少量 event | 类型安全、易审计；避免任意 Node 侧直接 FS。 |
| 数据所有权 | 用户工作区 on-disk；应用不建独立云端 DB | NFR12、Domain 本地优先。 |
| 配置与记忆解析 | Rust 适配层 + 可版本化解析器 | NFR10、FR21；上游变更时替换/扩展解析器。 |
| 进化 MVP | 模板 + 内存/临时 diff + 写回文件；可选 `doctor` | PRD 与 Project Context 明确禁止应用内 LLM 自动落盘。 |
| 思维导图数据 | 与表格/足迹共用同一「内存模型」；导图由聚合层输出树 | FR7a、NFR1；避免三套数据源。 |
| CLI 不可用 | 检测后降级：doctor 提示跳过；memory index 降级为仅本地解析 | PRD Assumptions。 |

---

## 4. 与工作区及 capabilities 策略

- **默认路径：** `~/.openclaw/`（或环境变量/向导配置，见 PRD Domain）。
- **Tauri：** 任何 `readFile`/`writeFile`/`scope` 扩展必须在 `src-tauri/capabilities/*.json` 中声明；**禁止**在未加 scope 的前端假设可访问。
- **演示模式：** 只读或独立临时目录；不与真实工作区混用（PRD Domain）。
- **备份：** `backups/` 在工作区内；若冲突则 `backups_manager/`（PRD）。

---

## 5. 按 PRD 阶段的实现映射

| 阶段 | 架构要点 |
|------|----------------|
| **P1 适配层** | 工作区发现 API；CLI 探测；`openclaw.json` / 记忆文件解析入口；错误模型（路径不存在 / 空 / 沙箱）。 |
| **P2 记忆** | 统一「记忆条目」模型；表格/每日足迹/导图三种视图读同一 store；搜索/筛选管道；导图 = 聚合树 + 懒加载/虚拟化挂钩。 |
| **P3 配置** | 表单 ↔ JSON AST；保存前校验（FR10a）；可选 doctor 调用与结果回传 UI。 |
| **P4 进化** | 保守模板契约；应用前 diff；原子写或失败不覆盖（FR14）；与 FR15 对比 UI。 |
| **P5 导航** | 侧栏 + 主内容；WorkspaceBanner；空状态与 FR18a。 |

---

## 6. 非功能需求（架构挂钩）

| NFR | 架构响应 |
|-----|-----------|
| NFR1 | 列表分页/虚拟化；导图折叠、懒展开、避免主线程大块同步解析。 |
| NFR3 | 搜索：优先本地索引；无 CLI 时降级路径与超时（见 PRD）。 |
| NFR6a | Rust 层区分 EPERM/EACCES 等，前端展示平台化指引文案。 |
| NFR11 | 适配层、配置解析、记忆解析、模板应用为测试优先模块（目标覆盖率见 PRD 附录 B）。 |

---

## 7. 需求可追溯性（简表）

| FR 组 | 主要架构承载 |
|-------|----------------|
| FR1–7、FR7a | 适配层 + 前端三 Tab 视图 + 共享状态 |
| FR8–12 | 配置模块 + Rust 持久化 + 可选 CLI |
| FR13–15 | 进化模块 + diff + 模板引擎（无 LLM 落盘） |
| FR16–18a | 壳层路由 + 引导与空状态 |
| FR19–21 | 适配层版本策略 + 文件契约文档 |

---

## 8. PRD 附录 D 待架构/设计阶段明确的项

以下项在实现前应在设计或后续 ADR 中收敛：**索引策略**（FR6/NFR3）、撤销/重做范围、FR15 可观测效果呈现、首屏条数、OpenClaw 最低版本、单实例并发假设、离线边界。

---

## 9. 修订历史

| 日期 | 说明 |
|------|------|
| 2026-03-24 | 初稿：`bmad-bmm-create-architecture` 合并步骤；无 git 时规划目录使用 `main`；强制引用 `project-context.md` |

---

_下文为模板保留区：若后续按 step-by-step 工作坊追加 ADR 条目，可在此节之后继续追加。_
