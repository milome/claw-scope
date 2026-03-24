---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - _bmad-output/planning/PRODUCT_BRIEF_OpenClaw-Manager.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-24.md
workflowType: 'prd'
briefCount: 1
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
classification:
  projectType: desktop_app
  domain: developer_tool
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - ClawForge

**Slogan:** 记忆可见，进化可期

**代号 ClawScope：** 规划与对外叙述中的产品名为 **ClawForge**；当前实现、仓库目录与安装包展示名使用代号 **ClawScope**（见 `claw-scope/`、`PROJECT_SETUP.md`）。

**Author:** 项目维护者（定稿时可改为实名）
**Date:** 2026-03-24

---

## Executive Summary

ClawForge 面向 OpenClaw 用户，提供**记忆可见**、**配置可编辑**、**进化可实验**的本地管理能力。现有生态在安装、使用、监控上已有覆盖，本产品填补**记忆策略、索引管理、检索可视化、Agent 自主进化**的空白。用户可看到 claw 的每日活动、记忆增长、技能进步，并在 Agent 人格（identity/soul）基础上做强化与进化实验。目标：核心入口在 5 分钟内可被理解（可验证：新用户完成首次浏览/编辑任务计时）。

---

## Project Classification

- **Project Type:** Desktop Application
- **产品名:** ClawForge
- **代号:** ClawScope（实现与仓库；详见上文「代号 ClawScope」说明）
- **仓库名建议:** `openclaw-forge`（规划）；当前代码仓为 `claw-scope/`（详见 `PROJECT_SETUP.md`）
- **Domain:** Developer Tools / AI Agent Management
- **Complexity:** Medium
- **Project Context:** Greenfield（MVP 为全新项目；若后续集成至 OpenClaw 官方则可能演进为 brownfield）

---

## Product Vision

2–3 年内，ClawForge 可演进为 OpenClaw 生态中的记忆与进化标准工具，成为深度用户首选管理界面。与 ClawX（使用）、ClawManager（运维）形成互补，本产品聚焦记忆与进化。可扩展为插件化进化策略、可配置视图、与 OpenClaw 生态深度集成的平台。

---

## Success Criteria

### User Success

- 用户能在 5 分钟内找到记忆浏览、配置编辑、进化实验的入口（验证见 NFR4）
- 用户能清晰看到 claw 的每日活动、记忆增长、技能进步
- 用户能基于 identity/soul 完成至少一次进化实验（预设模板或半自动反馈）
- 用户不再需要手改 JSON 即可完成常见配置调整

### Business Success

- **采用指标**：在发布后 6 个月内，在 OpenClaw 深度用户群体中达到可量化的采用（如：GitHub star ≥X、Discord/社区提及 ≥Y 次、或 NPS 调查 ≥Z 分）。X/Y/Z 须在首个 Release 前设定并公布。
- **差异化维持**：与 ClawX、ClawManager 形成清晰定位（记忆 + 进化），不被同质化淹没；若竞品跟进，本产品在进化实验与可视化体验上保持领先。
- **可扩展基础**：MVP 架构支持后续插件化进化策略、可配置视图，为社区生态留出扩展空间。

### Technical Success

- 与 OpenClaw 主流版本兼容；适配层可应对配置/记忆结构变更
- 不被主流桌面沙箱阻断对 `~/.openclaw/` 的读写（Tauri capabilities 配置得当）
- 跨平台：Windows、macOS、Linux 单可执行文件或安装包交付（无额外运行时依赖）

---

## Product Scope

### MVP - Minimum Viable Product

- **记忆管理**：浏览、搜索、筛选；表格视图 + 每日足迹视图 + **思维导图视图**（与每日足迹并列 Tab，分类汇总 Agent 记忆树成果）
- **Agent 配置**：可视化编辑 openclaw.json、per-agent 覆盖
- **进化策略**：预设模板（激进/保守/技能优先）一键应用
- **目标用户**：技术小白；5 分钟上手
- **集成方式**：本地文件读写 + CLI 调用（openclaw doctor、memory index 等）

### Growth Features (Post-MVP)

- 仪表盘/概览
- 关系图谱（记忆/技能/Agent 关联）
- 半自动反馈（用户标记有用/无用，系统据此调整；基于 MVP 保守模板参数，用户反馈驱动微调）
- 激进、技能优先进化模板
- （待定）可选：第三方模型仅作进化「建议」、不自动落盘；或复用 OpenClaw 侧能力（见「进化路径 — MVP 产品决策」）

### 明确不做（MVP）

- 记忆/配置导出（CSV、JSON 等）；多工作区；多实例并发编辑同一工作区

### Vision (Future)

- 进化机制深化
- 日志与资源监控（Token 用量、API 调用）
- 插件化进化策略、可配置视图

### MVP 实施阶段

| 阶段 | 交付物 | 依赖 |
|------|--------|------|
| P1 适配层 | 工作区发现、openclaw.json/记忆解析、CLI 可用性检测 | — |
| P2 记忆 | 浏览、表格/每日足迹/**思维导图**、筛选、搜索、详情（FR1–7、FR7a） | P1 |
| P3 配置 | 可视化编辑、per-agent、保存校验、doctor 调用（可选）（FR8–12） | P1 |
| _说明_ | P2 与 P3 可并行开发 | — |
| P4 进化 | 保守模板完整链路、前后对比（FR13–15） | P2, P3 |
| P5 导航与引导 | 主界面、空状态指引、沙箱提示（FR16–18a） | P1 |

---

## User Journeys

### Journey 1：首次使用，5 分钟上手

1. 用户安装 ClawForge 并启动
2. 应用自动检测已配置的 OpenClaw 工作区，若存在则加载，若不存在则提示
3. 主界面展示入口：记忆、配置、进化
4. 用户点击「记忆」→ 通过记忆主区 **同级** 分段 Tab 切换 **表格 / 每日足迹 / 思维导图**（三者平齐；「每日足迹」与「思维导图」为并列相邻 Tab）
5. 用户能在 5 分钟内理解三个核心入口的用途

### Journey 2：浏览与筛选记忆

1. 用户进入记忆视图
2. 可切换 **表格 / 每日足迹 / 思维导图** 视图：三者 **同级**（同一分段控件）；「每日足迹」与「思维导图」为并列相邻 Tab（与 UX 规格记忆主区 Tab 一致）
3. 可按时间、类型、Agent 筛选、排序
4. 可搜索记忆内容
5. 点击单条记忆（或思维导图节点）查看详情（内容、来源；修改历史若由 OpenClaw 存储则展示）

### Journey 3：编辑 Agent 配置

1. 用户进入配置视图
2. 看到 openclaw.json 的可视化编辑表单
3. 可切换不同 Agent 的 per-agent 覆盖
4. 修改后保存，可选调用 openclaw doctor 验证
5. 支持撤销/重做或配置历史（若实现）

### Journey 4：进化实验

1. 用户进入进化视图
2. 选择预设进化模板（MVP 提供保守模板；激进、技能优先在 V1）
3. 在 identity/soul 基础上应用模板
4. 预览变更及进化前后对比（配置 diff、可观测效果），确认后保存
5. （保存后）可查看进化前后对比摘要

---

## Domain Requirements

- **术语**：identity/soul 指 OpenClaw Agent 的人格与能力定义（配置文件或工作区中的 Agent 元数据）。
- **工作区路径**：默认 `~/.openclaw/`；可通过环境变量或首次启动向导配置；应用能自动发现工作区位置。
- **演示模式**：当工作区为空时，用户可选进入演示模式。演示数据来自内置示例工作区（随应用打包）或预设 mock 数据，结构与真实工作区一致；示例规模至少包含 20 条记忆、2 个 Agent；演示模式只读或使用独立临时目录，不与用户真实工作区混用。
- **OpenClaw 兼容性**：支持主流 OpenClaw 版本；适配层应对 openclaw.json、记忆结构、CLI 输出格式的变更。
- **本地优先**：所有数据读写在用户 OpenClaw 工作区；MVP 不依赖远程服务（Gateway 为 OpenClaw 自有能力，本应用不直接依赖）。
- **权限与沙箱**：Tauri capabilities 显式声明 path scope；避免被系统沙箱阻断对工作区的读写。多平台 Tauri 验证计划：Win/Mac/Linux 各做安装与读写验证。
- **空状态检测优先级**：路径不存在→FR18 通用提示；路径存在但空→FR18a 引导；沙箱阻断→NFR6a 平台指引。
- **配置校验**：保存时由 FR10a 校验；实时编辑时 FR12 可选展示 diff，具体实时/保存时校验边界见设计文档。
- **备份路径**：`backups/` 位于工作区内，与 OpenClaw 既有目录无冲突；若存在同名目录则使用 `backups_manager/` 等替代。
- **进化模板契约**：预设模板（激进/保守/技能优先）在 PRD 附录或单独设计文档中定义；每模板需明确：输入（identity/soul 字段子集）、输出（变更的配置项）、可观测效果（如「激进」= 更频繁记忆写入、更高索引刷新率）。MVP 至少实现一种模板的完整链路。
- **MVP 模板范围**：MVP 仅实现「保守」模板的完整链路；激进、技能优先模板在 V1（Growth）实现。
- **保守模板可观测效果**：保守 = 较低记忆写入频率、较慢索引刷新率；与激进形成对比，便于用户理解差异。

---

## Assumptions & Risks

- **假设**：OpenClaw 生态持续活跃，配置与记忆结构在未来 12 个月内保持可适配（小版本变更可被适配层吸收）。适配层设计需支持在 2–4 周内完成格式变更的适配。
- **风险**：若 OpenClaw 项目重大转向或式微，本产品可退化为「通用 OpenClaw 工作区查看器」或迁移至兼容生态。
- **缓解**：适配层与格式解耦（NFR10）；文档化工作区结构与 CLI 契约（Markdown 或 ADR），便于迁移。
- **CLI 依赖**：FR11、FR20 依赖 openclaw CLI 的 doctor、memory index 等命令。若 CLI 不存在或接口变更，应用降级为：doctor→跳过验证并提示；memory index→仅基于本地文件解析，无增量索引。适配层需检测 CLI 可用性并选择模式。doctor 不可用时，入口可点击，点击后提示「CLI 不可用，请检查 OpenClaw 安装」。
- **发布与获客**：采用指标依赖发布渠道（如 GitHub Release、OpenClaw 生态公告、社区传播）。PRD 不规定具体渠道，但 MVP 需包含首次启动引导与空状态指引，确保新用户能完成首次有效操作。
- **单工作区**：MVP 仅支持单工作区；多工作区切换为 V1 规划。
- **单实例**：MVP 假定用户单实例使用；多实例并发编辑同一工作区可能导致冲突，建议在 OpenClaw 未活跃时编辑配置。

---

## Innovation Patterns

- **差异化定位**：记忆深度管理 + 进化实验，填补 ClawX/ClawManager 空白
- **技术小白友好**：5 分钟上手、可视化优先、向导式操作
- **跨界借鉴**：Obsidian 关系图谱/每日足迹、Docker Desktop 列表/检查/日志、Notion 多视图、1Password 保险库

---

## Functional Requirements

### 记忆管理

- FR1: 用户能浏览 OpenClaw 工作区内的记忆文件（MVP 支持：MEMORY.md、日记及适配层可解析的同类格式；其他格式可扩展）
- FR1a: 记忆「类型」来源于 OpenClaw 工作区元数据（若有）或本应用根据文件路径/命名推断的分类；若无可靠来源，类型筛选降级为「按来源/路径筛选」，且类型筛选入口可隐藏或弱化。
- FR2: 用户能按表格视图查看记忆列表，支持多列（时间、类型、来源、关联 Agent）
- FR3: 用户能按每日足迹视图查看当日活动（做了什么、记了什么；「学了什么」若 OpenClaw 产出则展示，否则降级为「记了什么」）。「当日」以用户本地时区为准。
- FR4: 用户能按时间、类型（或来源/路径，见 FR1a）、Agent 筛选记忆
- FR5: 用户能对记忆列表排序（按时间、来源、类型；若有搜索结果则支持按相关性排序）
- FR6: 用户能全文搜索记忆内容
- FR7: 用户能点击单条记忆查看详情（内容、元数据）。修改历史若由 OpenClaw 存储则直接展示；否则本应用不承诺提供，或仅在配置编辑场景提供本应用自身的变更历史（若实现）。
- FR7a: 用户能在记忆主视图中通过 **Tab** 在 **表格**、**每日足迹**、**思维导图** 三种视图间切换；三者 **同级**（同一分段控件），「**每日足迹**」与「**思维导图**」为其中 **并列相邻** 的两项，「**表格**」与二者亦为同级。在「思维导图」视图中，按**分类**汇总各 Agent 的**记忆树**成果（层级/节点语义：优先使用 OpenClaw 工作区内可解析的结构化记忆树或元数据；若无则本应用基于路径、类型、标签等**推断**生成可折叠树，并在 UI 中标注「推断」或降级为简单聚合）。三种视图共用**同一数据集**，筛选/搜索条件在合理范围内联动（具体联动规则见 UX 规格及设计文档）。

### Agent 配置

- FR8: 用户能可视化编辑 openclaw.json 的主要配置项（MVP 范围见附录 A）
- FR9: 用户能切换并编辑 per-agent 覆盖（工作区内 `agents/`）
- FR10: 用户能保存配置变更并写入文件
- FR10a: 配置保存前校验 JSON 格式正确性；若校验失败则阻止保存并提示具体错误位置。可选：保存前自动备份当前配置至工作区内 `backups/`（或用户可配置路径）；备份保留最近 10 份，超过则自动清理最旧者（或由用户配置保留数量）。
- FR11: 用户能调用 openclaw doctor 验证配置（可选）
- FR12: 用户能在修改前预览变更差异（可选）

### 进化实验

- FR13: 用户能选择预设进化模板（如激进/保守/技能优先）
- FR14: 用户能在 identity/soul 基础上应用模板并保存。若保存失败，不覆盖原配置；若有备份可提供恢复入口。
- FR15: 用户能预览进化策略变更并在确认前查看进化前后对比（变更的配置项 diff、可观测效果说明）。进化前后对比为 MVP 必选能力。

**进化路径 — MVP 产品决策（范围边界）**

- **MVP 内含**：规则化预设模板（先实现「保守」完整链路，见 Domain）+ **保存前 diff 预览**（FR15）+ **可选** `openclaw doctor`（FR11、FR20）验证配置契约；进化价值定位为 **可解释、可对比、可回退** 的配置演进。
- **MVP 明确不做**：本应用内集成**通用 LLM / 用户自定义 API 端点 SDK**，由模型**自动生成并直接落盘**进化方案；避免与「本地优先、可验收」叙事冲突，并控制密钥、出网与失败面。
- **后续（Growth，须单独评审并修订 PRD）**：可评估**可选**能力，例如仅生成「建议 / 草案」且**不自动应用**、**复用 OpenClaw 上游已有能力**、或本地推理；须补充隐私说明、降级策略与验收标准。

### 概览与导航

- FR16: 用户能在 5 分钟内从主界面找到记忆、配置、进化三个入口
- FR17: 应用能自动检测并加载已配置的 OpenClaw 工作区
- FR18: 应用在无法访问工作区时给出明确提示
- FR18a: 当工作区为空或无可识别记忆时，应用展示明确引导（如：安装 OpenClaw、创建首个 Agent、或进入演示模式浏览示例数据）。不展示空白页且无指引。

### 集成与兼容

- FR19: 应用能读写已配置工作区下的配置文件与记忆文件
- FR20: 应用能调用 openclaw CLI（MVP 使用：doctor、memory index；其他命令可扩展）执行操作
- FR21: 应用通过适配层解析 openclaw.json 与记忆结构，应对版本差异。支持 OpenClaw 当前主流版本（具体最低版本见设计文档）；大版本不兼容时提示升级或降级

---

## Non-Functional Requirements

### 性能

- NFR1: 记忆列表加载（≤1000 条）在 3 秒内完成；超过 1000 条时采用分页或懒加载，首屏（如 100 条）加载在 3 秒内，余下按需加载。**思维导图**视图在节点规模较大时采用折叠、懒展开或虚拟化，避免主线程长时间阻塞（目标：常见工作区下首次可交互 ≤3 秒，与列表视图同量级体验）。
- NFR2: 配置保存与文件写入在 1 秒内完成（假定本地 SSD、配置文件 ≤1MB）
- NFR3: 搜索响应在 2 秒内返回结果（本地索引场景）。若 CLI 不可用、降级为仅本地文件解析时，搜索响应放宽至 5 秒内。

### 可用性

- NFR4: 新用户在无文档条件下 5 分钟内理解核心入口。验证：至少 5 名无 ClawForge 经验的用户执行「从主界面找到记忆、配置、进化三入口→完成记忆筛选→查看详情」任务，80% 以上在 5 分钟内完成（或采用标准 SUS/UMUX 分数阈值）。
- NFR5: 关键操作有明确反馈（成功/失败/进行中）。关键操作：保存配置、应用进化模板、切换工作区、加载记忆列表
- NFR6: 错误提示清晰，可指引用户排查（如权限、路径、OpenClaw 未安装）
- NFR6a: 若因系统沙箱无法访问工作区，应用检测并给出明确提示（含平台特定的解除/调整指引，如 macOS 隐私设置、Linux 权限），而非泛化错误信息。

### 兼容性

- NFR7: 支持 Windows 10+、macOS 12+、主流 Linux 发行版（如 Ubuntu 22.04+、Fedora 38+、Arch；完整测试列表见附录 C）
- NFR8: 与 OpenClaw 当前主流版本兼容；适配层支持配置/记忆结构小版本变更
- NFR9: Tauri capabilities 正确配置，避免被常见桌面沙箱阻断

### 可维护性

- NFR10: 配置与记忆解析逻辑通过适配层与 OpenClaw 格式解耦，便于应对上游变更
- NFR11: 关键逻辑有单元测试覆盖（目标 ≥70%）。关键逻辑指：适配层、配置解析、记忆解析、进化模板应用（见附录 B）

### 安全与隐私

- NFR12: 不在本地以外传输用户配置或记忆；不依赖远程管理服务
- NFR13: API Key 等敏感信息仅存在于用户本地 OpenClaw 配置中，本应用不额外存储、不持久化；读取配置做可视化时仅在内存中处理，不落盘

---

## Requirements Traceability

| FR 组 | 主要对应 Journey |
|-------|------------------|
| 记忆管理 (FR1–7、FR7a) | Journey 1, 2 |
| Agent 配置 (FR8–12) | Journey 3 |
| 进化实验 (FR13–15) | Journey 4 |
| 概览与导航 (FR16–18a) | Journey 1 |
| 集成与兼容 (FR19–21) | 贯穿 |

---

## 附录 A：MVP 主要配置项（FR8）

MVP 支持可视化编辑的 openclaw.json 配置项（具体以 OpenClaw 当前 schema 为准，设计阶段定稿）：

- 全局：模型、温度、API 端点等基础参数
- Agent 相关：默认 Agent、per-agent 覆盖开关
- 记忆相关：记忆存储路径、索引刷新策略

完整字段列表见设计文档。

---

## 附录 B：NFR11 关键逻辑模块

- 适配层（工作区发现、配置解析、记忆解析、**记忆树聚合供思维导图视图**）
- 配置编辑与保存
- 进化模板应用
- CLI 可用性检测与降级

---

## 附录 C：Linux 测试发行版

- Ubuntu 22.04 LTS、24.04 LTS
- Fedora 38+
- Arch Linux（当前稳定版）
- 其他发行版以实际测试为准

---

## 附录 D：设计/架构阶段待办

以下 gaps 需在架构或设计阶段明确（详见 PRD_VALIDATION_REPORT.md）；**项目名称、开源结构、CI/CD 与跨平台安装包** 见 `PROJECT_SETUP.md`：

- 索引策略（FR6/NFR3）
- 撤销/重做与配置历史范围
- FR15 可观测效果呈现形式
- 首屏条数可配置性
- OpenClaw 最低支持版本
- 并发单实例假设验证
- 离线与网络请求边界
- 术语表完善
- 其他 P2 项
- **命名 Deferred（Party Mode 产出）**：占位与商标检索（GitHub/crates.io/npm）；英文 Slogan（国际化时补充）；「5 分钟上手」用户验证（必要时调整为「快速上手」）

---

## 修订历史

| 日期 | 修订说明 |
|------|----------|
| 2026-03-24 | 初稿；Advanced Elicitation（First Principles、Shark Tank、Challenge、Pre-mortem、Critique、Reasoning）增强 |
| 2026-03-24 | Party Mode 100 轮讨论，识别 90 项 gaps |
| 2026-03-24 | P0/P1/P2 gaps 全面修复；新增附录 A–D、明确不做、修订历史 |
| 2026-03-24 | Party Mode 100 轮定名：规划产品名 ClawForge，slogan「记忆可见，进化可期」；代号 ClawScope、仓库 `claw-scope/`（占位冲突后采用；见 PROJECT_SETUP、OCCUPANCY_REPORT） |
| 2026-03-24 | 新增 FR7a：记忆视图「思维导图」Tab（与每日足迹并列），分类汇总 Agent 记忆树；NFR1 补充思维导图性能预期 |
| 2026-03-24 | 进化模块：明确 MVP 为模板 + diff + 可选 doctor；MVP 不做「应用内 LLM SDK 自动落盘进化」；Growth 方向见同节产品决策 |
| 2026-03-24 | Edit PRD：Author 去模板占位；Journey 1–2 与 FR7a 明确「表格｜每日足迹｜思维导图」同级分段 Tab，与 UX §8.3 对齐 |
