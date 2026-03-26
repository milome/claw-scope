use crate::gateway::{
    device_identity::GatewayDeviceIdentity,
    errors::GatewayError,
    protocol::ConnectDeviceProof,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceSignatureContext {
    pub client_id: String,
    pub client_mode: String,
    pub role: String,
    pub scopes: Vec<String>,
    pub signed_at_ms: i64,
    pub token: Option<String>,
    pub nonce: String,
    pub platform: String,
    pub device_family: Option<String>,
}

pub fn build_device_auth_payload_v3(context: &DeviceSignatureContext, device_id: &str) -> String {
    let token = context.token.as_deref().unwrap_or_default();
    let scopes = context.scopes.join(",");
    let platform = normalize_device_metadata_for_auth(Some(context.platform.as_str()));
    let device_family = normalize_device_metadata_for_auth(context.device_family.as_deref());
    [
        "v3".to_string(),
        device_id.to_string(),
        context.client_id.clone(),
        context.client_mode.clone(),
        context.role.clone(),
        scopes,
        context.signed_at_ms.to_string(),
        token.to_string(),
        context.nonce.clone(),
        platform,
        device_family,
    ]
    .join("|")
}

pub fn sign_connect_device(
    identity: &GatewayDeviceIdentity,
    context: &DeviceSignatureContext,
) -> Result<ConnectDeviceProof, GatewayError> {
    let payload = build_device_auth_payload_v3(context, &identity.device_id);
    let signature = identity.sign_payload(&payload)?;
    Ok(ConnectDeviceProof {
        id: identity.device_id.clone(),
        public_key: identity.public_key_base64url.clone(),
        signature,
        signed_at: context.signed_at_ms,
        nonce: context.nonce.clone(),
    })
}

pub fn normalize_device_metadata_for_auth(value: Option<&str>) -> String {
    let Some(value) = value else {
        return String::new();
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    trimmed
        .chars()
        .map(|ch| if ch.is_ascii_uppercase() { ch.to_ascii_lowercase() } else { ch })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_v3_matches_expected_wire_format() {
        let payload = build_device_auth_payload_v3(
            &DeviceSignatureContext {
                client_id: "gateway-client".to_string(),
                client_mode: "backend".to_string(),
                role: "operator".to_string(),
                scopes: vec!["operator.read".to_string(), "operator.write".to_string()],
                signed_at_ms: 1234,
                token: Some("shared-token".to_string()),
                nonce: "nonce-1".to_string(),
                platform: "Windows 11".to_string(),
                device_family: Some("Desktop".to_string()),
            },
            "device-1",
        );
        assert_eq!(
            payload,
            "v3|device-1|gateway-client|backend|operator|operator.read,operator.write|1234|shared-token|nonce-1|windows 11|desktop"
        );
    }

    #[test]
    fn metadata_normalization_only_lowers_ascii() {
        assert_eq!(normalize_device_metadata_for_auth(Some(" Windows ")), "windows");
        assert_eq!(normalize_device_metadata_for_auth(Some("桌面Device")), "桌面device");
        assert_eq!(normalize_device_metadata_for_auth(None), "");
    }
}
