# Figma 导入说明（单文件 → 可编辑图层 → 原型）

## 重要说明

| 事实 | 说明 |
|------|------|
| **`.fig` 文件** | 只能由 **Figma 自己导出**，无法用文本或脚本在本仓库「凭空生成」可上传的二进制 `.fig`。 |
| **本目录提供的 `Prototype-NFR4-Storyboard.svg`** | **标准 SVG**，可 **拖入 Figma** 或 **文件 → Place from computer**，得到 **矢量图层**，再手动 **Prototype 连线** 即可成为可点击原型。 |

## 一步导入

1. 打开 [figma.com](https://www.figma.com) → 新建 **Design file**。  
2. 将 **`Prototype-NFR4-Storyboard.svg`** 拖入画布（或 **Place image / SVG**）。  
3. 导入后一般为 **一组 Group**。建议：  
   - **右键 → Ungroup** 若需要单层；或  
   - 选中每个分镜子组（`01-Main-Memory` … `05-Evolution`），**右键 → Frame selection**，得到 **5 个 1024×768 Frame**，便于对齐 **Prototype**。  
4. **Prototype** 面板：  
   - 从 **01** 的「筛选」热区可连到 **02**（若需精细热点，在 Frame 上叠小矩形并设 **On click → Navigate to**）。  
   - **02** 表格行 → **03 详情**；侧栏「配置」「进化」→ **04**、**05**。  
5. **Share** → 打开 **Prototype** 链接，用于 **NFR4 走查**（见 `ux-design-specification.md` §13）。

## 文件内容

- 横向 **5 屏**：主界面记忆 → 已筛选 → 详情 → 配置 → 进化（与 PRD 旅程一致）。  
- 单画布总宽 **5120×768**；每屏逻辑 **1024×768**。  
- 界面文案在 SVG 中为 **英文占位**（避免部分环境字体缺字）；导入 Figma 后可批量改为中文。

## 生成「可分享原型」的最后一步

连线完成后：**File → Save local copy…** 可得到 **`.fig`**，或直接用 **Share → Prototype** 链接走查，无需再上传其他文件。

## 与 UX 规格的关系

- 详细任务脚本与走查表：**`../ux-design-specification.md`** §13。  
- 色板参考：**`../ux-color-themes.html`**。
