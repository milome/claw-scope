# ClawScope

**Memory Made Visible, Evolution Enabled** · [中文](README.md)

An OpenClaw memory and evolution management tool — a cross-platform desktop app built with Tauri 2 + Rust.

**Codename:** Both the repository and executable use **ClawScope** as the project codename.

## Feature Overview

- **Memory Management** — Browse, search, and archive OpenClaw memory entries with semantic search and knowledge graph support
- **Evolution Tracking** — Review and trace OpenClaw evolution history, generate audit reports
- **Configuration Management** — Centrally manage OpenClaw node configurations and state
- **Cross-Platform** — Native desktop app for Windows / macOS / Linux

## Quick Start

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Notes:

- Local `tauri build` only produces installers for the current host platform.
- Running on Windows yields Windows artifacts only (e.g., `msi` / `nsis`).
- For the canonical cross-platform release matrix, see the GitHub Actions release workflow documented below under "Release Platforms".

## Testing

```bash
# Run all tests
npm test

# Run type checking
npm run lint
```

## Visual Regression

This repository includes a Playwright-based light/dark theme screenshot regression workflow that captures baselines for the four main pages: `Profile`, `Memory`, `Config`, and `Evolution`.

With an existing preview server:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run visual:baseline
```

One-command local / CI:

```bash
npm run visual:ci
```

Environment variables:

| Variable | Description |
|---|---|
| `VISUAL_BASELINE_NAME` | Output directory name; defaults to the current date or `ci-baseline` in CI |
| `VISUAL_BASE_URL` | Specify an existing preview URL |
| `VISUAL_PORT` / `VISUAL_HOST` | Host/port for the preview server started by `visual:ci` |

Screenshots are output to `artifacts/visual-regression/<baseline-name>/`. See [`artifacts/visual-regression/README.md`](artifacts/visual-regression/README.md) for directory conventions and manual review instructions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Radix UI + Tailwind CSS 4 + shadcn/ui |
| Desktop | Tauri 2 + Rust |
| Charts | Recharts |
| Testing | Vitest + Playwright |

## Prerequisites

- **Windows:** Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload, or a full Visual Studio installation
- **Rust:** `rustup default stable-msvc` (MSVC toolchain recommended on Windows)

If you encounter `dlltool.exe: program not found` during build, install the toolchain above.

## Release Platforms

ClawScope targets the following platforms for open-source releases:

| Platform | Artifact Formats |
|---|---|
| Windows x64 | NSIS `setup.exe` / `MSI` |
| macOS Apple Silicon | `.app` / `.dmg` |
| macOS Intel | `.app` / `.dmg` |
| Linux x64 | `AppImage` / `deb` / `rpm` |

A cross-platform release workflow is included in the repository:

- [`.github/workflows/release.yml`](.github/workflows/release.yml)

For additional details and the release matrix, see:

- [`docs/release/platform-support.md`](docs/release/platform-support.md)

## Documentation

If you use the BMAD workflow locally, planning artifacts reside in `_bmad-output/` (not tracked by `.gitignore` in this repo; clone and generate or obtain from your team).

- PRD: `_bmad-output/planning-artifacts/main/prd.md`
- Project setup: `_bmad-output/planning-artifacts/main/PROJECT_SETUP.md`
- Help: [`docs/help/choose-extra-paths-or-knowledge-injection.md`](docs/help/choose-extra-paths-or-knowledge-injection.md)

## License

[MIT](LICENSE)