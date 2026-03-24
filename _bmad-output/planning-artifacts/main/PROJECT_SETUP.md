# ClawForge — 项目设置规范

**Slogan:** 记忆可见，进化可期

**版本:** 0.1  
**日期:** 2026-03-24  
**状态:** 已定名（Party Mode 100 轮） / **占位检索后调整为 ClawScope + claw-scope**（见 OCCUPANCY_REPORT.md）

**代号 ClawScope：** PRD / Product Brief 中的**规划产品名**为 **ClawForge**；**代号**为 **ClawScope**，用于当前实现、仓库目录 `claw-scope/`、Tauri `productName` 与安装包展示名。

---

## 1. 项目名称

### 1.1 产品名 vs 仓库名（已决策）

| 层级 | 决策结果 | 说明 |
|------|----------|------|
| **规划产品名（PRD/Brief）** | **ClawForge** | 需求与对外叙述 |
| **代号** | **ClawScope** | 实现、可执行与安装包展示名 |
| **Slogan** | **记忆可见，进化可期** | 8 字对仗，覆盖记忆与进化 |
| **仓库名（GitHub）** | `claw-scope` | 占位检索后采用；已初始化于 `claw-scope/` |
| **包名/标识符** | `com.claw.scope` 等（见 `tauri.conf`） | Cargo crate、Tauri bundle identifier 等 |

### 1.2 命名备选链（占位冲突时依次尝试）

| 顺序 | 产品名 | 仓库名 |
|------|--------|--------|
| 1 | ClawForge | openclaw-forge |
| 2 | ClawRecall | claw-recall |
| 3 | ClawScope | claw-scope |
| 4 | OpenClaw Memory Lab | openclaw-memory-lab |

### 1.3 决策记录

- [x] **规划产品名（PRD）:** ClawForge
- [x] **代号:** ClawScope
- [x] **最终仓库名:** claw-scope（非 openclaw-forge；见 OCCUPANCY_REPORT）
- [ ] **最终 bundle identifier:** _____________（用于 macOS/Windows 安装包；建议 `com.openclaw.forge`）
- [ ] **占位与商标检索**：GitHub、crates.io、npm 检查（发布前必做）

---

## 2. 开源项目标准结构

### 2.1 根目录布局（Tauri 2 + 社区规范）

```
 claw-scope/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # PR/推送到 main 时的检查
│   │   ├── release.yml         # 跨平台构建与发布
│   │   └── release-linux-arm.yml  # Linux ARM（可选）
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── config.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml          # 依赖更新（可选）
├── .vscode/                    # 推荐编辑器配置（可选）
├── docs/                       # 用户/开发者文档
│   ├── README.md               # 文档索引
│   ├── install.md              # 安装说明
│   └── development.md         # 开发环境搭建
├── src/                        # 前端（WebView）
│   ├── index.html
│   ├── main.js / main.tsx
│   └── ...
├── src-tauri/                  # Tauri Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   └── src/
│       └── lib.rs / main.rs
├── tests/                      # 集成/E2E 测试（可选）
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
└── package.json / pnpm-lock.yaml
```

### 2.2 必备社区文件

| 文件 | 用途 | 参考 |
|------|------|------|
| **LICENSE** | 法律框架（建议 MIT 或 Apache-2.0） | [choosealicense.com](https://choosealicense.com/) |
| **README.md** | 项目概览、安装、快速开始 | 含 badges、截图、各平台安装说明 |
| **CONTRIBUTING.md** | 贡献指南、PR 流程、开发环境 | [GitHub 建议](https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions) |
| **CODE_OF_CONDUCT.md** | 社区行为准则 | [Contributor Covenant](https://www.contributor-covenant.org/) |
| **SECURITY.md** | 安全漏洞报告流程 | [GitHub SECURITY.md](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/adding-a-security-policy-to-your-repository) |
| **CHANGELOG.md** | 版本变更记录 | 遵循 [Keep a Changelog](https://keepachangelog.com/) |

### 2.3 Tauri 2 典型结构

- **前端**: `src/` 下为任意框架（React/Vue/Svelte/Vanilla），由 `tauri.conf.json` 指定
- **后端**: `src-tauri/` 为 Rust 项目，含 `tauri.conf.json`、`Cargo.toml`
- **打包产物**: `src-tauri/target/release/bundle/` 下生成各平台安装包

---

## 3. CI/CD 流程

### 3.1 流水线概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI (Pull Request / push to main)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Lint (前端 + Rust) → Test → Build (单平台 smoke)                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    Release (push to release / tag v*)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  跨平台构建矩阵 → 生成安装包 → 创建 GitHub Release（Draft）              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 CI 工作流（`.github/workflows/ci.yml`）

**触发:** `push` 到 `main`、`pull_request` 到 `main`

**步骤:**
1. Checkout
2. 安装 Node.js（LTS）+ 前端依赖
3. 安装 Rust stable
4. 前端 lint（若有）
5. Rust `cargo check` / `cargo clippy`
6. 前端测试（若有）
7. 单平台 build smoke（如 Linux 或 Windows，缩短反馈时间）

### 3.3 Release 工作流（`.github/workflows/release.yml`）

**触发:** `push` 到 `release` 分支 **或** 版本 tag（如 `v1.0.0`）

**构建矩阵（参考 [Tauri 官方文档](https://v2.tauri.app/distribute/pipelines/github/)）:**

| 平台 | Runner | 产物 |
|------|--------|------|
| Windows x64 | `windows-latest` | `.msi` + `.exe` (NSIS) |
| macOS Intel | `macos-latest` + `--target x86_64-apple-darwin` | `.dmg` + `.app` |
| macOS ARM (M1+) | `macos-latest` + `--target aarch64-apple-darwin` | `.dmg` + `.app` |
| Linux x64 | `ubuntu-22.04` | `.deb` + `.AppImage` |
| Linux ARM64 | `ubuntu-22.04-arm`（公开仓库可用） | `.deb` + `.AppImage` |

**关键配置:**
- `fail-fast: false`：单平台失败不影响其它平台
- `tauri-apps/tauri-action@v0`：执行 `tauri build`、上传到 GitHub Release
- `releaseDraft: true`：先创建 Draft，人工审核后发布

### 3.4 跨平台安装包形式（Tauri bundle 默认）

| 平台 | 默认产物 | 说明 |
|------|----------|------|
| **Windows** | `.msi` (WiX) | 推荐作为主安装包 |
| **Windows** | `.exe` (NSIS) | 可选，可通过 `tauri.conf.json` 配置 |
| **macOS** | `.dmg` | 磁盘映像 |
| **macOS** | `.app` | 应用包（内含于 .dmg 或单独） |
| **Linux** | `.deb` | Debian/Ubuntu |
| **Linux** | `.AppImage` | 通用便携格式 |
| **Linux** | `.rpm` | 可选，Fedora/RHEL |

### 3.5 发布前检查清单

- [ ] GitHub Actions 需 `contents: write` 权限（创建 Release）
- [ ] 若需代码签名：macOS 配置 Developer ID + 公证；Windows 可选证书
- [ ] `tauri.conf.json` 中 `version` 与 `package.json`/`Cargo.toml` 保持一致

---

## 4. 与 PRD 的对应关系

| PRD 要求 | 本规范对应 |
|----------|------------|
| NFR7 跨平台（Win/mac/Linux） | Release 工作流构建矩阵 |
| Technical Success「单可执行文件或安装包」 | `.msi`、`.dmg`、`.deb`、`.AppImage` |
| 附录 C Linux 测试发行版 | `.deb` 覆盖 Ubuntu；`.AppImage` 覆盖更多发行版 |

---

## 5. 工作流模板

以下文件可直接复制到新仓库使用：

- `workflow-templates/ci.yml` → `.github/workflows/ci.yml`
- `workflow-templates/release.yml` → `.github/workflows/release.yml`

复制后需根据实际包管理器（npm/yarn/pnpm）调整 `cache` 与 `run` 命令。

---

## 6. Deferred Gaps（Party Mode 产出）

| ID | 内容 |
|----|------|
| 1 | **占位与商标检索**：在 GitHub、crates.io、npm 执行占位检查；必要时商标检索 |
| 2 | **英文 Slogan**：国际化时补充（如 "Memory Visible, Evolution Within Reach"） |
| 3 | **「5 分钟上手」验证**：用户测试验证；若未达则调整为「快速上手」 |

---

## 7. 下一步行动

1. **占位检索**：在 GitHub、crates.io、npm 检查 openclaw-forge / claw-forge 可用性
2. **初始化仓库**：使用 `npm create tauri-app@latest` 或等价方式，按 §2 调整目录；根目录命名为 `openclaw-forge`
3. **添加社区文件**：从模板生成 LICENSE、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY
4. **配置 CI**：复制 `workflow-templates/ci.yml` 到 `.github/workflows/ci.yml`
5. **配置 Release**：复制 `workflow-templates/release.yml` 到 `.github/workflows/release.yml`
6. **验证**：推送到 `release` 或打 tag `v0.1.0`，确认各平台产物出现在 GitHub Release 中
