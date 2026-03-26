use crate::gateway::{
    errors::GatewayError,
    protocol::ConnectAuth,
    store::DeviceAuthEntry,
    types::{GatewayAuthMode, GatewayConnectConfig},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectedConnectAuth {
    pub auth: Option<ConnectAuth>,
    pub signature_token: Option<String>,
    pub resolved_device_token: Option<String>,
    pub stored_token: Option<String>,
    pub retry_uses_device_token: bool,
}

pub fn validate_connect_auth_config(config: &GatewayConnectConfig) -> Result<(), GatewayError> {
    let secret = config.auth_secret.as_deref().map(str::trim);

    match config.auth_mode {
        GatewayAuthMode::Token if secret.filter(|value| !value.is_empty()).is_none() => {
            Err(GatewayError::MissingAuthSecret { mode: "token" })
        }
        GatewayAuthMode::Password if secret.filter(|value| !value.is_empty()).is_none() => {
            Err(GatewayError::MissingAuthSecret { mode: "password" })
        }
        _ => Ok(()),
    }
}

pub fn select_connect_auth(
    config: &GatewayConnectConfig,
    stored_device_token: Option<&DeviceAuthEntry>,
    retry_with_stored_device_token: bool,
) -> SelectedConnectAuth {
    let explicit_gateway_token = match config.auth_mode {
        GatewayAuthMode::Token => config
            .auth_secret
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned),
        _ => None,
    };
    let auth_password = match config.auth_mode {
        GatewayAuthMode::Password => config
            .auth_secret
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned),
        _ => None,
    };
    let stored_token = stored_device_token
        .map(|entry| entry.token.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let should_use_stored_device_token = retry_with_stored_device_token
        || (matches!(config.auth_mode, GatewayAuthMode::None)
            && explicit_gateway_token.is_none()
            && auth_password.is_none());
    let resolved_device_token = if should_use_stored_device_token {
        stored_token.clone()
    } else {
        None
    };
    let auth_token = explicit_gateway_token
        .clone()
        .or_else(|| resolved_device_token.clone());
    let auth_device_token = if retry_with_stored_device_token {
        stored_token.clone()
    } else {
        None
    };
    let auth = if auth_token.is_some() || auth_password.is_some() || auth_device_token.is_some() {
        Some(ConnectAuth {
            token: auth_token.clone(),
            bootstrap_token: None,
            device_token: auth_device_token,
            password: auth_password,
        })
    } else {
        None
    };

    SelectedConnectAuth {
        auth,
        signature_token: auth_token,
        resolved_device_token,
        stored_token,
        retry_uses_device_token: retry_with_stored_device_token,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::{store::DeviceAuthEntry, types::GatewayConnectConfig};

    fn stored_entry() -> DeviceAuthEntry {
        DeviceAuthEntry {
            token: "stored-device-token".to_string(),
            gateway_origin: "ws://127.0.0.1:18789".to_string(),
            role: "operator".to_string(),
            scopes: vec!["operator.read".to_string()],
            updated_at_ms: 1,
        }
    }

    #[test]
    fn token_auth_prefers_explicit_shared_secret() {
        let mut config = GatewayConnectConfig::default();
        config.auth_mode = crate::gateway::types::GatewayAuthMode::Token;
        config.auth_secret = Some("shared-token".to_string());

        let selected = select_connect_auth(&config, Some(&stored_entry()), false);
        assert_eq!(selected.signature_token.as_deref(), Some("shared-token"));
        assert_eq!(selected.resolved_device_token, None);
        assert_eq!(selected.auth.and_then(|auth| auth.device_token), None);
    }

    #[test]
    fn password_auth_never_populates_signature_token() {
        let mut config = GatewayConnectConfig::default();
        config.auth_mode = crate::gateway::types::GatewayAuthMode::Password;
        config.auth_secret = Some("shared-password".to_string());

        let selected = select_connect_auth(&config, Some(&stored_entry()), false);
        assert!(selected.signature_token.is_none());
        assert_eq!(
            selected.auth.and_then(|auth| auth.password),
            Some("shared-password".to_string())
        );
    }

    #[test]
    fn token_auth_requires_non_empty_secret() {
        let mut config = GatewayConnectConfig::default();
        config.auth_mode = crate::gateway::types::GatewayAuthMode::Token;
        config.auth_secret = Some("   ".to_string());

        let error = validate_connect_auth_config(&config)
            .expect_err("token auth should require secret");
        assert!(matches!(
            error,
            GatewayError::MissingAuthSecret { mode: "token" }
        ));
    }

    #[test]
    fn token_auth_with_empty_secret_does_not_fall_back_to_stored_device_token() {
        let mut config = GatewayConnectConfig::default();
        config.auth_mode = crate::gateway::types::GatewayAuthMode::Token;
        config.auth_secret = Some("   ".to_string());

        let selected = select_connect_auth(&config, Some(&stored_entry()), false);
        assert!(selected.auth.is_none());
        assert!(selected.signature_token.is_none());
        assert!(selected.resolved_device_token.is_none());
    }

    #[test]
    fn none_auth_uses_stored_device_token_in_legacy_token_field() {
        let selected = select_connect_auth(&GatewayConnectConfig::default(), Some(&stored_entry()), false);
        let auth = selected.auth.expect("device auth payload");
        assert_eq!(auth.token.as_deref(), Some("stored-device-token"));
        assert_eq!(auth.device_token.as_deref(), None);
        assert_eq!(selected.resolved_device_token.as_deref(), Some("stored-device-token"));
    }

    #[test]
    fn token_auth_retry_attaches_device_token_without_dropping_shared_token() {
        let mut config = GatewayConnectConfig::default();
        config.auth_mode = crate::gateway::types::GatewayAuthMode::Token;
        config.auth_secret = Some("shared-token".to_string());

        let selected = select_connect_auth(&config, Some(&stored_entry()), true);
        let auth = selected.auth.expect("retry auth payload");
        assert_eq!(auth.token.as_deref(), Some("shared-token"));
        assert_eq!(auth.device_token.as_deref(), Some("stored-device-token"));
        assert_eq!(selected.signature_token.as_deref(), Some("shared-token"));
        assert!(selected.retry_uses_device_token);
    }
}
