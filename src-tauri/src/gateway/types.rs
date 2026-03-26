use serde::{Deserialize, Serialize};

use crate::gateway::errors::GatewayErrorSummary;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAuthMode {
    #[serde(alias = "none")]
    PairedDevice,
    Token,
    Password,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConnectConfig {
    pub gateway_url: String,
    pub auth_mode: GatewayAuthMode,
    pub auth_secret: Option<String>,
    pub role: String,
    pub scopes: Vec<String>,
    pub profile_label: Option<String>,
}

impl Default for GatewayConnectConfig {
    fn default() -> Self {
        Self {
            gateway_url: "http://127.0.0.1:18789".to_string(),
            auth_mode: GatewayAuthMode::PairedDevice,
            auth_secret: None,
            role: "operator".to_string(),
            scopes: vec!["operator.read".to_string()],
            profile_label: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
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

impl GatewayStatusSnapshot {
    pub fn idle() -> Self {
        Self {
            phase: GatewayConnectionPhase::Idle,
            gateway_origin: None,
            device_id: None,
            granted_role: None,
            granted_scopes: Vec::new(),
            last_error: None,
            is_paired: false,
            can_retry_with_device_token: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentIdentitySummary {
    pub name: Option<String>,
    pub theme: Option<String>,
    pub emoji: Option<String>,
    pub avatar: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentSummary {
    pub id: String,
    pub name: Option<String>,
    pub identity: Option<GatewayAgentIdentitySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentsListResult {
    pub default_id: String,
    pub main_key: String,
    pub scope: String,
    pub agents: Vec<GatewayAgentSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn gateway_connect_config_serializes() {
        let json = serde_json::to_string(&GatewayConnectConfig::default()).expect("serialize config");
        assert!(json.contains("gatewayUrl"));
        assert!(json.contains("paired_device"));
        assert!(json.contains("operator.read"));
    }

    #[test]
    fn legacy_none_auth_mode_deserializes_as_paired_device() {
        let config: GatewayConnectConfig = serde_json::from_value(json!({
            "gatewayUrl": "http://127.0.0.1:18789",
            "authMode": "none",
            "authSecret": null,
            "role": "operator",
            "scopes": ["operator.read"],
            "profileLabel": null
        }))
        .expect("deserialize legacy auth mode");

        assert_eq!(config.auth_mode, GatewayAuthMode::PairedDevice);
    }

    #[test]
    fn idle_snapshot_has_idle_phase() {
        let snapshot = GatewayStatusSnapshot::idle();
        assert_eq!(snapshot.phase, GatewayConnectionPhase::Idle);
        assert!(snapshot.gateway_origin.is_none());
        assert!(snapshot.last_error.is_none());
    }

    #[test]
    fn agents_list_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentsListResult = serde_json::from_value(json!({
            "defaultId": "main",
            "mainKey": "global",
            "scope": "global",
            "agents": [
                {
                    "id": "main",
                    "name": "Main",
                    "identity": {
                        "name": "Main",
                        "theme": "default",
                        "emoji": "lobster"
                    }
                }
            ]
        }))
        .expect("deserialize agents list");

        assert_eq!(result.default_id, "main");
        assert_eq!(result.agents.len(), 1);
        assert_eq!(
            result.agents[0]
                .identity
                .as_ref()
                .and_then(|identity| identity.emoji.as_deref()),
            Some("lobster")
        );
    }
}

