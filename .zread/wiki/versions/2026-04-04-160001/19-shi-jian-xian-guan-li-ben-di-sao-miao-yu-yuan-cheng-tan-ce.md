ClawScope 的时间线管理模块负责处理代理（Agent）的每日记忆条目（Daily Memory Entries），这些条目以 `memory/YYYY-MM-DD.md` 的格式存储在代理工作空间中。该模块实现了**双模式架构**：当应用与 OpenClaw 网关位于同一文件系统时，直接进行本地文件扫描；当通过远程 WebSocket 连接时，则通过网关的会话机制进行远程探测。这种设计确保了无论连接模式如何，用户都能可靠地访问代理的时间线数据。

Sources: [lib.rs](src-tauri/src/lib.rs#L1-L46), [commands.rs](src-tauri/src/gateway/commands.rs#L1-L50)

## 核心概念与数据模型

### 时间线条目（Timeline Entry）

时间线条目是代理每日记忆的持久化存储单元，遵循 `memory/YYYY-MM-DD.md` 的命名约定。每个条目包含完整的文件元数据（路径、大小、修改时间）以及可选的内容载荷。

**条目结构定义**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `String` | 标准化名称，如 `memory/2026-03-28.md` |
| `path` | `String` | 绝对文件系统路径 |
| `missing` | `bool` | 标记文件是否存在 |
| `size` | `Option<u64>` | 文件字节大小（存在时） |
| `updated_at_ms` | `Option<u64>` | 最后修改时间戳（毫秒） |
| `content` | `Option<String>` | 文件内容（按需加载） |

Sources: [types.rs](src-tauri/src/gateway/types.rs#L78-L86)

### 访问模式（Access Mode）

时间线管理根据工作空间的可访问性自动选择操作模式：

```rust
pub enum GatewayAgentMemoryTimelineSource {
    LocalWorkspace,  // 本地文件系统可直接访问
    RemoteProbe,     // 需通过网关会话远程探测
    Unavailable,     // 无法访问（未连接或工作空间缺失）
}
```

模式选择逻辑位于 `resolve_memory_timeline_access` 函数，它检查工作空间路径是否存在且可读。如果本地路径不可访问（如远程网关场景），则自动降级到远程探测模式。

Sources: [types.rs](src-tauri/src/gateway/types.rs#L232-L238), [connector.rs](src-tauri/src/gateway/connector.rs#L1380-L1410)

### 访问原因（Access Reason）

当时间线不可用时，系统会提供具体的诊断原因：

| 原因 | 说明 |
|------|------|
| `WorkspaceLocalAndReadable` | 本地工作空间可正常访问 |
| `WorkspaceRemoteOrNotReadable` | 工作空间位于远程或权限不足 |
| `WorkspaceMissing` | 代理配置中未指定工作空间 |
| `GatewayNotConnected` | 网关连接尚未建立 |

Sources: [types.rs](src-tauri/src/gateway/types.rs#L240-L247)

## 本地扫描（Local Scan）

本地扫描模式直接操作文件系统，提供最高效的时间线访问。该模式要求 ClawScope 与 OpenClaw 网关运行在同一主机上，且对代理工作空间具有读取权限。

### 扫描流程

本地扫描遵循以下步骤：

1. **访问解析**：调用 `agent_memory_timeline_access_resolve` 确定工作空间路径和访问模式
2. **目录枚举**：扫描 `{workspace}/memory/` 目录下的所有 `.md` 文件
3. **条目过滤**：仅保留符合 `memory/YYYY-MM-DD.md` 格式的文件名
4. **元数据提取**：收集文件大小和修改时间
5. **结果排序**：按日期降序排列（最新的在前）

### 实现细节

`scan_local_memory_timeline_entries` 函数实现了核心扫描逻辑。它使用 `fs::read_dir` 遍历内存目录，并通过 `is_daily_memory_entry_name` 验证文件名格式：

```rust
fn is_daily_memory_entry_name(name: &str) -> bool {
    let Some(date_part) = name
        .strip_prefix("memory/")
        .and_then(|value| value.strip_suffix(".md"))
    else {
        return false;
    };
    NaiveDate::parse_from_str(date_part, "%Y-%m-%d").is_ok()
}
```

扫描结果包含诊断信息，如扫描目录路径、处理的文件数和跳过的文件数，帮助用户排查时间线显示异常。

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L1420-L1480), [connector.rs](src-tauri/src/gateway/connector.rs#L2760-L2770)

### 本地条目读取

对于本地可访问的时间线，`read_local_memory_timeline_entry` 函数提供直接的文件读取能力。它构建完整路径、读取文件内容，并返回包含内容载荷的完整条目结构。如果文件不存在，返回的条目将标记为 `missing: true`。

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L1482-L1520)

## 远程探测（Remote Probe）

当 ClawScope 连接到远程 OpenClaw 网关时，文件系统直接访问不可用。此时系统启动**远程探测**机制，通过网关的会话 API 查询指定日期范围内的记忆条目。

### 探测架构

远程探测基于 OpenClaw 的**会话-运行（Session-Run）**模型构建：

```
┌─────────────┐     sessions.create      ┌─────────────┐
│   ClawScope │ ───────────────────────> │   Gateway   │
│             │     (获取 session_key)    │             │
│             │                          │             │
│             │     sessions.send        │             │
│             │ ───────────────────────> │             │
│             │     (发送 memory_get     │             │
│              │      提示词)              │             │
│             │                          │             │
│             │     agent.wait           │             │
│             │ ───────────────────────> │             │
│             │     (等待运行完成)        │             │
│             │                          │             │
│             │     sessions.get/        │             │
│             │     chat.history         │             │
│             │ <─────────────────────── │             │
│             │     (获取助手回复)        │             │
└─────────────┘                          └─────────────┘
```

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L1820-L1920)

### 探测提示词（Probe Prompt）

远程探测使用精心设计的提示词指导代理执行 `memory_get` 工具调用。系统提供两种提示词变体：

**元数据探测**（用于列表展示）：
```
Use memory_get to read exactly this workspace memory file: {name}

Return exactly one JSON object and nothing else.
{"name":"{name}","missing":false,"textLength":123,"contentPreview":"first line"}
```

**完整内容读取**（用于详情展示）：
```
Use memory_get to read exactly this workspace memory file: {name}

Return exactly one JSON object and nothing else.
{"name":"{name}","missing":false,"textLength":123,"content":"full file text"}
```

提示词强制要求返回严格的 JSON 格式，避免解析歧义。

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L1690-L1730)

### 日期范围处理

远程探测支持两种日期指定方式：

1. **范围探测**：通过 `start_date` 和 `end_date` 定义连续日期区间
2. **离散探测**：通过 `dates` 数组指定任意日期集合

系统对日期范围实施以下约束：
- 最大探测天数：31 天（`REMOTE_TIMELINE_PROBE_MAX_DAYS`）
- 日期格式：严格的 `YYYY-MM-DD` ISO 8601 格式
- 逆序遍历：从结束日期向开始日期遍历，确保最新条目优先

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L1530-L1590), [connector.rs](src-tauri/src/gateway/connector.rs#L1592-L1620)

### 重试机制

网络波动可能导致探测超时。系统实现了**自动重试**策略：

| 阶段 | 首次超时 | 重试超时 |
|------|----------|----------|
| 等待运行完成 | 20 秒 | 35 秒 |
| 请求响应 | 25 秒 | 40 秒 |

`remote_probe_timeline_entry_with_retry` 函数封装了这一逻辑。当首次探测超时时，自动使用更宽松的超时参数重试一次。重试结果通过 `retried` 和 `recovered_after_retry` 字段追踪。

Sources: [connector.rs](src-tauri/src/gateway/connector.rs#L2200-L2240)

### 探测结果汇总

远程探测完成后，系统生成详细的探测摘要（`GatewayAgentMemoryTimelineProbeSummary`）：

```rust
pub struct GatewayAgentMemoryTimelineProbeSummary {
    pub start_date: String,
    pub end_date: String,
    pub attempted_days: usize,      // 尝试探测的天数
    pub hit_days: usize,            // 找到文件的天数
    pub miss_days: usize,           // 文件不存在的天数
    pub skipped_days: usize,        // 超时或错误的天数
    pub timeout_days: usize,        // 超时的天数
    pub error_days: usize,          // 错误的天数
    pub retry_days: usize,          // 触发重试的天数
    pub retry_recovered_days: usize,// 重试成功的天数
    pub days: Vec<GatewayAgentMemoryTimelineProbeDayResult>,
    pub status: GatewayAgentMemoryTimelineProbeStatus,
    pub cached: bool,
}
```

探测状态（`ProbeStatus`）分为五类：
- `Complete`：所有日期探测成功
- `Empty`：所有日期均无文件
- `Partial`：部分日期成功，部分失败
- `Timeout`：所有日期均超时
- `Error`：所有日期均发生错误

Sources: [types.rs](src-tauri/src/gateway/types.rs#L270-L310), [connector.rs](src-tauri/src/gateway/connector.rs#L1750-L1810)

## 缓存机制

为提升重复访问性能，远程探测结果会被缓存。缓存系统位于 `GatewayAppState` 中，使用内存哈希表存储。

### 缓存键设计

缓存键综合以下要素生成，确保唯一性和上下文感知：

```rust
fn build_remote_probe_cache_key(
    gateway_origin: Option<&str>,
    agent_id: &str,
    workspace: &str,
    start_date: &str,
    end_date: &str,
) -> String {
    format!("{}|{}|{}|{}|{}",
        gateway_origin.unwrap_or_default(),
        agent_id.trim(),
        workspace.trim(),
        start_date.trim(),
        end_date.trim()
    )
}
```

### 缓存策略

- **TTL**：120 秒（`REMOTE_TIMELINE_PROBE_CACHE_TTL`）
- **缓存条件**：仅缓存 `Complete`、`Empty`、`Partial` 状态的结果
- **失效触发**：新连接建立或断开时清除缓存

Sources: [state.rs](src-tauri/src/gateway/state.rs#L90-L130), [connector.rs](src-tauri/src/gateway/connector.rs#L1660-L1680)

## 前端集成

前端通过 `OpenClawContext` 暴露时间线相关的异步函数，供 React 组件调用。

### 核心 API

| 函数 | 说明 |
|------|------|
| `gatewayAgentMemoryTimelineGet` | 获取时间线（自动选择本地或远程） |
| `gatewayAgentMemoryTimelineAccessResolve` | 解析访问模式和原因 |
| `gatewayAgentMemoryTimelineLocalScan` | 强制本地扫描 |
| `gatewayAgentMemoryTimelineRemoteProbe` | 远程范围探测 |
| `gatewayAgentMemoryTimelineRemoteProbeDates` | 远程离散日期探测 |
| `gatewayAgentMemoryTimelineEntryGet` | 获取条目元数据 |
| `gatewayAgentMemoryTimelineEntryRead` | 读取条目完整内容 |

Sources: [OpenClawContext.tsx](src/app/contexts/OpenClawContext.tsx#L530-L620)

### 状态管理

`memoryState.ts` 模块提供前端状态处理工具：

- **`buildMemoryFootprintGroups`**：将时间线条目按日期分组，便于日历视图展示
- **`filterMemoryFootprintGroups`**：按探测状态过滤（全部/失败/已恢复/可读/缺失）
- **`summarizeMemoryFootprintGroups`**：统计各类状态的数量分布
- **`resolveTimelineProbeRangePreset`**：生成默认探测范围（最近 7 天）

Sources: [memoryState.ts](src/app/components/views/memoryState.ts#L230-L350)

### UI 组件

`MemoryFootprintsPanel` 组件负责渲染时间线界面，包括：
- 访问模式指示器（本地/远程/不可用）
- 日期范围选择器
- 探测执行按钮与状态反馈
- 按日期分组的时间线列表
- 单条目内容阅读器

Sources: [MemoryFootprintsPanel.tsx](src/app/components/views/MemoryFootprintsPanel.tsx#L1-L100)

## 错误处理与诊断

时间线管理模块实现了全面的错误分类和恢复策略。

### 错误分类

| 类别 | 场景 | 可恢复性 |
|------|------|----------|
| `Transport` | 网络超时、连接中断 | 是（可重试） |
| `Protocol` | 响应格式错误、JSON 解析失败 | 否 |
| `RequestRejected` | 网关拒绝请求 | 否 |
| `NotImplemented` | 功能未实现（如远程内存索引） | 否 |

### 诊断信息

每次扫描或探测操作返回的 `diagnostics` 字段包含丰富的调试信息：

**本地扫描诊断**：
- `local_scan_directory`：扫描的目录路径
- `local_scan_files_count`：处理的文件数
- `local_scan_skipped_count`：跳过的非标准文件数

**远程探测诊断**：
- `gateway_visible_files_count`：网关可见的文件总数
- `gateway_visible_daily_count`：网关返回的每日记忆文件数
- `gateway_only_returned_root_docs`：网关是否仅返回根文档

Sources: [types.rs](src-tauri/src/gateway/types.rs#L249-L268), [connector.rs](src-tauri/src/gateway/connector.rs#L650-L720)

## 相关文档

- [连接管理：认证与 WebSocket 通信](17-lian-jie-guan-li-ren-zheng-yu-websocket-tong-xin) — 了解网关连接建立过程
- [代理内存操作：文档读写与搜索](18-dai-li-nei-cun-cao-zuo-wen-dang-du-xie-yu-sou-suo) — 探索根文档和语义搜索功能
- [Memory 视图：记忆库与文档管理](10-memory-shi-tu-ji-yi-ku-yu-wen-dang-guan-li) — 前端记忆库界面架构
- [Gateway 模块架构概览](16-gateway-mo-kuai-jia-gou-gai-lan) — 后端模块整体架构