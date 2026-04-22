# ClawScope

**记忆可见，进化可期** · [English](README.en.md)

OpenClaw 记忆与进化管理工具 — 基于 Tauri 2 + Rust 构建的跨平台桌面应用。

**代号：** 本仓库与可执行文件均使用 **ClawScope** 作为项目代号。

## 功能概览

- **记忆管理** — 查看、搜索、归档 OpenClaw 记忆条目，支持语义搜索与知识图谱
- **进化追踪** — 审视与回溯 OpenClaw 进化历史，生成审计报告
- **配置管理** — 集中管理 OpenClaw 节点配置与状态
- **跨平台** — Windows / macOS / Linux 原生桌面应用

## 快速开始

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

说明：

- 本地 `tauri build` 只会产出当前宿主平台的安装包。
- 在 Windows 本机执行时，默认只会得到 Windows 产物（如 `msi` / `nsis`）。
- 标准开源发布矩阵以 GitHub Actions 的跨平台 release workflow 为准，见下文"发布平台"。

## 测试

```bash
# 运行所有测试
npm test

# 运行类型检查
npm run lint
```

## Visual Regression

本仓库内置一套基于 Playwright 的明 / 暗主题截图回归流程，用于对 `Profile`、`Memory`、`Config`、`Evolution` 四个主页面做逐页基线采样。

本地已有预览服务时：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run visual:baseline
```

一键本地 / CI 方式：

```bash
npm run visual:ci
```

可选环境变量：

| 变量 | 说明 |
|---|---|
| `VISUAL_BASELINE_NAME` | 指定输出目录名，默认取当天日期或 CI 中的 `ci-baseline` |
| `VISUAL_BASE_URL` | 指定已有预览地址 |
| `VISUAL_PORT` / `VISUAL_HOST` | 用于 `visual:ci` 自动拉起预览服务时指定监听地址 |

截图产物默认输出到 `artifacts/visual-regression/<baseline-name>/`，目录规范与人工审查方式见 [`artifacts/visual-regression/README.md`](artifacts/visual-regression/README.md)。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| UI | Radix UI + Tailwind CSS 4 + shadcn/ui |
| 桌面 | Tauri 2 + Rust |
| 图表 | Recharts |
| 测试 | Vitest + Playwright |

## 环境要求

- **Windows：** 需安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含「使用 C++ 的桌面开发」工作负载）或完整 Visual Studio
- **Rust：** `rustup default stable-msvc`（Windows 上建议使用 MSVC 工具链）

若构建报错 `dlltool.exe: program not found`，请安装上述工具链。

## 发布平台

面向开源发布时，ClawScope 目标对齐以下平台：

| 平台 | 产物格式 |
|---|---|
| Windows x64 | NSIS `setup.exe` / `MSI` |
| macOS Apple Silicon | `.app` / `.dmg` |
| macOS Intel | `.app` / `.dmg` |
| Linux x64 | `AppImage` / `deb` / `rpm` |

仓库内已提供跨平台发布工作流：

- [`.github/workflows/release.yml`](.github/workflows/release.yml)

补充说明与发布矩阵见：

- [`docs/release/platform-support.md`](docs/release/platform-support.md)

## 相关文档

若本地使用 BMAD 工作流，规划产物在 `_bmad-output/`（本仓库 `.gitignore` 不跟踪；克隆后需自行生成或从团队渠道获取）。

- PRD: `_bmad-output/planning-artifacts/main/prd.md`
- 项目设置: `_bmad-output/planning-artifacts/main/PROJECT_SETUP.md`
- 帮助文档: [`docs/help/choose-extra-paths-or-knowledge-injection.md`](docs/help/choose-extra-paths-or-knowledge-injection.md)

## License

[MIT](LICENSE)