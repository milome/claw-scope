# Visual Baseline

Playwright 截图回归产物统一放在 `artifacts/visual-regression/`。

## 目录结构

- `<baseline-name>/light/*.png`
- `<baseline-name>/dark/*.png`

页面命名当前固定为：

- `profile.png`
- `memory.png`
- `config.png`
- `evolution.png`

## 运行方式

1. 先启动预览环境：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

2. 再执行截图回归：

```bash
npm run visual:baseline
```

CI / 无头一键流程：

```bash
npm run visual:ci
```

如需自定义 baseline 名称：

```bash
VISUAL_BASELINE_NAME=2026-04-02-theme-baseline npm run visual:baseline
```

如需自定义目标地址：

```bash
VISUAL_BASE_URL=http://127.0.0.1:4173 npm run visual:baseline
```

## 当前用途

- 明 / 暗主题逐页截图回归
- Profile / Memory / Shell 导航视觉走查
- 视觉改造前后人工比对 baseline

## CI 集成建议

CI 中推荐直接运行：

```bash
npm ci
npx playwright install --with-deps chromium
npm run visual:ci
```

然后把 `artifacts/visual-regression/ci-baseline/` 作为 artifact 上传。
