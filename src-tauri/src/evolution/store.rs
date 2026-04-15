use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::{de::DeserializeOwned, Serialize};

use crate::{
    evolution::types::{EvolutionAuditEntry, EvolutionHistoryEntry, EvolutionSnapshotRecord},
    gateway::errors::GatewayError,
};

#[derive(Debug, Clone)]
pub struct EvolutionStorePaths {
    pub history_file: PathBuf,
    pub audit_file: PathBuf,
    pub snapshots_dir: PathBuf,
}

impl EvolutionStorePaths {
    pub fn resolve() -> Self {
        let root = if let Some(app_data) = env::var_os("APPDATA") {
            PathBuf::from(app_data).join("claw-scope").join("evolution")
        } else if let Some(home) = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE")) {
            PathBuf::from(home).join(".claw-scope").join("evolution")
        } else {
            env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(".claw-scope")
                .join("evolution")
        };

        Self {
            history_file: root.join("history.json"),
            audit_file: root.join("audit-log.json"),
            snapshots_dir: root.join("snapshots"),
        }
    }
}

pub fn load_history(paths: &EvolutionStorePaths) -> Result<Vec<EvolutionHistoryEntry>, GatewayError> {
    Ok(read_json::<Vec<EvolutionHistoryEntry>>(&paths.history_file)?.unwrap_or_default())
}

pub fn append_history(
    paths: &EvolutionStorePaths,
    entry: &EvolutionHistoryEntry,
) -> Result<(), GatewayError> {
    let mut history = load_history(paths)?;
    history.push(entry.clone());
    write_json(&paths.history_file, &history)
}

pub fn load_audit(paths: &EvolutionStorePaths) -> Result<Vec<EvolutionAuditEntry>, GatewayError> {
    Ok(read_json::<Vec<EvolutionAuditEntry>>(&paths.audit_file)?.unwrap_or_default())
}

pub fn append_audit(paths: &EvolutionStorePaths, entry: &EvolutionAuditEntry) -> Result<(), GatewayError> {
    let mut audit = load_audit(paths)?;
    audit.push(entry.clone());
    write_json(&paths.audit_file, &audit)
}

pub fn store_snapshot(
    paths: &EvolutionStorePaths,
    snapshot: &EvolutionSnapshotRecord,
) -> Result<(), GatewayError> {
    let path = paths.snapshots_dir.join(format!("{}.json", snapshot.snapshot_id));
    write_json(&path, snapshot)
}

pub fn load_snapshot(
    paths: &EvolutionStorePaths,
    snapshot_id: &str,
) -> Result<EvolutionSnapshotRecord, GatewayError> {
    let path = paths.snapshots_dir.join(format!("{}.json", snapshot_id));
    read_json::<EvolutionSnapshotRecord>(&path)?
        .ok_or_else(|| GatewayError::Storage {
            message: format!("snapshot not found: {}", path.display()),
        })
}

fn read_json<T>(path: &Path) -> Result<Option<T>, GatewayError>
where
    T: DeserializeOwned,
{
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|error| GatewayError::Storage {
        message: format!("failed reading {}: {error}", path.display()),
    })?;
    let value = serde_json::from_str::<T>(&raw).map_err(|error| GatewayError::Storage {
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
