use std::net::IpAddr;

use serde::{Deserialize, Serialize};
use url::Url;

use crate::gateway::{
    errors::GatewayError,
    types::GatewayConnectConfig,
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayTransportKind {
    LocalLoopback,
    Direct,
    SshForwarded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayEndpoint {
    pub original_input: String,
    pub ws_url: String,
    pub origin_key: String,
    pub transport: GatewayTransportKind,
}

impl GatewayEndpoint {
    pub fn from_config(config: &GatewayConnectConfig) -> Result<Self, GatewayError> {
        normalize_gateway_endpoint(&config.gateway_url)
    }
}

pub fn normalize_gateway_endpoint(input: &str) -> Result<GatewayEndpoint, GatewayError> {
    let trimmed = input.trim();
    let parsed = Url::parse(trimmed).map_err(|error| GatewayError::InvalidUrl {
        message: error.to_string(),
    })?;

    let ws_scheme = match parsed.scheme() {
        "http" => "ws",
        "https" => "wss",
        "ws" => "ws",
        "wss" => "wss",
        scheme => {
            return Err(GatewayError::UnsupportedScheme {
                scheme: scheme.to_string(),
            })
        }
    };

    let host = parsed.host_str().ok_or(GatewayError::MissingHost)?;
    let port = parsed.port_or_known_default().ok_or(GatewayError::InvalidUrl {
        message: "unable to determine gateway port".to_string(),
    })?;

    let mut ws_url = parsed.clone();
    ws_url.set_scheme(ws_scheme).map_err(|_| GatewayError::UnsupportedScheme {
        scheme: parsed.scheme().to_string(),
    })?;
    ws_url.set_fragment(None);

    let origin_key = format!("{}://{}:{}", ws_scheme, host, port);

    Ok(GatewayEndpoint {
        original_input: trimmed.to_string(),
        ws_url: ws_url.to_string(),
        origin_key,
        transport: classify_transport(host),
    })
}

fn classify_transport(host: &str) -> GatewayTransportKind {
    if host.eq_ignore_ascii_case("localhost") {
        return GatewayTransportKind::LocalLoopback;
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if ip.is_loopback() {
            return GatewayTransportKind::LocalLoopback;
        }
    }

    GatewayTransportKind::Direct
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_http_to_ws() {
        let endpoint = normalize_gateway_endpoint("http://127.0.0.1:18789").expect("normalize endpoint");
        assert_eq!(endpoint.ws_url, "ws://127.0.0.1:18789/");
        assert_eq!(endpoint.origin_key, "ws://127.0.0.1:18789");
        assert_eq!(endpoint.transport, GatewayTransportKind::LocalLoopback);
    }

    #[test]
    fn normalizes_https_to_wss() {
        let endpoint = normalize_gateway_endpoint("https://claw.example.com:443").expect("normalize endpoint");
        assert_eq!(endpoint.ws_url, "wss://claw.example.com:443/");
        assert_eq!(endpoint.transport, GatewayTransportKind::Direct);
    }

    #[test]
    fn rejects_unsupported_scheme() {
        let error = normalize_gateway_endpoint("ftp://127.0.0.1:18789").expect_err("unsupported scheme should fail");
        match error {
            GatewayError::UnsupportedScheme { scheme } => assert_eq!(scheme, "ftp"),
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
