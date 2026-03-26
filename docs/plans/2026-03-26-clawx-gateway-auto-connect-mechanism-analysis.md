# `clawx` Gateway Auto-Connect 机制分析

Date: 2026-03-26
Status: Draft
Target Project: `claw-scope`
Depends On:
- `docs/plans/2026-03-26-openclaw-sdk-api-requirements-analysis.md`
- `docs/plans/2026-03-26-openclaw-lan-two-machine-setup-checklist.md`
Version Baseline: OpenClaw 官方文档 checked on 2026-03-26

## 这份文档解决什么问题

这份文档聚焦一个问题:

- `clawx` 是如何“自动连接” OpenClaw Gateway 的。

这里的“自动连接”不是单一动作，而是一套策略组合:

- 自动附加本地 Gateway
- 自动管理 launchd 服务
- 自动发现 LAN Gateway
- 自动复用上次保存的 direct endpoint
- 在没有 direct route 时自动回退到 SSH tunnel
- 在连接建立后，继续走 Gateway 的 pairing / device auth / challenge 签名流程

说明:

- 官方文档当前主要使用“OpenClaw macOS app”这个名称
- 这里用 `clawx` 指代同一类 macOS companion / menu bar app 体验

## 结论先行

`clawx` 的“自动连接 OpenClaw Gateway”并不是“扫描到就无条件直连”，而是一个分层决策链:

1. 本地模式下，先附加本机正在运行的 Gateway
2. 如果本地 Gateway 没跑，再通过 `openclaw gateway install` / launchd 方式把它拉起来
3. 如果是远程模式，优先使用 SSH tunnel，把远端 Gateway 映射到本地 loopback
4. 如果是 direct transport，优先复用已经 paired 且可达的 direct endpoint
5. 如果没有保存的 direct endpoint，但在 LAN 上发现 Bonjour beacon，则给用户一个一键选择，并把所选 endpoint 保存下来
6. 非本地连接仍需通过 Gateway pairing / auth / device challenge 这套准入流程

所以最准确的总结是:

- `clawx` 的自动连接是“自动发现 + 自动附加 + 自动复用 + 自动回退”，不是“自动跳过准入控制”。

## 1. 本地模式: 自动附加 + 自动拉起 Gateway

这是 `clawx` 最核心的自动连接体验。

官方 macOS 文档明确说明:

- Local 是默认模式
- app 会先尝试附加到一个已运行的本地 Gateway
- 如果本地没有可达 Gateway，就通过 `openclaw gateway install` 启用 launchd service
- app 不把 Gateway 当作 child process 直接 spawn

这条链路在 `Gateway Lifecycle` 文档里也写得很清楚:

- macOS app 默认通过 launchd 管理 Gateway
- 它首先尝试连接已运行 Gateway
- 如果当前端口上没有可达 Gateway，才启用 launchd service
- 这样可以获得 login 时自启动和 crash 后自动拉起

可以把本地自动连接理解成这条流程:

1. 读取当前 profile、端口、模式
2. 尝试连接本地 Gateway WS，默认是 `ws://127.0.0.1:18789`
3. 如果连接成功，直接附加
4. 如果连接失败，检查并启用 launchd service
5. launchd 启动 Gateway 后，app 再附加上去

对 `claw-scope` 的启发:

- 如果你要做“像 `clawx` 一样开箱即用”的本地模式，不应只做一个 URL 输入框
- 应该优先做“本机附加 → 探测失败 → 引导安装/启动 Gateway service”这条链路

## 2. 远程模式: 默认不是直连，而是 SSH tunnel

官方文档对 Remote mode 的描述非常明确:

- Remote over SSH 是默认远程方案
- macOS app 会打开一个 SSH tunnel
- tunnel 形式是把远端主机上的 `127.0.0.1:18789` 转发到本机的 loopback 端口
- 之后本地 UI 组件继续像连本地 Gateway 一样使用这条 tunnel

`gateway probe --ssh user@host` 文档还特别标注为 “Mac app parity”，说明 CLI 里这条命令本来就是为了复现 macOS app 的远程连接逻辑。

这意味着 `clawx` 的远程自动连接不是:

- 直接去记一个 `wss://remote-host:18789`

而是更接近:

1. 用户配置 SSH target
2. app 自动建立 `ssh -N -L <local>:127.0.0.1:<remote>`
3. 本地控制面继续连 `ws://127.0.0.1:<localPort>`
4. 如果 tunnel 已健康存在，则复用
5. 如果 tunnel 失效，则重建

这也是官方推荐“Remote over SSH”而不是默认 direct remote 的原因:

- 远端 Gateway 可以继续保持 loopback-only 绑定
- 不必为了远程 UI 暴露 LAN/public WS endpoint

对 `claw-scope` 的启发:

- 如果后续要做“远程 OpenClaw 主机”能力，默认 transport 应考虑 SSH tunnel，而不是直接要求用户把 Gateway 暴露出来

## 3. LAN 自动发现: 不是硬自动接管，而是 Bonjour 候选选择

官方 `Discovery and Transports` 文档把 LAN 发现流程讲得很具体:

- Gateway 广播 Bonjour/mDNS beacon
- 客户端是 discovery consumer，而不是 discovery source
- 推荐的 client policy 是:
  1. 如果 paired direct endpoint 已配置且可达，直接用它
  2. 否则，如果 Bonjour 在 LAN 上发现 gateway，提供一个一键 “Use this gateway” 选择，并把它保存成 direct endpoint
  3. 否则，如果配置了 tailnet DNS/IP，就试 direct
  4. 否则，回退到 SSH

这里有两个关键信息:

### 第一，Bonjour 发现不是“发现即接管”

官方措辞是 “offer a one-tap choice and save it as the direct endpoint”，不是“scan 到就自动连”。

也就是说，LAN discovery 更像:

- 自动发现候选
- 首次连接需要一次用户确认
- 一旦确认，就进入“已保存 endpoint 自动复用”阶段

### 第二，自动连接真正稳定的前提是“保存 endpoint”

一旦 direct endpoint 已保存，后续自动连接优先走它，而不是每次重新浏览 LAN。

对 `claw-scope` 的启发:

- 如果后续你做 LAN 自动发现，最合理的 UX 不是“无感扫描后直接替换当前连接”
- 而是“发现候选 → 用户点一次采用 → 记住这个 endpoint → 以后自动重连它”

## 4. 准入控制: 自动连接不等于绕过 pairing / auth

这是最容易误解的一点。

官方 `Network` 和 `Gateway protocol` 文档都明确说明:

- 所有 WS client 都要经过 Gateway 的准入控制
- 新 device id 默认需要 pairing approval
- local connects 可以 auto-approve，以保证 same-host UX
- non-local LAN / tailnet connects 仍然需要 explicit approval
- non-local connects 还要签 `connect.challenge` nonce
- Gateway auth 仍然适用于所有连接


这里还有两个容易混淆的边界，值得单独写清楚。

- 本地 `localhost / 127.0.0.1` 直连之所以常常“看起来像不用配对”，本质上通常不是匿名访问，而是 **local same-host path 可能 auto-approve pairing**。后续重连再复用已签发的 device token，所以体验上像“直接连上”。
- 这不等于协议层真的存在一个默认的“真无认证”控制面入口。默认设计仍然是 device identity + pairing + device token。
- 官方文档里提到的可省略 device auth 的路径，属于 `gateway.controlUi.allowInsecureAuth=true` 或 `gateway.controlUi.dangerouslyDisableDeviceAuth=true` 这类 **不安全特例**。它不是默认 Gateway 准入模型，也不应作为 `claw-scope` 的常规连接模式。

因此，对 `claw-scope` 更准确的术语应该是：

- `已配对设备` = 使用本机 device identity + 已签发 device token
- `Token认证 / Password认证` = 显式输入共享管理凭据
- 如果未来要支持真正的“无认证”，应单独建一个显式的 `insecure_no_auth` 高危模式，而不是复用 `none`

### 2026-03-27 实施落地补记

截至 2026-03-27，`claw-scope` 已把前后端内部字段基线统一为:

- 前端 `authMode`: `paired_device | token | password`
- Rust `GatewayAuthMode`: `PairedDevice | Token | Password`

同时保留了对旧名称 `none` 的兼容迁移:

- 前端读取 `localStorage.oc_auth_mode = none` 时，会在运行时视为 `paired_device`
- Rust 反序列化历史 `authMode = "none"` 时，会映射到 `GatewayAuthMode::PairedDevice`

本次落地还补了一条很关键的存储规则:

- 只有 `token` / `password` 模式会恢复并保留 `oc_auth_secret`
- `paired_device` 模式启动时会主动忽略旧 `oc_auth_secret`
- 这样可以避免历史上 `none` 模式残留的 secret 被误当成当前有效凭据继续参与连接

因此，当前项目里 `paired_device` 的含义已经固定为:

- 使用本机 device identity + 已签发 device token
- 不是匿名访问
- 不是默认无认证
- 也不应继续用旧 `none` 术语描述

所以 `clawx` 的“自动连接”实际上只负责:

- 发现传输路径
- 建立底层 transport
- 复用或重连 transport

但是否准入成功，仍然由 Gateway 决定。

更准确地说，自动连接和准入控制是两层不同的事情:

- 传输层自动: attach / discover / tunnel / reuse endpoint
- 安全层受控: auth / pairing / device token / challenge signature

对 `claw-scope` 的启发:

- 不要把“自动发现 Gateway”设计成“自动信任 Gateway”
- 不要把“已保存 endpoint”设计成“永远不再配对”
- 更合理的是“保存 transport endpoint + 保存配对后的 device identity / token”

## 5. `clawx` 自带的调试入口说明了真实连接逻辑

官方 macOS 文档专门给了两个 debug CLI:

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

文档原意很明确:

- 用这两个命令可以 exercise 和 macOS app 相同的 Gateway WebSocket handshake 与 discovery logic
- 可用于不启动 app 的情况下做连接和发现调试

这意味着 `clawx` 的连接逻辑至少包含这两个明确模块:

- `discover`
- `connect`

而文档还特别点名:

- macOS app discovery pipeline 使用 `NWBrowser + tailnet DNS-SD fallback`
- Node CLI 的 `gateway discover` 走的是 `dns-sd` 路线

这是一个重要边界:

- `clawx` 的发现实现不是简单 shell out 到 `openclaw gateway discover`
- 它有自己偏原生的发现管线
- 但总体 transport selection policy 与 Gateway 文档是一致的

## 6. 从官方文档可还原的自动连接状态机

基于官方文档，可以把 `clawx` 的自动连接近似还原成下面的状态机。

### 本地模式

1. 读取配置，确认 mode = local
2. 尝试附加本地 Gateway
3. 成功则进入 connected
4. 失败则启用 launchd service
5. 轮询或等待 Gateway 就绪
6. 附加成功后进入 connected

### 远程模式

1. 读取配置，确认 mode = remote
2. 若 transport = SSH，则检查 tunnel 是否健康
3. tunnel 不健康则重建
4. 通过本地 loopback 连接 tunnel 终点
5. 进入 connect handshake
6. 通过 auth / pairing / device token 后进入 connected

### Direct transport

1. 优先检查已保存 direct endpoint 是否可达
2. 可达则直接 connect
3. 不可达则进入 discovery / manual fallback
4. 若 Bonjour 发现候选，由用户选一个保存成 direct endpoint
5. 再 connect
6. 通过 auth / pairing 后进入 connected

## 7. 对 `claw-scope` 的直接启发

如果 `claw-scope` 要借鉴 `clawx` 的自动连接机制，最值得抄的不是 UI，而是这四个设计原则。

### 1. 先区分 transport 和 admission

不要把“地址可达”和“授权成功”混为一谈。

推荐拆成两步:

- Transport resolution
- Gateway admission

### 2. 默认优先级应有明确顺序

推荐直接沿用官方 transport policy:

1. 已保存且可达的 direct endpoint
2. LAN Bonjour 发现结果
3. tailnet direct endpoint
4. SSH fallback

### 3. 首次发现不应静默替换当前连接

对于 LAN 候选，推荐做法不是无提示自动切换，而是:

- 显示发现结果
- 让用户选择一次
- 保存为 direct endpoint
- 后续自动重连该 endpoint

### 4. 本地模式应先“附加”，不是先“启动”

这能避免和用户手动运行的 Gateway 打架，也更符合 OpenClaw 官方体验。

## 8. 对 `claw-scope` 的建议实现分层

推荐把自动连接拆成四层:

### Layer 1: Endpoint Resolver

职责:

- 决定当前要连哪个 transport endpoint
- 实现优先级选择
- 产出最终候选:
  - local loopback
  - saved direct endpoint
  - LAN discovered endpoint
  - SSH forwarded endpoint

### Layer 2: Transport Manager

职责:

- 建立 / 复用 / 重建 transport
- 如果是 SSH，负责 tunnel 生命周期
- 如果是 direct，负责 reachability probe

### Layer 3: Gateway Connector

职责:

- 发起 WebSocket connect
- 处理 `connect.challenge`
- 携带 device identity
- 处理 device token / auth

### Layer 4: UX Coordinator

职责:

- 首次 LAN 发现时显示“Use this gateway”
- pairing pending 时引导用户去批准
- 连接失败时区分是 transport 问题还是 admission 问题

这套分层比“单个 connect() 函数包办所有逻辑”更接近官方真实模型。

## 9. 最终判断

如果一句话总结 `clawx` 如何自动连接 OpenClaw Gateway，可以写成:

- 本地场景下，它先附加现有 Gateway，必要时再通过 launchd 拉起 Gateway。
- 远程场景下，它默认走 SSH tunnel，把远端 Gateway 映射成本地 loopback。
- LAN 场景下，它通过 Bonjour 发现候选 Gateway，但通常由用户确认一次后保存 direct endpoint。
- 已保存的 direct endpoint 之后会被优先自动复用。
- 不论哪种 transport，最终都还要经过 Gateway 的 auth、pairing、device identity、challenge 签名流程。

## 官方依据

- macOS App:
  - https://docs.openclaw.ai/macos
- Gateway Lifecycle on macOS:
  - https://docs.openclaw.ai/platforms/mac/child-process
- Remote Control:
  - https://docs.openclaw.ai/platforms/mac/remote
- Discovery and Transports:
  - https://docs.openclaw.ai/gateway/discovery
- Gateway CLI (`probe --ssh`, discover):
  - https://docs.openclaw.ai/cli/gateway
- Remote Access:
  - https://docs.openclaw.ai/gateway/remote
- Network:
  - https://docs.openclaw.ai/network
- Gateway Protocol:
  - https://docs.openclaw.ai/gateway/protocol
- Nodes:
  - https://docs.openclaw.ai/nodes
