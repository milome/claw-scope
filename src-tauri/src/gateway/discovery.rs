use std::{
    collections::BTreeSet,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    process::Command,
    time::Duration,
};

use chrono::Utc;
use futures_util::stream::{self, StreamExt};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::TcpStream,
    time::timeout,
};
use tokio_tungstenite::{client_async, tungstenite::Message, WebSocketStream};
use url::Url;

use crate::gateway::{
    errors::GatewayError,
    protocol::{parse_inbound_frame, InboundFrame, CONNECT_EVENT_CHALLENGE},
    types::{
        GatewayDiscoveredCandidate, GatewayDiscoveryConfidence, GatewayDiscoveryProbeStage,
        GatewayDiscoverySource,
    },
};

const DEFAULT_GATEWAY_PORT: u16 = 18789;
const DEFAULT_DISCOVERY_TIMEOUT_MS: u64 = 2_400;
const MIN_CONNECT_TIMEOUT_MS: u64 = 120;
const MAX_CONNECT_TIMEOUT_MS: u64 = 320;
const MIN_PROTOCOL_TIMEOUT_MS: u64 = 400;
const MAX_PROTOCOL_TIMEOUT_MS: u64 = 1_200;
const MAX_DISCOVERY_SUBNETS: usize = 4;
const MAX_CONCURRENT_PROBES: usize = 64;

pub async fn discover_lan_candidates(
    seed_url: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<Vec<GatewayDiscoveredCandidate>, GatewayError> {
    let seed_ip = seed_url.and_then(extract_seed_ipv4);
    let scan_subnets = discover_local_ipv4_candidates(seed_url);
    if scan_subnets.is_empty() {
        return Ok(Vec::new());
    }

    let total_timeout_ms = timeout_ms.unwrap_or(DEFAULT_DISCOVERY_TIMEOUT_MS);
    let connect_timeout = Duration::from_millis(
        (total_timeout_ms / 8).clamp(MIN_CONNECT_TIMEOUT_MS, MAX_CONNECT_TIMEOUT_MS),
    );
    let protocol_timeout = Duration::from_millis(
        (total_timeout_ms / 2).clamp(MIN_PROTOCOL_TIMEOUT_MS, MAX_PROTOCOL_TIMEOUT_MS),
    );
    let mut seen_targets = BTreeSet::new();
    let mut targets = Vec::new();

    for host in explicit_probe_hosts() {
        if seen_targets.insert(host) {
            targets.push(host);
        }
    }

    for subnet_ip in scan_subnets {
        let octets = subnet_ip.octets();
        for host_octet in 1_u8..=254_u8 {
            if seed_ip != Some(subnet_ip) && host_octet == octets[3] {
                continue;
            }
            let host = Ipv4Addr::new(octets[0], octets[1], octets[2], host_octet);
            if seen_targets.insert(host) {
                targets.push(host);
            }
        }
    }

    let mut candidates = Vec::new();
    let mut futures = stream::iter(targets.into_iter().map(|host| async move {
        probe_host(
            host,
            DEFAULT_GATEWAY_PORT,
            connect_timeout,
            protocol_timeout,
            seed_ip,
        )
        .await
    }))
    .buffer_unordered(MAX_CONCURRENT_PROBES);

    while let Some(candidate) = futures.next().await {
        if let Some(candidate) = candidate {
            candidates.push(candidate);
        }
    }

    candidates.sort_by(|left, right| {
        right
            .confidence_score
            .cmp(&left.confidence_score)
            .then_with(|| right.matched_seed_host.cmp(&left.matched_seed_host))
            .then_with(|| right.matched_seed_subnet.cmp(&left.matched_seed_subnet))
            .then_with(|| left.host.cmp(&right.host))
    });
    candidates.dedup_by(|left, right| left.ws_url == right.ws_url);
    Ok(candidates)
}

fn explicit_probe_hosts() -> Vec<Ipv4Addr> {
    vec![Ipv4Addr::LOCALHOST]
}

fn discover_local_ipv4_candidates(seed_url: Option<&str>) -> Vec<Ipv4Addr> {
    let seed_ip = seed_url.and_then(extract_seed_ipv4);
    let mut interface_ips = if cfg!(windows) {
        discover_windows_ipv4_candidates()
    } else {
        Vec::new()
    };
    if let Some(primary_ip) = infer_primary_ipv4() {
        interface_ips.push(primary_ip);
    }

    merge_ipv4_candidates(seed_ip, interface_ips)
}

fn merge_ipv4_candidates(seed_ip: Option<Ipv4Addr>, interface_ips: Vec<Ipv4Addr>) -> Vec<Ipv4Addr> {
    let mut seen_ips = BTreeSet::new();
    let mut seen_subnets = BTreeSet::new();
    let mut merged = Vec::new();

    for ipv4 in seed_ip.into_iter().chain(interface_ips.into_iter()) {
        if !ipv4.is_private() || ipv4.is_loopback() {
            continue;
        }
        if !seen_ips.insert(ipv4) {
            continue;
        }

        let subnet = subnet_key(ipv4);
        if seen_subnets.insert(subnet) {
            merged.push(ipv4);
        }
    }

    if merged.len() > MAX_DISCOVERY_SUBNETS {
        merged.truncate(MAX_DISCOVERY_SUBNETS);
    }
    merged
}

fn extract_seed_ipv4(seed_url: &str) -> Option<Ipv4Addr> {
    let parsed = Url::parse(seed_url.trim()).ok()?;
    match parsed.host()? {
        url::Host::Ipv4(ipv4) if ipv4.is_private() && !ipv4.is_loopback() => Some(ipv4),
        _ => None,
    }
}

fn infer_primary_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("1.1.1.1:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ipv4) if !ipv4.is_loopback() => Some(ipv4),
        _ => None,
    }
}

fn discover_windows_ipv4_candidates() -> Vec<Ipv4Addr> {
    let output = Command::new("ipconfig").output().ok();
    let stdout = output
        .as_ref()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).into_owned());
    stdout
        .map(|text| parse_ipconfig_ipv4_candidates(text.as_str()))
        .unwrap_or_default()
}

#[derive(Default)]
struct ParsedWindowsAdapter {
    name: String,
    disconnected: bool,
    has_default_gateway: bool,
    ipv4s: Vec<Ipv4Addr>,
}

fn parse_ipconfig_ipv4_candidates(text: &str) -> Vec<Ipv4Addr> {
    let mut adapters = Vec::new();
    let mut current = ParsedWindowsAdapter::default();
    let mut awaiting_gateway_continuation = false;

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !current.name.is_empty() {
                adapters.push(current);
            }
            current = ParsedWindowsAdapter::default();
            awaiting_gateway_continuation = false;
            continue;
        }

        if trimmed.ends_with(':') && !trimmed.contains(". .") {
            if !current.name.is_empty() {
                adapters.push(current);
            }
            current = ParsedWindowsAdapter {
                name: trimmed.trim_end_matches(':').to_string(),
                ..ParsedWindowsAdapter::default()
            };
            awaiting_gateway_continuation = false;
            continue;
        }

        if current.name.is_empty() {
            continue;
        }

        if trimmed.contains("Media disconnected") {
            current.disconnected = true;
        }

        if trimmed.starts_with("Default Gateway") {
            if let Some(ipv4) = extract_ipv4_from_line(trimmed) {
                current.has_default_gateway = true;
                current.ipv4s.push(ipv4);
                awaiting_gateway_continuation = false;
            } else {
                awaiting_gateway_continuation = true;
            }
            continue;
        }

        if awaiting_gateway_continuation
            && extract_ipv4_from_line(trimmed).is_some()
        {
            current.has_default_gateway = true;
            awaiting_gateway_continuation = false;
        }

        if trimmed.contains("IPv4 Address")
            && let Some(ipv4) = extract_ipv4_from_line(trimmed)
        {
            current.ipv4s.push(ipv4);
        }
    }

    if !current.name.is_empty() {
        adapters.push(current);
    }

    adapters
        .into_iter()
        .filter(|adapter| {
            !adapter.disconnected
                && adapter.has_default_gateway
                && !should_ignore_adapter(adapter.name.as_str())
        })
        .flat_map(|adapter| adapter.ipv4s.into_iter())
        .filter(|ipv4| ipv4.is_private() && !ipv4.is_loopback())
        .collect()
}

fn should_ignore_adapter(name: &str) -> bool {
    let normalized = name.to_ascii_lowercase();
    [
        "vethernet",
        "wsl",
        "hyper-v",
        "singbox",
        "tun",
        "virtual",
        "tailscale",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
}

fn extract_ipv4_from_line(line: &str) -> Option<Ipv4Addr> {
    line.split(|char: char| !(char.is_ascii_digit() || char == '.'))
        .find_map(|token| token.parse::<Ipv4Addr>().ok())
}

async fn probe_host(
    host: Ipv4Addr,
    port: u16,
    connect_timeout: Duration,
    protocol_timeout: Duration,
    seed_ip: Option<Ipv4Addr>,
) -> Option<GatewayDiscoveredCandidate> {
    let address = SocketAddr::from((host, port));
    let stream = timeout(connect_timeout, TcpStream::connect(address))
        .await
        .ok()?
        .ok()?;

    let ws_url = format!("ws://{host}:{port}");
    let (mut socket, _) = timeout(connect_timeout, client_async(ws_url.as_str(), stream))
        .await
        .ok()?
        .ok()?;

    let protocol_signal = wait_for_gateway_protocol_signal(&mut socket, protocol_timeout).await?;
    let _ = socket.close(None).await;

    let matched_seed_host = seed_ip == Some(host);
    let matched_seed_subnet = seed_ip
        .map(|seed| subnet_key(seed) == subnet_key(host))
        .unwrap_or(false);
    let confidence_score = score_candidate(matched_seed_subnet, matched_seed_host);

    Some(GatewayDiscoveredCandidate {
        id: format!("lan-{}-{port}", host.to_string().replace('.', "-")),
        label: format!("OpenClaw {}:{port}", host),
        source: GatewayDiscoverySource::LanScan,
        ws_url,
        http_url: Some(format!("http://{host}:{port}")),
        host: host.to_string(),
        port,
        is_paired_hint: None,
        last_seen_at_ms: Utc::now().timestamp_millis(),
        confidence: confidence_from_score(confidence_score),
        confidence_score,
        probe_stage: GatewayDiscoveryProbeStage::ProtocolVerified,
        protocol_verified: true,
        protocol_signal: Some(protocol_signal),
        matched_seed_subnet,
        matched_seed_host,
    })
}

async fn wait_for_gateway_protocol_signal<S>(
    socket: &mut WebSocketStream<S>,
    probe_timeout: Duration,
) -> Option<String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    timeout(probe_timeout, async {
        loop {
            let message = next_probe_text_message(socket).await?;
            match parse_inbound_frame(&message).ok()? {
                InboundFrame::Event(event) if event.event == CONNECT_EVENT_CHALLENGE => {
                    return Some(CONNECT_EVENT_CHALLENGE.to_string());
                }
                InboundFrame::Unknown | InboundFrame::Event(_) | InboundFrame::Response(_) => {
                    continue;
                }
            }
        }
    })
    .await
    .ok()
    .flatten()
}

async fn next_probe_text_message<S>(socket: &mut WebSocketStream<S>) -> Option<String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    loop {
        match socket.next().await {
            Some(Ok(Message::Text(text))) => return Some(text.to_string()),
            Some(Ok(Message::Close(_))) | None => return None,
            Some(Ok(_)) => continue,
            Some(Err(_)) => return None,
        }
    }
}

fn score_candidate(matched_seed_subnet: bool, matched_seed_host: bool) -> u8 {
    let mut score = 82_u8;
    if matched_seed_subnet {
        score = score.saturating_add(10);
    }
    if matched_seed_host {
        score = score.saturating_add(8);
    }
    score
}

fn confidence_from_score(score: u8) -> GatewayDiscoveryConfidence {
    match score {
        90..=u8::MAX => GatewayDiscoveryConfidence::High,
        75..=89 => GatewayDiscoveryConfidence::Medium,
        _ => GatewayDiscoveryConfidence::Low,
    }
}

fn subnet_key(ipv4: Ipv4Addr) -> (u8, u8, u8) {
    let octets = ipv4.octets();
    (octets[0], octets[1], octets[2])
}

#[cfg(test)]
mod tests {
    use super::*;

    use futures_util::SinkExt;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    #[test]
    fn infer_primary_ipv4_returns_optional_value() {
        let _ = infer_primary_ipv4();
    }

    #[test]
    fn merge_ipv4_candidates_keeps_seed_and_other_interfaces() {
        let candidates = merge_ipv4_candidates(
            Some(Ipv4Addr::new(192, 168, 1, 112)),
            vec![
                Ipv4Addr::new(10, 0, 0, 7),
                Ipv4Addr::new(192, 168, 1, 55),
                Ipv4Addr::new(172, 16, 0, 9),
            ],
        );

        assert_eq!(
            candidates,
            vec![
                Ipv4Addr::new(192, 168, 1, 112),
                Ipv4Addr::new(10, 0, 0, 7),
                Ipv4Addr::new(172, 16, 0, 9),
            ]
        );
    }

    #[test]
    fn explicit_probe_hosts_includes_loopback() {
        assert_eq!(explicit_probe_hosts(), vec![Ipv4Addr::LOCALHOST]);
    }

    #[tokio::test]
    async fn probe_host_returns_none_for_unreachable_port() {
        let candidate = probe_host(
            Ipv4Addr::new(127, 0, 0, 1),
            6553,
            Duration::from_millis(20),
            Duration::from_millis(20),
            None,
        )
        .await;
        assert!(candidate.is_none());
    }

    #[tokio::test]
    async fn probe_host_requires_gateway_protocol_challenge() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("bind listener");
        let port = listener.local_addr().expect("listener addr").port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept connection");
            let mut socket = accept_async(stream).await.expect("upgrade websocket");
            socket
                .send(Message::Text(
                    r#"{"type":"event","event":"presence.update","payload":{}}"#
                        .to_string()
                        .into(),
                ))
                .await
                .expect("send non-gateway event");
            let _ = socket.close(None).await;
        });

        let candidate = probe_host(
            Ipv4Addr::LOCALHOST,
            port,
            Duration::from_millis(200),
            Duration::from_millis(300),
            Some(Ipv4Addr::LOCALHOST),
        )
        .await;

        assert!(candidate.is_none());
        server.await.expect("server task");
    }

    #[tokio::test]
    async fn probe_host_returns_verified_candidate_for_gateway_challenge() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("bind listener");
        let port = listener.local_addr().expect("listener addr").port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept connection");
            let mut socket = accept_async(stream).await.expect("upgrade websocket");
            socket
                .send(Message::Text(
                    format!(
                        r#"{{"type":"event","event":"{CONNECT_EVENT_CHALLENGE}","payload":{{"nonce":"abc"}}}}"#
                    )
                    .into(),
                ))
                .await
                .expect("send challenge");
            let _ = socket.close(None).await;
        });

        let candidate = probe_host(
            Ipv4Addr::LOCALHOST,
            port,
            Duration::from_millis(200),
            Duration::from_millis(300),
            Some(Ipv4Addr::LOCALHOST),
        )
        .await
        .expect("verified candidate");

        assert_eq!(candidate.protocol_signal.as_deref(), Some(CONNECT_EVENT_CHALLENGE));
        assert_eq!(candidate.probe_stage, GatewayDiscoveryProbeStage::ProtocolVerified);
        assert!(candidate.protocol_verified);
        assert!(candidate.matched_seed_host);
        assert!(candidate.matched_seed_subnet);
        assert_eq!(candidate.confidence, GatewayDiscoveryConfidence::High);
        assert_eq!(candidate.confidence_score, 100);
        server.await.expect("server task");
    }
}
