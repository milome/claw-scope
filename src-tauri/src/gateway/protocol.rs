use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROTOCOL_VERSION: u32 = 3;
pub const DEFAULT_CLIENT_ID: &str = "gateway-client";
pub const DEFAULT_CLIENT_MODE: &str = "backend";
pub const DEFAULT_DEVICE_FAMILY: &str = "desktop";
pub const CONNECT_EVENT_CHALLENGE: &str = "connect.challenge";
pub const CONNECT_ERROR_PAIRING_REQUIRED: &str = "PAIRING_REQUIRED";
pub const CONNECT_ERROR_AUTH_TOKEN_MISMATCH: &str = "AUTH_TOKEN_MISMATCH";
pub const CONNECT_ERROR_AUTH_PASSWORD_MISMATCH: &str = "AUTH_PASSWORD_MISMATCH";
pub const CONNECT_ERROR_AUTH_DEVICE_TOKEN_MISMATCH: &str = "AUTH_DEVICE_TOKEN_MISMATCH";
pub const CONNECT_ERROR_AUTH_RATE_LIMITED: &str = "AUTH_RATE_LIMITED";
pub const CONNECT_ERROR_DEVICE_IDENTITY_REQUIRED: &str = "DEVICE_IDENTITY_REQUIRED";
pub const CONNECT_ERROR_DEVICE_AUTH_NONCE_REQUIRED: &str = "DEVICE_AUTH_NONCE_REQUIRED";
pub const CONNECT_ERROR_DEVICE_AUTH_SIGNATURE_INVALID: &str = "DEVICE_AUTH_SIGNATURE_INVALID";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectAuth {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bootstrap_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectDeviceProof {
    pub id: String,
    pub public_key: String,
    pub signature: String,
    pub signed_at: i64,
    pub nonce: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectClientInfo {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    pub version: String,
    pub platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_identifier: Option<String>,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectParams {
    pub min_protocol: u32,
    pub max_protocol: u32,
    pub client: ConnectClientInfo,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub caps: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<serde_json::Map<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_env: Option<String>,
    pub role: String,
    pub scopes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device: Option<ConnectDeviceProof>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<ConnectAuth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RequestFrame<T> {
    #[serde(rename = "type")]
    pub frame_type: &'static str,
    pub id: String,
    pub method: String,
    pub params: T,
}

impl<T> RequestFrame<T> {
    pub fn new(id: String, method: impl Into<String>, params: T) -> Self {
        Self {
            frame_type: "req",
            id,
            method: method.into(),
            params,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseError {
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
    pub retryable: Option<bool>,
    pub retry_after_ms: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResponseFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub id: String,
    pub ok: bool,
    pub payload: Option<Value>,
    pub error: Option<ResponseError>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EventFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub event: String,
    pub payload: Option<Value>,
    pub seq: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloOk {
    pub r#type: String,
    pub protocol: u32,
    pub server: HelloServer,
    pub features: HelloFeatures,
    pub snapshot: Value,
    pub canvas_host_url: Option<String>,
    pub auth: Option<HelloAuth>,
    pub policy: HelloPolicy,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloServer {
    pub version: String,
    pub conn_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HelloFeatures {
    pub methods: Vec<String>,
    pub events: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloAuth {
    pub device_token: String,
    pub role: String,
    pub scopes: Vec<String>,
    pub issued_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloPolicy {
    pub max_payload: u64,
    pub max_buffered_bytes: u64,
    pub tick_interval_ms: u64,
}

#[derive(Debug, Clone)]
pub enum InboundFrame {
    Event(EventFrame),
    Response(ResponseFrame),
    Unknown,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ConnectErrorRecoveryAdvice {
    pub code: Option<String>,
    pub can_retry_with_device_token: bool,
    pub recommended_next_step: Option<String>,
}

pub fn parse_inbound_frame(text: &str) -> Result<InboundFrame, serde_json::Error> {
    let value: Value = serde_json::from_str(text)?;
    let frame_type = value.get("type").and_then(Value::as_str).unwrap_or_default();
    match frame_type {
        "event" => Ok(InboundFrame::Event(serde_json::from_value(value)?)),
        "res" => Ok(InboundFrame::Response(serde_json::from_value(value)?)),
        _ => Ok(InboundFrame::Unknown),
    }
}

pub fn extract_connect_challenge_nonce(payload: Option<&Value>) -> Option<String> {
    payload
        .and_then(|payload| payload.get("nonce"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub fn parse_connect_error_recovery(details: Option<&Value>) -> ConnectErrorRecoveryAdvice {
    let Some(details) = details else {
        return ConnectErrorRecoveryAdvice::default();
    };
    let code = details
        .get("code")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let can_retry_with_device_token = details
        .get("canRetryWithDeviceToken")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let recommended_next_step = details
        .get("recommendedNextStep")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    ConnectErrorRecoveryAdvice {
        code,
        can_retry_with_device_token,
        recommended_next_step,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn connect_request_serializes_with_camel_case_keys() {
        let frame = RequestFrame::new(
            "req-1".to_string(),
            "connect",
            ConnectParams {
                min_protocol: PROTOCOL_VERSION,
                max_protocol: PROTOCOL_VERSION,
                client: ConnectClientInfo {
                    id: DEFAULT_CLIENT_ID.to_string(),
                    display_name: None,
                    version: "0.1.0".to_string(),
                    platform: "windows".to_string(),
                    device_family: Some(DEFAULT_DEVICE_FAMILY.to_string()),
                    model_identifier: None,
                    mode: DEFAULT_CLIENT_MODE.to_string(),
                    instance_id: None,
                },
                caps: Vec::new(),
                commands: None,
                permissions: None,
                path_env: None,
                role: "operator".to_string(),
                scopes: vec!["operator.read".to_string()],
                device: None,
                auth: None,
                locale: None,
                user_agent: None,
            },
        );
        let json = serde_json::to_string(&frame).expect("serialize request frame");
        assert!(json.contains("minProtocol"));
        assert!(json.contains("deviceFamily"));
        assert!(json.contains("\"method\":\"connect\""));
    }

    #[test]
    fn parses_connect_recovery_details() {
        let advice = parse_connect_error_recovery(Some(&json!({
            "code": "AUTH_TOKEN_MISMATCH",
            "canRetryWithDeviceToken": true,
            "recommendedNextStep": "retry_with_device_token"
        })));
        assert_eq!(advice.code.as_deref(), Some("AUTH_TOKEN_MISMATCH"));
        assert!(advice.can_retry_with_device_token);
        assert_eq!(advice.recommended_next_step.as_deref(), Some("retry_with_device_token"));
    }
}
