# ClawScope

**记忆可见，进化可期**

OpenClaw 记忆与进化管理工具 — Tauri 2 + Rust 桌面应用。

**命名：** 规划文档中的产品名为 **ClawForge**；本仓库与可执行侧为 **代号 ClawScope**。

## 快速开始

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

## 技术栈

- **前端:** React + TypeScript + Vite
- **桌面:** Tauri 2 + Rust

## 相关文档

若本地使用 BMAD 工作流，规划产物在 `_bmad-output/`（本仓库 `.gitignore` 不跟踪；克隆后需自行生成或从团队渠道获取）。

- PRD: `_bmad-output/planning-artifacts/main/prd.md`
- 项目设置: `_bmad-output/planning-artifacts/main/PROJECT_SETUP.md`

## 环境要求

- **Windows:** 需安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含「使用 C++ 的桌面开发」工作负载）或完整 Visual Studio
- **Rust:** `rustup default stable-msvc`（Windows 上建议使用 MSVC 工具链）

若构建报错 `dlltool.exe: program not found`，请安装上述工具链。

## License

MIT
