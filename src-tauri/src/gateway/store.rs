use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::gateway::errors::GatewayError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredDeviceIdentity {
    pub version: u8,
    pub device_id: String,
    pub public_key: String,
    pub secret_key: String,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthEntry {
    pub token: String,
    #[serde(default)]
    pub gateway_origin: String,
    pub role: String,
    pub scopes: Vec<String>,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeviceAuthStore {
    pub version: u8,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    pub tokens: BTreeMap<String, DeviceAuthEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GatewayStorePaths {
    pub root: PathBuf,
    pub identity_file: PathBuf,
    pub device_auth_file: PathBuf,
}

impl GatewayStorePaths {
    pub fn from_root(root: PathBuf) -> Self {
        let identity_dir = root.join("identity");
        Self {
            root,
            identity_file: identity_dir.join("device.json"),
            device_auth_file: identity_dir.join("device-auth.json"),
        }
    }
}

pub fn resolve_store_paths() -> GatewayStorePaths {
    GatewayStorePaths::from_root(resolve_default_store_root())
}

pub fn resolve_default_store_root() -> PathBuf {
    if let Some(app_data) = env::var_os("APPDATA") {
        return PathBuf::from(app_data).join("claw-scope").join("gateway");
    }
    if let Some(home) = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE")) {
        return PathBuf::from(home).join(".claw-scope").join("gateway");
    }
    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".claw-scope")
        .join("gateway")
}

pub fn load_stored_device_identity(
    paths: &GatewayStorePaths,
) -> Result<Option<StoredDeviceIdentity>, GatewayError> {
    read_json(&paths.identity_file)
}

pub fn store_device_identity(
    paths: &GatewayStorePaths,
    identity: &StoredDeviceIdentity,
) -> Result<(), GatewayError> {
    write_json(&paths.identity_file, identity)
}

pub fn load_device_auth_token(
    paths: &GatewayStorePaths,
    device_id: &str,
    gateway_origin: &str,
    role: &str,
    scopes: &[String],
) -> Result<Option<DeviceAuthEntry>, GatewayError> {
    let Some(store) = read_json::<DeviceAuthStore>(&paths.device_auth_file)? else {
        return Ok(None);
    };
    if store.device_id != device_id {
        return Ok(None);
    }

    let normalized_origin = normalize_gateway_origin(gateway_origin);
    let normalized_role = normalize_role(role);
    let normalized_scopes = normalize_scopes(scopes);

    if store.version >= 2 {
        let binding_key = device_auth_binding_key(&normalized_origin, &normalized_role, &normalized_scopes);
        if let Some(entry) = store.tokens.get(&binding_key).cloned() {
            return Ok(Some(entry));
        }

        let fallback = store
            .tokens
            .values()
            .filter(|entry| {
                entry.role == normalized_role && normalize_gateway_origin(&entry.gateway_origin) == normalized_origin
            })
            .cloned()
            .max_by_key(|entry| entry.updated_at_ms);
        if fallback.is_some() {
            return Ok(fallback);
        }
    }

    let legacy_fallback = store
        .tokens
        .values()
        .filter(|entry| entry.role == normalized_role)
        .cloned()
        .max_by_key(|entry| entry.updated_at_ms);
    Ok(legacy_fallback)
}

pub fn store_device_auth_token(
    paths: &GatewayStorePaths,
    device_id: &str,
    gateway_origin: &str,
    role: &str,
    token: &str,
    scopes: &[String],
) -> Result<DeviceAuthEntry, GatewayError> {
    let normalized_origin = normalize_gateway_origin(gateway_origin);
    let normalized_role = normalize_role(role);
    let normalized_scopes = normalize_scopes(scopes);
    let mut store = read_json::<DeviceAuthStore>(&paths.device_auth_file)?.unwrap_or(DeviceAuthStore {
        version: 2,
        device_id: device_id.to_string(),
        tokens: BTreeMap::new(),
    });
    if store.version != 2 || store.device_id != device_id {
        store = DeviceAuthStore {
            version: 2,
            device_id: device_id.to_string(),
            tokens: BTreeMap::new(),
        };
    }
    let entry = DeviceAuthEntry {
        token: token.to_string(),
        gateway_origin: normalized_origin.clone(),
        role: normalized_role.clone(),
        scopes: normalized_scopes.clone(),
        updated_at_ms: Utc::now().timestamp_millis(),
    };
    store.tokens.insert(
        device_auth_binding_key(&normalized_origin, &normalized_role, &normalized_scopes),
        entry.clone(),
    );
    write_json(&paths.device_auth_file, &store)?;
    Ok(entry)
}

pub fn normalize_role(role: &str) -> String {
    let trimmed = role.trim();
    if trimmed.is_empty() {
        "operator".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn normalize_scopes(scopes: &[String]) -> Vec<String> {
    let mut normalized = BTreeSet::new();
    for scope in scopes {
        let trimmed = scope.trim();
        if !trimmed.is_empty() {
            normalized.insert(trimmed.to_string());
        }
    }
    if normalized.contains("operator.admin") {
        normalized.insert("operator.read".to_string());
        normalized.insert("operator.write".to_string());
    } else if normalized.contains("operator.write") {
        normalized.insert("operator.read".to_string());
    }
    normalized.into_iter().collect()
}

pub fn normalize_gateway_origin(gateway_origin: &str) -> String {
    gateway_origin.trim().to_string()
}

fn device_auth_binding_key(gateway_origin: &str, role: &str, scopes: &[String]) -> String {
    format!(
        "{}\n{}\n{}",
        normalize_gateway_origin(gateway_origin),
        normalize_role(role),
        normalize_scopes(scopes).join(",")
    )
}

fn read_json<T>(path: &Path) -> Result<Option<T>, GatewayError>
where
    T: for<'de> Deserialize<'de>,
{
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|error| GatewayError::Storage {
        message: format!("failed reading {}: {error}", path.display()),
    })?;
    let value = serde_json::from_str(&raw).map_err(|error| GatewayError::Storage {
        message: format!("failed parsing {}: {error}", path.display()),
    })?;
    Ok(Some(value))
}

fn write_json<T>(path: &Path, value: &T) -> Result<(), GatewayError>
where
    T: Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| GatewayError::Storage {
            message: format!("failed creating {}: {error}", parent.display()),
        })?;
    }
    let raw = serde_json::to_string_pretty(value).map_err(|error| GatewayError::Storage {
        message: format!("failed serializing {}: {error}", path.display()),
    })?;
    fs::write(path, format!("{raw}\n")).map_err(|error| GatewayError::Storage {
        message: format!("failed writing {}: {error}", path.display()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    fn temp_paths() -> GatewayStorePaths {
        let mut suffix = [0_u8; 8];
        rand::thread_rng().fill_bytes(&mut suffix);
        let root = std::env::temp_dir().join(format!(
            "claw-scope-gateway-test-{}",
            suffix.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
        ));
        GatewayStorePaths::from_root(root)
    }

    #[test]
    fn normalize_scopes_adds_implied_permissions() {
        let scopes = normalize_scopes(&["operator.admin".to_string()]);
        assert!(scopes.contains(&"operator.admin".to_string()));
        assert!(scopes.contains(&"operator.read".to_string()));
        assert!(scopes.contains(&"operator.write".to_string()));
    }

    #[test]
    fn device_auth_store_round_trips_by_origin() {
        let paths = temp_paths();
        let stored = store_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            "device-token",
            &["operator.write".to_string()],
        )
        .expect("store device auth token");
        let loaded = load_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            &["operator.write".to_string()],
        )
        .expect("load device auth token")
        .expect("stored entry should exist");
        assert_eq!(stored.token, loaded.token);
        assert_eq!(loaded.gateway_origin, "ws://127.0.0.1:18789");
        assert!(loaded.scopes.contains(&"operator.read".to_string()));
        let _ = fs::remove_dir_all(paths.root);
    }

    #[test]
    fn device_auth_store_keeps_multiple_gateway_origins_separate() {
        let paths = temp_paths();
        store_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            "token-local",
            &["operator.read".to_string()],
        )
        .expect("store local token");
        store_device_auth_token(
            &paths,
            "device-a",
            "ws://10.0.0.8:18789",
            "operator",
            "token-lan",
            &["operator.read".to_string()],
        )
        .expect("store lan token");

        let local = load_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            &["operator.read".to_string()],
        )
        .expect("load local")
        .expect("local token");
        let lan = load_device_auth_token(
            &paths,
            "device-a",
            "ws://10.0.0.8:18789",
            "operator",
            &["operator.read".to_string()],
        )
        .expect("load lan")
        .expect("lan token");

        assert_eq!(local.token, "token-local");
        assert_eq!(lan.token, "token-lan");
        let _ = fs::remove_dir_all(paths.root);
    }

    #[test]
    fn device_auth_store_falls_back_to_same_origin_and_role_when_scopes_change() {
        let paths = temp_paths();
        store_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            "token-admin",
            &["operator.admin".to_string()],
        )
        .expect("store admin token");

        let loaded = load_device_auth_token(
            &paths,
            "device-a",
            "ws://127.0.0.1:18789",
            "operator",
            &["operator.read".to_string()],
        )
        .expect("load token")
        .expect("fallback token");
        assert_eq!(loaded.token, "token-admin");
        let _ = fs::remove_dir_all(paths.root);
    }
}
