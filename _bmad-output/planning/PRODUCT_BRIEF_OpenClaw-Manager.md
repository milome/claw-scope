# Product Brief: ClawForge

**Slogan:** 记忆可见，进化可期

**代号 ClawScope：** 本文档中的产品名为 **ClawForge**；代码与安装包侧使用代号 **ClawScope**（仓库 `claw-scope/`）。

**基于头脑风暴产出 | 2026-03-24** · **定名（Party Mode 2026-03-24）**

---

## Executive Summary

ClawForge 是一款面向 OpenClaw 用户的桌面管理工具，使用 Tauri 2 + Rust 构建，专注于**记忆深度管理**与 **Agent 进化定制**——这两块在 ClawX、ClawManager、OneClaw 等现有产品中仍是空白。用户能清晰看到自己的 claw 每天做了什么、增加了哪些记忆、有了哪些进步和技能，并在 identity/soul 基础上进行强化与进化实验。目标用户在 5 分钟内即可理解所有操作入口。

---

## The Problem

**当前痛点：**
- 改配置很烦：手写 JSON、路径分散，容易出错
- 记忆不好找：MEMORY.md、日记文件散落，缺乏统一视图
- 不知道 Agent 在干嘛：无仪表盘、无状态可视化
- 不知道改了什么：缺乏变更追踪与历史
- 不知道有没有进化：看不到 Agent 的成长足迹、技能习得、记忆积累

**谁在承受：** 深度使用 OpenClaw 的用户、自托管多 Agent 场景、希望 claw 随使用变聪明的人。

**现状成本：** 依赖 CLI、手动编辑配置、记忆黑盒，认知负担高，进化不可见。

---

## The Solution

**产品形态：** Tauri 2 + Rust 桌面应用，读写 `~/.openclaw/`，可选调用 `openclaw` CLI。

**核心体验：**
1. **记忆可视化**：表格、每日足迹、**思维导图**（与每日足迹并列 Tab，分类汇总 Agent 记忆树）、关系图谱（Growth）等多视图；筛选、排序、搜索；清晰展示「每天做了什么、记了什么、学了什么」
2. **5 分钟上手**：操作入口一目了然；面向技术小白的清爽界面
3. **Agent 配置编辑**：可视化编辑 openclaw.json、per-agent 覆盖，替代手改 JSON
4. **进化实验**：在 identity/soul 基础上，通过预设模板或半自动反馈定制差异化进化

**用户获益：** 记忆可见、成长足迹、差异化进化、清爽管理界面。

---

## What Makes This Different

| 维度 | 竞品（ClawX、ClawManager） | ClawForge |
|------|----------------------------|------------------|
| 记忆管理 | 自动记忆或备份/恢复 | **深度管理**：策略、索引、检索、多视图 |
| 进化机制 | 无 | **有**：预设模板、半自动反馈、进化实验 |
| 目标用户 | 进阶用户或运维 | **技术小白**：5 分钟上手、可视化优先 |
| 技术栈 | TS、Electron | **Tauri 2 + Rust**：轻量、本地、可配置 fs scope |
| 差异化 | 安装、使用、监控 | **记忆 + 进化**，填补生态空白 |

**护城河：** 先发聚焦记忆与进化；技术小白友好的可视化；紧跟 OpenClaw 的抽象层设计。

---

## Who This Serves

**主要用户：** 想「把记忆管好、让 Agent 变聪明」的 OpenClaw 用户；不排斥图形界面，希望 5 分钟内理解操作的技术小白。

**次要用户：** 进阶用户需要细粒度配置与进化实验；开发者需要与 CLI/API 集成。

---

## Success Criteria

- 用户能在 5 分钟内找到记忆浏览、配置编辑、进化实验的入口
- 用户能清晰看到 claw 的每日活动、记忆增长、技能进步
- 用户能基于 identity/soul 完成至少一次进化实验（预设模板或半自动反馈）
- 与 OpenClaw 主流版本兼容；适配层可应对配置/记忆结构变更
- 不被主流桌面沙箱阻断对 `~/.openclaw/` 的读写（capabilities 配置得当）

---

## Scope

### MVP（第一版）

- **记忆管理**：浏览、搜索、筛选；表格视图 + 每日足迹视图 + **思维导图视图**（分类汇总记忆树）
- **Agent 配置**：可视化编辑 openclaw.json、per-agent 覆盖
- **进化策略**：预设模板（如激进/保守/技能优先）一键应用
- **目标用户**：技术小白；5 分钟上手
- **集成方式**：本地文件读写 + CLI 调用（openclaw doctor、memory index 等）

### 明确不做（MVP）

- 全自动进化（D4）
- 关系图谱（B1）——可放在 V1
- 日志监控、Token 用量——可放在 V2
- 多工作区/多机器远程管理

### V1 规划

- 仪表盘/概览
- 关系图谱（记忆/技能/Agent 关联）
- 半自动反馈（用户标记有用/无用，系统据此调整）

### V2 规划

- 进化机制深化
- 日志与资源监控

---

## Vision

若产品成功，2–3 年内可演进为：

- **OpenClaw 生态中的记忆与进化标准工具**：深度用户首选管理界面
- **技术小白友好**：与 ClawX/ClawManager 形成互补，前者偏使用，后者偏运维，本产品偏记忆与进化
- **可扩展平台**：插件化进化策略、可配置视图、与 OpenClaw 生态深度集成

---

## Technical Approach（概要）

- **前端：** WebView + React/Vue 等；Tauri 2 支持任意前端框架
- **后端：** Rust；读写 `~/.openclaw/`；调用 `openclaw` CLI
- **权限：** Tauri capabilities 配置 `$HOME/.openclaw/**` 等 scope
- **适配层：** 对 openclaw.json、记忆结构做抽象，应对 OpenClaw 版本变化
- **部署：** 单二进制，跨平台（Windows/macOS/Linux）

---

## References

- 头脑风暴会话：`_bmad-output/brainstorming/brainstorming-session-2026-03-24.md`
- 形态学分析：见同上文档「技法三：形态学分析」
- 跨界借鉴：Obsidian、Docker Desktop、Notion、1Password 迁移模式
