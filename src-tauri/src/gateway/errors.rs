use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::gateway::protocol::{
    CONNECT_ERROR_AUTH_DEVICE_TOKEN_MISMATCH,
    CONNECT_ERROR_AUTH_PASSWORD_MISMATCH,
    CONNECT_ERROR_AUTH_RATE_LIMITED,
    CONNECT_ERROR_AUTH_TOKEN_MISMATCH,
    CONNECT_ERROR_DEVICE_AUTH_NONCE_REQUIRED,
    CONNECT_ERROR_DEVICE_AUTH_SIGNATURE_INVALID,
    CONNECT_ERROR_DEVICE_IDENTITY_REQUIRED,
    CONNECT_ERROR_PAIRING_REQUIRED,
};

const CONNECT_ERROR_AUTH_TOKEN_REQUIRED: &str = "AUTH_TOKEN_REQUIRED";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayErrorSummary {
    pub category: String,
    pub code: Option<String>,
    pub message: String,
    pub retryable: bool,
    pub hint: Option<String>,
}

impl GatewayErrorSummary {
    pub fn new(
        category: impl Into<String>,
        code: Option<String>,
        message: impl Into<String>,
        retryable: bool,
        hint: Option<String>,
    ) -> Self {
        Self {
            category: category.into(),
            code,
            message: message.into(),
            retryable,
            hint,
        }
    }

    pub fn from_error(error: &GatewayError) -> Self {
        match error {
            GatewayError::InvalidUrl { message } => Self::new(
                "transport",
                Some("INVALID_URL".to_string()),
                message.clone(),
                false,
                Some("请检查 Gateway 地址格式，例如 http://127.0.0.1:18789".to_string()),
            ),
            GatewayError::UnsupportedScheme { scheme } => Self::new(
                "transport",
                Some("UNSUPPORTED_URL_SCHEME".to_string()),
                format!("不支持的 Gateway 地址协议: {scheme}"),
                false,
                Some("请使用 http://、https://、ws:// 或 wss://".to_string()),
            ),
            GatewayError::MissingHost => Self::new(
                "transport",
                Some("MISSING_HOST".to_string()),
                "Gateway 地址缺少主机名或 IP。",
                false,
                Some("请填写可访问的 OpenClaw Gateway 地址".to_string()),
            ),
            GatewayError::Transport { message } => Self::new(
                "transport",
                Some("SOCKET_ERROR".to_string()),
                message.clone(),
                true,
                Some("请确认 Gateway 已启动，且当前机器到目标地址网络可达。".to_string()),
            ),
            GatewayError::Protocol { message } => Self::new(
                "protocol",
                Some("PROTOCOL_ERROR".to_string()),
                message.clone(),
                false,
                Some("Gateway 返回的消息不符合预期，请检查 OpenClaw 版本兼容性。".to_string()),
            ),
            GatewayError::Storage { message } => Self::new(
                "storage",
                Some("STORAGE_ERROR".to_string()),
                message.clone(),
                false,
                Some("请检查本地配置目录是否可写。".to_string()),
            ),
            GatewayError::DeviceIdentity { message } => Self::new(
                "device_auth",
                Some("DEVICE_IDENTITY_ERROR".to_string()),
                message.clone(),
                false,
                Some("本地设备身份不可用，建议删除损坏的本地 identity 后重试。".to_string()),
            ),
            GatewayError::MissingAuthSecret { mode } => {
                let (code, message, hint) = match *mode {
                    "token" => (
                        "AUTH_TOKEN_REQUIRED",
                        "已选择 Token 认证，请填写 Gateway Token。",
                        "请填写服务端配置的 Gateway Token，或切换回已配对设备模式。",
                    ),
                    "password" => (
                        "AUTH_PASSWORD_REQUIRED",
                        "已选择 Password 认证，请填写访问密码。",
                        "请填写服务端配置的 Gateway Password，或切换回已配对设备模式。",
                    ),
                    _ => (
                        "AUTH_SECRET_REQUIRED",
                        "已选择认证模式，请填写认证凭据。",
                        "请补齐当前认证模式所需的凭据后再重试。",
                    ),
                };

                Self::new(
                    "auth",
                    Some(code.to_string()),
                    message,
                    false,
                    Some(hint.to_string()),
                )
            }
            GatewayError::ConnectRejected {
                code,
                message,
                retryable,
                can_retry_with_device_token,
                recommended_next_step,
                pairing_reason,
            } => {
                let resolved_code = normalize_connect_rejection_code(code.as_deref(), message);
                let resolved_retryable = *retryable
                    || *can_retry_with_device_token
                    || recommended_next_step.as_deref() == Some("wait_then_retry");
                let resolved_message = connect_rejection_message(
                    resolved_code.as_deref(),
                    message,
                    pairing_reason.as_deref(),
                );
                Self::new(
                    connect_rejection_category(resolved_code.as_deref()),
                    resolved_code.clone(),
                    resolved_message,
                    resolved_retryable,
                    connect_rejection_hint(
                        resolved_code.as_deref(),
                        *can_retry_with_device_token,
                        recommended_next_step.as_deref(),
                        pairing_reason.as_deref(),
                    ),
                )
            }
            GatewayError::RequestRejected {
                code,
                message,
                retryable,
            } => {
                let normalized_message = message.to_ascii_lowercase();
                if normalized_message.contains("missing scope: operator.admin") {
                    return Self::new(
                        "auth",
                        Some("MISSING_SCOPE_OPERATOR_ADMIN".to_string()),
                        "当前连接缺少 operator.admin 权限，无法执行写入或管理操作。",
                        *retryable,
                        Some(
                            "请重新连接并申请 operator.admin，或改用具备管理员权限的 Token / Password 认证。"
                                .to_string(),
                        ),
                    );
                }
                if normalized_message.contains("missing scope: operator.write") {
                    return Self::new(
                        "auth",
                        Some("MISSING_SCOPE_OPERATOR_WRITE".to_string()),
                        "当前连接缺少 operator.write 权限，无法执行写入操作。",
                        *retryable,
                        Some("请重新连接并申请 operator.write 或更高权限。".to_string()),
                    );
                }
                if normalized_message.contains("missing scope: operator.read") {
                    return Self::new(
                        "auth",
                        Some("MISSING_SCOPE_OPERATOR_READ".to_string()),
                        "当前连接缺少 operator.read 权限，无法读取目标数据。",
                        *retryable,
                        Some("请重新连接并申请 operator.read 或更高权限。".to_string()),
                    );
                }

                Self::new(
                    request_rejection_category(code.as_deref()),
                    code.clone(),
                    message.clone(),
                    *retryable,
                    Some("Gateway RPC 请求被拒绝，请检查当前 role/scopes 与目标方法是否匹配。".to_string()),
                )
            }
            GatewayError::NotImplemented { feature } => Self::new(
                "unsupported",
                Some("NOT_IMPLEMENTED".to_string()),
                format!("当前版本尚未实现: {feature}"),
                false,
                None,
            ),
        }
    }
}

#[derive(Debug, Clone, Error)]
pub enum GatewayError {
    #[error("invalid gateway url: {message}")]
    InvalidUrl { message: String },
    #[error("unsupported gateway url scheme: {scheme}")]
    UnsupportedScheme { scheme: String },
    #[error("gateway url is missing host")]
    MissingHost,
    #[error("gateway transport error: {message}")]
    Transport { message: String },
    #[error("gateway protocol error: {message}")]
    Protocol { message: String },
    #[error("gateway storage error: {message}")]
    Storage { message: String },
    #[error("gateway device identity error: {message}")]
    DeviceIdentity { message: String },
    #[error("gateway auth secret is required for {mode}")]
    MissingAuthSecret { mode: &'static str },
    #[error("gateway connect rejected: {message}")]
    ConnectRejected {
        code: Option<String>,
        message: String,
        retryable: bool,
        can_retry_with_device_token: bool,
        recommended_next_step: Option<String>,
        pairing_reason: Option<String>,
    },
    #[error("gateway request rejected: {message}")]
    RequestRejected {
        code: Option<String>,
        message: String,
        retryable: bool,
    },
    #[error("not implemented: {feature}")]
    NotImplemented { feature: String },
}

impl GatewayError {
    pub fn connect_error_code(&self) -> Option<String> {
        match self {
            Self::ConnectRejected { code, message, .. } => {
                normalize_connect_rejection_code(code.as_deref(), message)
            }
            _ => None,
        }
    }

    pub fn can_retry_with_device_token(&self) -> bool {
        match self {
            Self::ConnectRejected {
                can_retry_with_device_token,
                ..
            } => *can_retry_with_device_token,
            _ => false,
        }
    }

    pub fn recommended_next_step(&self) -> Option<&str> {
        match self {
            Self::ConnectRejected {
                recommended_next_step,
                ..
            } => recommended_next_step.as_deref(),
            _ => None,
        }
    }
}

fn normalize_connect_rejection_code(code: Option<&str>, message: &str) -> Option<String> {
    if let Some(code) = code {
        return Some(code.to_string());
    }

    let normalized_message = message.to_ascii_lowercase();
    if normalized_message.contains("pairing required") {
        return Some(CONNECT_ERROR_PAIRING_REQUIRED.to_string());
    }
    if normalized_message.contains("gateway token mismatch") {
        return Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH.to_string());
    }
    if normalized_message.contains("gateway token missing")
        || normalized_message.contains("token missing")
    {
        return Some(CONNECT_ERROR_AUTH_TOKEN_REQUIRED.to_string());
    }
    if normalized_message.contains("gateway password mismatch") {
        return Some(CONNECT_ERROR_AUTH_PASSWORD_MISMATCH.to_string());
    }
    if normalized_message.contains("device token mismatch") {
        return Some(CONNECT_ERROR_AUTH_DEVICE_TOKEN_MISMATCH.to_string());
    }

    None
}

fn connect_rejection_category(code: Option<&str>) -> &'static str {
    match code {
        Some(CONNECT_ERROR_PAIRING_REQUIRED) => "pairing",
        Some(CONNECT_ERROR_DEVICE_IDENTITY_REQUIRED)
        | Some(CONNECT_ERROR_DEVICE_AUTH_NONCE_REQUIRED)
        | Some(CONNECT_ERROR_DEVICE_AUTH_SIGNATURE_INVALID) => "device_auth",
        Some(code) if code.starts_with("AUTH_") => "auth",
        Some(code) if code.starts_with("DEVICE_AUTH_") => "device_auth",
        _ => "protocol",
    }
}

fn request_rejection_category(code: Option<&str>) -> &'static str {
    match code {
        Some(code) if code.starts_with("AUTH_") => "auth",
        Some(code) if code.starts_with("DEVICE_AUTH_") => "device_auth",
        _ => "protocol",
    }
}

fn connect_rejection_message(code: Option<&str>, message: &str, pairing_reason: Option<&str>) -> String {
    match code {
        Some(CONNECT_ERROR_PAIRING_REQUIRED) => match pairing_reason {
            Some("scope-upgrade") => {
                "该设备已配对，但当前申请权限高于已批准权限，需要服务端重新批准。".to_string()
            }
            Some("role-upgrade") => {
                "该设备已配对，但当前申请的角色高于已批准角色，需要服务端重新批准。".to_string()
            }
            Some("metadata-upgrade") => {
                "该设备已配对，但设备身份信息发生变化，需要服务端重新批准。".to_string()
            }
            Some("not-paired") => "当前设备尚未完成配对，需要先在服务端批准当前设备。".to_string(),
            _ => "当前连接需要先完成设备配对批准。".to_string(),
        },
        Some(CONNECT_ERROR_AUTH_TOKEN_REQUIRED) => {
            "当前连接缺少 Gateway Token，无法完成首次配对或重配。".to_string()
        }
        _ => message.to_string(),
    }
}

fn connect_rejection_hint(
    code: Option<&str>,
    can_retry_with_device_token: bool,
    recommended_next_step: Option<&str>,
    pairing_reason: Option<&str>,
) -> Option<String> {
    match code {
        Some(CONNECT_ERROR_PAIRING_REQUIRED) => match pairing_reason {
            Some("scope-upgrade") => Some(
                "请到 OpenClaw 主机执行 `openclaw devices approve --latest`，批准新的权限申请后再重试。"
                    .to_string(),
            ),
            Some("role-upgrade") => Some(
                "请到 OpenClaw 主机执行 `openclaw devices approve --latest`，批准新的角色申请后再重试。"
                    .to_string(),
            ),
            Some("metadata-upgrade") => Some(
                "请到 OpenClaw 主机执行 `openclaw devices approve --latest`，确认新的设备身份信息后再重试。"
                    .to_string(),
            ),
            Some("not-paired") => Some(
                "请到 OpenClaw 主机执行 `openclaw devices approve --latest` 完成首次配对。"
                    .to_string(),
            ),
            _ => Some("请到 OpenClaw 主机批准当前设备，然后重新连接。".to_string()),
        },
        Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH) if can_retry_with_device_token => Some(
            "共享 token 未通过校验，但服务端允许改用已签发的 device token。".to_string(),
        ),
        Some(CONNECT_ERROR_AUTH_TOKEN_REQUIRED) => Some(
            "当前是首次配对或重配，请在“已配对设备”模式下填写 Gateway Token 作为首次配对凭据。配对成功后会自动切换为 device token。".to_string(),
        ),
        Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH) => {
            Some("请检查 Gateway token 是否与 OpenClaw 当前配置一致。".to_string())
        }
        Some(CONNECT_ERROR_AUTH_PASSWORD_MISMATCH) => {
            Some("请检查 Gateway password 是否与 OpenClaw 当前配置一致。".to_string())
        }
        Some(CONNECT_ERROR_AUTH_DEVICE_TOKEN_MISMATCH) => {
            Some("本地缓存的 device token 可能已失效，建议清除后重新配对。".to_string())
        }
        Some(CONNECT_ERROR_AUTH_RATE_LIMITED) => {
            Some("认证尝试过于频繁，请稍后再试。".to_string())
        }
        Some(CONNECT_ERROR_DEVICE_IDENTITY_REQUIRED) => Some(
            "当前连接要求提供 device identity，请确认桌面端已生成并保留本地设备身份。"
                .to_string(),
        ),
        Some(CONNECT_ERROR_DEVICE_AUTH_NONCE_REQUIRED) => {
            Some("Gateway 未提供有效的 challenge nonce。".to_string())
        }
        Some(CONNECT_ERROR_DEVICE_AUTH_SIGNATURE_INVALID) => Some(
            "设备签名校验失败，建议删除本地 device identity 后重新连接。".to_string(),
        ),
        _ => match recommended_next_step {
            Some("retry_with_device_token") => {
                Some("建议下一次连接时改用已签发的 device token。".to_string())
            }
            Some("update_auth_configuration") => {
                Some("请先补齐 Gateway 认证配置，再重新连接。".to_string())
            }
            Some("update_auth_credentials") => {
                Some("请更新认证凭据后重新连接。".to_string())
            }
            Some("wait_then_retry") => Some("请等待一段时间后重试。".to_string()),
            Some("review_auth_configuration") => {
                Some("请检查 Gateway 的认证与配对策略配置。".to_string())
            }
            _ => None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_url_maps_to_transport_error() {
        let error = GatewayError::InvalidUrl {
            message: "bad".to_string(),
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "transport");
        assert_eq!(summary.code.as_deref(), Some("INVALID_URL"));
    }

    #[test]
    fn pairing_required_maps_to_pairing_summary() {
        let error = GatewayError::ConnectRejected {
            code: Some(CONNECT_ERROR_PAIRING_REQUIRED.to_string()),
            message: "pairing required".to_string(),
            retryable: false,
            can_retry_with_device_token: false,
            recommended_next_step: None,
            pairing_reason: None,
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "pairing");
        assert_eq!(summary.code.as_deref(), Some(CONNECT_ERROR_PAIRING_REQUIRED));
    }

    #[test]
    fn pairing_scope_upgrade_maps_to_specific_summary() {
        let error = GatewayError::ConnectRejected {
            code: Some(CONNECT_ERROR_PAIRING_REQUIRED.to_string()),
            message: "pairing required".to_string(),
            retryable: false,
            can_retry_with_device_token: false,
            recommended_next_step: None,
            pairing_reason: Some("scope-upgrade".to_string()),
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "pairing");
        assert_eq!(
            summary.message,
            "该设备已配对，但当前申请权限高于已批准权限，需要服务端重新批准。"
        );
        assert_eq!(
            summary.hint.as_deref(),
            Some("请到 OpenClaw 主机执行 `openclaw devices approve --latest`，批准新的权限申请后再重试。")
        );
    }

    #[test]
    fn request_rejected_maps_to_protocol_summary() {
        let error = GatewayError::RequestRejected {
            code: Some("METHOD_NOT_ALLOWED".to_string()),
            message: "not allowed".to_string(),
            retryable: false,
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "protocol");
        assert_eq!(summary.code.as_deref(), Some("METHOD_NOT_ALLOWED"));
    }

    #[test]
    fn missing_token_secret_maps_to_auth_summary() {
        let error = GatewayError::MissingAuthSecret { mode: "token" };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "auth");
        assert_eq!(summary.code.as_deref(), Some("AUTH_TOKEN_REQUIRED"));
    }

    #[test]
    fn token_mismatch_is_inferred_from_message_when_code_is_missing() {
        let error = GatewayError::ConnectRejected {
            code: None,
            message: "unauthorized: gateway token mismatch (provide gateway auth token)".to_string(),
            retryable: false,
            can_retry_with_device_token: false,
            recommended_next_step: Some("retry_with_device_token".to_string()),
            pairing_reason: None,
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "auth");
        assert_eq!(summary.code.as_deref(), Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH));
        assert_eq!(
            summary.hint.as_deref(),
            Some("请检查 Gateway token 是否与 OpenClaw 当前配置一致。")
        );
    }

    #[test]
    fn token_missing_is_inferred_from_message_when_code_is_missing() {
        let error = GatewayError::ConnectRejected {
            code: None,
            message: "unauthorized: gateway token missing (provide gateway auth token)".to_string(),
            retryable: false,
            can_retry_with_device_token: false,
            recommended_next_step: Some("update_auth_configuration".to_string()),
            pairing_reason: None,
        };
        let summary = GatewayErrorSummary::from_error(&error);
        assert_eq!(summary.category, "auth");
        assert_eq!(summary.code.as_deref(), Some(CONNECT_ERROR_AUTH_TOKEN_REQUIRED));
        assert_eq!(
            summary.hint.as_deref(),
            Some("当前是首次配对或重配，请在“已配对设备”模式下填写 Gateway Token 作为首次配对凭据。配对成功后会自动切换为 device token。")
        );
    }
}


