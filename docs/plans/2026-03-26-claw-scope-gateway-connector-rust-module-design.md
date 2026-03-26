# `claw-scope` Gateway Connector Rust 模块设计稿

Date: 2026-03-26
Status: Draft
Target Project: `claw-scope`
Scope: `src-tauri`
Depends On:
- `docs/plans/2026-03-26-openclaw-sdk-api-requirements-analysis.md`
- `docs/plans/2026-03-26-clawx-gateway-auto-connect-mechanism-analysis.md`
- `docs/plans/2026-03-26-openclaw-lan-two-machine-setup-checklist.md`
Version Baseline: OpenClaw Gateway protocol docs checked on 2026-03-26

## 这份设计稿解决什么问题

这份设计稿只回答一个工程问题:

- `claw-scope` 应该如何在 Rust / Tauri 后端实现一个可用、可扩展、能过 OpenClaw Gateway 准入流程的 `Gateway Connector`。

这里的准入流程包括四层:

- `auth`
- `pairing`
- `device identity`
- `connect.challenge` 签名

目标不是一次性设计一个“全功能 OpenClaw SDK”，而是给 `src-tauri` 建一条正确的主干，让前端不再停留在 `localStorage + mock`，并且后续可以平滑扩展到真实的 agent 管理和文件读写。

## 当前项目现状

当前 `claw-scope` 的状态很明确:

- [Cargo.toml](D:/Dev/claw-scope/src-tauri/Cargo.toml) 只有基础 Tauri 依赖
- [lib.rs](D:/Dev/claw-scope/src-tauri/src/lib.rs) 还没有任何 Gateway 协议、状态管理、命令接口
- [OpenClawContext.tsx](D:/Dev/claw-scope/src/app/contexts/OpenClawContext.tsx) 仍然是前端本地状态和 mock 连接逻辑

这意味着:

1. 现在还没有真实的 Gateway WebSocket 客户端
2. 还没有设备身份和 device token 的持久化层
3. 还没有 `pairing` / `challenge` 的状态机
4. 还没有从 Tauri 暴露给前端的真实 `connect` / `status` / `disconnect` commands

所以这份设计稿默认从零开始搭一条主路径。

## 设计原则

### 把敏感能力留在 Tauri 后端

以下内容不应进入 React 前端:

- 私钥
- 设备身份原始材料
- Gateway shared token / password 的明文长期存储
- device token
- challenge 签名逻辑

前端只负责:

- 展示状态
- 接收表单输入
- 调用 Tauri commands
- 展示错误和引导信息

### 先做最小可信链路，再做全功能 RPC

第一阶段的目标不是立刻实现全部 OpenClaw 方法，而是先跑通:

1. 真实连接
2. challenge 应答
3. pairing pending 提示
4. 成功拿到 `hello-ok`
5. 保存 device token
6. 能执行最小读操作，如 `status` 或 `agents.list`

### 先支持 `operator.read`，再升级权限

OpenClaw 的 device token 是按 role + scopes 绑定的。

首版建议默认只请求:

```text
role = operator
scopes = [operator.read]
```

后续当 people 进入配置修改、Agent 管理、pairing 审批时，再按需升级到:

- `operator.write`
- `operator.admin`
- `operator.pairing`
- `operator.approvals`

### 不在首版自创协议实现

协议里最容易踩坑的是设备签名。

OpenClaw 文档明确要求:

- 先收 `connect.challenge`
- 把服务端给的 `nonce` 回写到 `connect.params.device.nonce`
- 当前推荐的签名载荷是 `v3`
- `v3` 绑定 `platform` 和 `deviceFamily`

但文档没有给出足以零歧义复刻的完整 canonical signing 实现细节。对 `claw-scope` 来说，正确策略不是猜，而是:

- 首版明确 vendor 兼容的签名 helper
- 或从上游当前 release 对应实现抽出独立 helper 逻辑

## 模块分层

建议在 `src-tauri/src` 下新增如下结构:

```text
src-tauri/src/
  gateway/
    mod.rs
    types.rs
    errors.rs
    endpoint.rs
    state.rs
    store.rs
    device_identity.rs
    signer.rs
    auth.rs
    protocol.rs
    connector.rs
    commands.rs
    events.rs
  lib.rs
  main.rs
```

下面是每个模块的职责。

## 用 `types.rs` 定义稳定数据模型

职责:

- 定义前后端共享的连接配置、状态、错误摘要、RPC 请求模型
- 尽量与 OpenClaw 协议字段贴近，但不要一开始暴露所有底层细节到前端

建议包含:

```rust
pub enum GatewayAuthMode {
    PairedDevice,
    Token,
    Password,
}

pub struct GatewayConnectConfig {
    pub gateway_url: String,
    pub auth_mode: GatewayAuthMode,
    pub auth_secret: Option<String>,
    pub role: String,
    pub scopes: Vec<String>,
    pub profile_label: Option<String>,
}

pub enum GatewayConnectionPhase {
    Idle,
    ResolvingEndpoint,
    OpeningSocket,
    WaitingForChallenge,
    SendingConnect,
    WaitingForApproval,
    Connected,
    Reconnecting,
    Disconnected,
    Failed,
}

pub struct GatewayStatusSnapshot {
    pub phase: GatewayConnectionPhase,
    pub gateway_origin: Option<String>,
    pub device_id: Option<String>,
    pub granted_role: Option<String>,
    pub granted_scopes: Vec<String>,
    pub last_error: Option<GatewayErrorSummary>,
    pub is_paired: bool,
    pub can_retry_with_device_token: bool,
}
```


补充约定:

- `PairedDevice` 表示“使用本机 device identity + 已签发 device token 连接”，不是匿名访问，也不是协议层意义上的真无认证。
- 首次连接时，即使 UI 选择的是 `PairedDevice`，仍然可能先经历 pairing。只是同机 loopback 场景常常会 auto-approve，所以体验上像“直接连上”。
- `Token` / `Password` 是显式共享管理凭据输入模式。
- 如果后续要支持真正的“无认证”控制面，应单独引入如 `InsecureNoAuth` 之类的高危模式，并放到高级设置，不要复用 `PairedDevice`。
- 若历史代码或本地存储里已有 `none`，应在迁移时把它视为旧名称并映射到 `paired_device`。

### 2026-03-27 当前实现基线补记

截至 2026-03-27，项目内已经按上述约定落地了第一版命名收口和兼容迁移:

- React 前端 `authMode` 已统一为 `paired_device | token | password`
- Rust 后端 `GatewayAuthMode` 已统一为 `PairedDevice | Token | Password`
- Rust 侧通过 serde alias 接受旧值 `"none"`，用于兼容历史配置或旧前端请求

前端本地存储的兼容迁移规则也已经固定:

- 若 `oc_auth_mode = none`，启动时按 `paired_device` 解释
- 若当前模式不是 `token` / `password`，则不恢复 `oc_auth_secret`
- 持久化 effect 会在后续交互中把旧 `none` 回写为 `paired_device`

这条规则的工程意义是:

- 防止历史 `none` 模式遗留 secret 在新语义下继续误参与连接
- 让“已配对设备”模式明确等价于“device identity + device token”，而不是“空 secret 直连”
- 为未来若真的要引入 `InsecureNoAuth` 留出独立枚举位，而不污染 `PairedDevice`

设计目标:

- 前端拿到的是稳定的 `Snapshot`
- 底层协议细节留在 Rust 内部

## 用 `errors.rs` 固定错误分类

职责:

- 把 WebSocket 错误、协议错误、auth 错误、pairing 错误统一映射到可展示错误模型

建议分为:

- `TransportError`
- `ProtocolError`
- `AuthError`
- `PairingError`
- `DeviceAuthError`
- `StorageError`
- `UnsupportedError`

建议保留协议层错误码原文，例如:

- `PAIRING_REQUIRED`
- `AUTH_TOKEN_MISMATCH`
- `DEVICE_AUTH_NONCE_REQUIRED`
- `DEVICE_AUTH_SIGNATURE_INVALID`

前端展示时用 `summary + details_code + retry_hint`，而不是把后端错误字符串直接透出来。

## 用 `endpoint.rs` 统一 URL 解析和 transport 选择

职责:

- 把前端输入的 `http://` / `https://` 地址标准化成 `ws://` / `wss://`
- 对连接目标做最小规范化
- 预留本地附加、直连、SSH forwarded endpoint 的选择空间

建议结构:

```rust
pub enum GatewayTransportKind {
    LocalLoopback,
    Direct,
    SshForwarded,
}

pub struct GatewayEndpoint {
    pub original_input: String,
    pub ws_url: String,
    pub origin_key: String,
    pub transport: GatewayTransportKind,
}
```

首版范围:

- 支持 LocalLoopback
- 支持 Direct
- SSH 只预留接口，不在首版实现

## 用 `state.rs` 管理连接状态机

职责:

- 保存当前连接阶段
- 保存一次连接尝试的临时上下文
- 允许 Tauri commands 查询当前状态

建议把状态拆成两层:

1. 持久状态
   - 已保存配置
   - 已保存 device token
   - 已保存 device identity 摘要

2. 会话状态
   - 当前 phase
   - 当前 socket 是否活着
   - 最近一次 challenge
   - 最近一次 connect 请求 ID
   - 最近错误

建议状态机至少覆盖:

```text
Idle
-> ResolvingEndpoint
-> OpeningSocket
-> WaitingForChallenge
-> SendingConnect
-> WaitingForApproval | Connected | Failed
-> Reconnecting
```

这比当前前端单一的 `isConnected: boolean` 更贴近真实链路。

## 用 `store.rs` 做安全持久化

职责:

- 存储 Gateway profile 级别配置
- 存储设备身份元数据
- 存储 device token
- 允许 token 按 endpoint + device + role + scopes 查找

建议保存键模型:

```text
gateway_origin + device_id + role + normalized_scopes
```

至少要保存:

- `gateway_origin`
- `device_id`
- `device_token`
- `granted_role`
- `granted_scopes`
- `updated_at`

建议实现策略:

- 配置可放 Tauri app config dir
- 私钥和 shared secret 优先走 OS keychain
- 如果首版来不及接 keyring，至少把存储边界抽象出来，不要写死在普通 JSON 文件里

## 用 `device_identity.rs` 管理设备身份

职责:

- 首次生成 keypair
- 加载已有 keypair
- 提供 `device.id`、`publicKey`
- 暴露安全摘要给上层

建议接口:

```rust
pub struct DeviceIdentity {
    pub device_id: String,
    pub public_key_b64: String,
    // private key not exposed publicly
}

pub trait DeviceIdentityProvider {
    fn load_or_create(&self) -> Result<DeviceIdentityHandle, GatewayError>;
}
```

重要约束:

- 同一台 `claw-scope` 安装实例应该稳定复用一个 device identity
- 不能每次启动都重建 keypair
- 否则会反复触发 pairing

## 用 `signer.rs` 单独封装 challenge 签名

职责:

- 接收 `connect.challenge` 的 `nonce`
- 生成与 OpenClaw release 兼容的签名 payload
- 用设备私钥产生签名

建议接口:

```rust
pub struct ConnectChallenge {
    pub nonce: String,
    pub ts_ms: i64,
}

pub struct SignedDeviceProof {
    pub device_id: String,
    pub public_key_b64: String,
    pub signature_b64: String,
    pub signed_at_ms: i64,
    pub nonce: String,
}
```

工程建议:

- 这里不要散落到 `connector.rs` 里
- 单独模块化，便于以后对齐上游签名版本
- 在模块头部写清楚“此实现必须与 OpenClaw 当前 release 协议兼容”

## 用 `auth.rs` 生成 connect 所需的 auth 对象

职责:

- 根据前端输入的 `token` / `password`
- 以及已保存的 `deviceToken`
- 生成 connect 时的 auth 部分

建议首版策略:

1. 首次连接优先使用 people 输入的 shared token / password
2. 成功后保存 `deviceToken`
3. 后续重连先尝试 shared auth
4. 若服务端明确返回 `canRetryWithDeviceToken=true`，允许一次有界的 device token fallback retry

这样做的原因:

- 协议文档已经说明这条 retry 路径存在
- 但 auth 细节不适合在首版过度做复杂分支

## 用 `protocol.rs` 管理协议帧和解析

职责:

- 定义 WS message envelope
- 解析 `event` / `req` / `res` / `error`
- 生成 `connect` 请求
- 统一处理 `hello-ok`

建议明确支持的首批事件:

- `connect.challenge`
- `hello-ok`
- 协议层错误响应

建议不要在这里混入业务方法，如 `agents.list` 具体调用逻辑。这个模块只负责“连上网关并过握手”。

## 用 `connector.rs` 实现主连接器

这是核心模块。

职责:

- 协调 endpoint、store、device identity、signer、protocol
- 建立 WebSocket
- 跑通 challenge -> connect -> hello-ok
- 更新状态机
- 对外暴露 `connect` / `disconnect` / `send_rpc` / `status` 能力

建议结构:

```rust
pub struct GatewayConnector {
    state: Arc<RwLock<GatewayRuntimeState>>,
    store: Arc<dyn GatewayStore>,
    identity_provider: Arc<dyn DeviceIdentityProvider>,
    signer: Arc<dyn DeviceSigner>,
}
```

建议最小公开方法:

```rust
impl GatewayConnector {
    pub async fn connect(&self, config: GatewayConnectConfig) -> Result<GatewayStatusSnapshot, GatewayError>;
    pub async fn disconnect(&self) -> Result<(), GatewayError>;
    pub async fn status(&self) -> GatewayStatusSnapshot;
    pub async fn send_rpc(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, GatewayError>;
}
```

其中 `send_rpc` 首版只允许在 `Connected` 状态调用。

## 用 `commands.rs` 暴露 Tauri API

这是前端唯一应该接触的入口。

建议首版 commands:

```rust
#[tauri::command]
async fn gateway_connect(config: GatewayConnectConfig) -> Result<GatewayStatusSnapshot, GatewayErrorSummary>

#[tauri::command]
async fn gateway_disconnect() -> Result<(), GatewayErrorSummary>

#[tauri::command]
async fn gateway_status() -> Result<GatewayStatusSnapshot, GatewayErrorSummary>

#[tauri::command]
async fn gateway_test_connection(config: GatewayConnectConfig) -> Result<GatewayStatusSnapshot, GatewayErrorSummary>

#[tauri::command]
async fn gateway_call(method: String, params: serde_json::Value) -> Result<serde_json::Value, GatewayErrorSummary>
```

建议首版额外暴露一个只读命令:

```rust
#[tauri::command]
async fn gateway_device_summary() -> Result<DeviceSummaryView, GatewayErrorSummary>
```

用来让前端展示:

- 当前 `device_id`
- 是否已配对
- 当前 role / scopes

## 用 `events.rs` 向前端推送状态变化

职责:

- 把 Rust 状态机变化广播成 Tauri events
- 让前端不用轮询 `gateway_status()` 才能看到阶段变化

建议事件名:

- `gateway://phase-changed`
- `gateway://error`
- `gateway://connected`
- `gateway://pairing-required`
- `gateway://approval-pending`

这样前端就可以把 Setup Wizard 和 Config 页从“点击测试后假成功”改成真实阶段提示。

## 建议的首版依赖

在 [Cargo.toml](D:/Dev/claw-scope/src-tauri/Cargo.toml) 里建议新增:

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
futures-util = "0.3"
tokio-tungstenite = { version = "0.24", features = ["rustls-tls-native-roots"] }
thiserror = "1"
base64 = "0.22"
url = "2"
chrono = { version = "0.4", features = ["serde"] }
ed25519-dalek = "2"
rand = "0.8"
keyring = "3"
once_cell = "1"
```

说明:

- 版本号可以在实际实现时再按当前生态微调
- 这里的重点是依赖类别，而不是锁死某个 patch 版本

## 首版连接流程

建议首版严格按这条路径实现。

### 1. 前端提交连接配置

前端通过 `gateway_connect` 传入:

- `gatewayUrl`
- `authMode`
- `authSecret`
- `role = operator`
- `scopes = [operator.read]`

### 2. `endpoint.rs` 规范化地址

例如:

- `http://127.0.0.1:18789` -> `ws://127.0.0.1:18789`
- `https://host:18789` -> `wss://host:18789`

### 3. `device_identity.rs` 加载或生成设备身份

如果没有现成 keypair:

- 生成 keypair
- 保存私钥
- 派生 `device.id`

### 4. 打开 WebSocket

进入 `OpeningSocket`。

### 5. 等待 `connect.challenge`

进入 `WaitingForChallenge`。

### 6. `signer.rs` 生成 `SignedDeviceProof`

使用服务端下发的 `nonce`。

### 7. `protocol.rs` 发送 `connect`

带上:

- `auth`
- `role`
- `scopes`
- `device`

进入 `SendingConnect`。

### 8. 处理结果

如果成功:

- 进入 `Connected`
- 保存 `deviceToken`
- 保存 granted role/scopes

如果返回 pairing 相关错误:

- 进入 `WaitingForApproval`
- 前端展示 CLI 批准指引

如果 auth 失败:

- 进入 `Failed`
- 返回明确错误码和 hint

## 首版前端 UX 映射

当前前端只有 `isConnected` 布尔值，不够用。

建议至少映射这些阶段:

- `idle`
- `opening_socket`
- `waiting_for_challenge`
- `sending_connect`
- `waiting_for_approval`
- `connected`
- `failed`
- `reconnecting`

UI 映射建议:

- Setup Wizard 里的 **Test Connection** 按钮改为真实 `gateway_test_connection`
- Config 页展示 `device_id`、当前 role、当前 scopes、最近错误
- 出现 `PAIRING_REQUIRED` 时，不说“连接失败”，而说“已发起配对，请到 OpenClaw 主机批准设备”

## 首版 pairing 处理策略

首版不要在 `claw-scope` 里实现设备审批管理。

建议策略:

- `claw-scope` 负责发起连接
- 如果碰到 `PAIRING_REQUIRED`
- 前端给出服务端主机上的 CLI 指引，例如:

```bash
openclaw devices list
openclaw devices approve --latest
```

等第二阶段有稳定连接和更高 scopes 后，再做内置审批页。

## 错误展示建议

前端不要直接显示 Rust `Debug` 文本。

建议错误模型:

```rust
pub struct GatewayErrorSummary {
    pub category: String,
    pub code: Option<String>,
    pub message: String,
    pub retryable: bool,
    pub hint: Option<String>,
}
```

示例映射:

- `PAIRING_REQUIRED`
  - message: `设备尚未获批，需在 OpenClaw 主机侧批准配对`
  - retryable: `true`
- `AUTH_TOKEN_MISMATCH`
  - message: `认证信息不匹配`
  - hint: `请检查 token 或 password`
- `DEVICE_AUTH_SIGNATURE_INVALID`
  - message: `设备签名校验失败`
  - hint: `请删除本地设备身份后重新配对`

## 推荐的实施阶段

### Phase 1: 接通主链路

目标:

- 真正连上 Gateway
- 跑通 challenge
- 处理 auth
- 处理 pairing pending
- 成功拿到 `hello-ok`

交付物:

- `gateway_connect`
- `gateway_status`
- `gateway_disconnect`

### Phase 2: 跑通最小 RPC

目标:

- 在已连接状态下调用只读方法

交付物:

- `gateway_call`
- 前端替换 mock `nodes` / `agents` 为真实读取
- 优先实现 `status`、`health`、`agents.list`

### Phase 3: 支持文件和身份页

目标:

- 接入 `agent.identity.get`
- 接入 `agents.files.get` / `set`

交付物:

- Identity 页真实化
- Soul 页真实化
- Workspace Files 页真实化

### Phase 4: 引入更高权限和审批能力

目标:

- 进入 `operator.admin`
- 处理 `operator.pairing` / `operator.approvals`
- 做配置管理和审批管理页

## 不建议的实现

下面这些做法不建议采用:

- 在 React 前端直接创建 Gateway WebSocket
- 把 device private key 存进 `localStorage`
- 每次启动都生成新 device identity
- 一开始就把全部 scope 申请成 `operator.admin`
- 在不知道上游 canonical signing helper 的情况下自创签名实现
- 在 `connector.rs` 里把存储、签名、协议、状态机全部写成一个文件

## 与当前代码的对接建议

第一步最值得改的是 [OpenClawContext.tsx](D:/Dev/claw-scope/src/app/contexts/OpenClawContext.tsx):

- `testConnection()` 不应再只是 `url.startsWith('http')`
- `updateConfig()` 不应再直接把 `isConnected` 设为 `true`
- `nodes` 和 `agents` 不应再来自 mock

建议替换路径:

1. 先保留这个 Context 作为 UI 层 facade
2. 把内部实现切到 Tauri commands
3. 真实连接状态由 `gateway_status` 和 Tauri events 驱动

## 官方依据

- Gateway Protocol:
  - https://docs.openclaw.ai/gateway/protocol
- Troubleshooting:
  - https://docs.openclaw.ai/gateway/troubleshooting
- devices CLI:
  - https://docs.openclaw.ai/cli/devices
- Network:
  - https://docs.openclaw.ai/network
- `clawx` auto-connect analysis:
  - `docs/plans/2026-03-26-clawx-gateway-auto-connect-mechanism-analysis.md`
