#[path = "../gateway/mod.rs"]
mod gateway;
#[path = "../evolution/mod.rs"]
mod evolution;

use chrono::Utc;
use evolution::{
    store::{append_history, load_history, store_snapshot, EvolutionStorePaths},
    types::{
        EvolutionHistoryEntry, EvolutionOperationKind, EvolutionOperationStatus,
        EvolutionOperationType, EvolutionSnapshotRecord, EvolutionTemplateKind,
    },
};
use gateway::{
    connector,
    state::GatewayAppState,
    types::{GatewayAuthMode, GatewayConnectConfig},
};
use rand::RngCore;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let state = GatewayAppState::default();
    let config = GatewayConnectConfig {
        gateway_url: "http://192.168.1.112:18789".to_string(),
        auth_mode: GatewayAuthMode::PairedDevice,
        auth_secret: None,
        role: "operator".to_string(),
        scopes: vec!["operator.admin".to_string()],
        profile_label: Some("evolution-wave-probe".to_string()),
    };

    let snapshot = connector::connect(state.clone(), config).await?;
    println!("connected_phase={:?}", snapshot.phase);

    let agents = connector::agents_list(state.clone()).await?;
    let mut agent_id = agents.default_id.clone();
    let mut memory = connector::agent_memory_get(state.clone(), agent_id.as_str()).await?;

    if !memory
        .documents
        .iter()
        .any(|document| !document.missing && document.content.as_ref().is_some())
    {
        for agent in &agents.agents {
            let candidate_memory = connector::agent_memory_get(state.clone(), agent.id.as_str()).await?;
            if candidate_memory
                .documents
                .iter()
                .any(|document| !document.missing && document.content.as_ref().is_some())
            {
                agent_id = agent.id.clone();
                memory = candidate_memory;
                break;
            }
        }
    }

    println!("agent_id={agent_id}");

    let document = memory
        .documents
        .iter()
        .find(|document| !document.missing && document.content.as_ref().is_some())
        .ok_or("no writable memory document found across visible agents")?;
    let original_content = document.content.clone().unwrap_or_default();
    let source_document = document.name.clone();

    let marker = format!(
        "\n<!-- claw-scope:evolution-wave-probe {} -->\n",
        Utc::now().to_rfc3339()
    );
    let next_content = format!("{original_content}{marker}");

    connector::agent_memory_set(
        state.clone(),
        agent_id.as_str(),
        source_document.as_str(),
        next_content.as_str(),
    )
    .await?;
    if let Err(error) = connector::agent_memory_index(state.clone(), agent_id.as_str(), true).await {
        println!("execute_index_warning={error}");
    }

    let after_execute = connector::agent_memory_get(state.clone(), agent_id.as_str()).await?;
    let changed = after_execute
        .documents
        .iter()
        .find(|document| document.name == source_document)
        .and_then(|document| document.content.as_ref())
        .map(|content| content.contains("claw-scope:evolution-wave-probe"))
        .unwrap_or(false);
    println!("execute_content_changed={changed}");

    let store_paths = EvolutionStorePaths::resolve();
    let snapshot_id = random_id("probe-snap");
    let execute_history_id = random_id("probe-exec");
    store_snapshot(
        &store_paths,
        &EvolutionSnapshotRecord {
            snapshot_id: snapshot_id.clone(),
            agent_id: agent_id.clone(),
            node_label: agent_id.clone(),
            source_document: source_document.clone(),
            content: original_content.clone(),
            created_at_ms: Utc::now().timestamp_millis(),
            reason: "wave-probe".to_string(),
        },
    )?;
    append_history(
        &store_paths,
        &EvolutionHistoryEntry {
            operation_id: execute_history_id,
            operation_kind: EvolutionOperationKind::Execute,
            status: EvolutionOperationStatus::Success,
            agent_id: agent_id.clone(),
            node_label: agent_id.clone(),
            template: EvolutionTemplateKind::Conservative,
            operation_type: EvolutionOperationType::Optimize,
            snapshot_id: snapshot_id.clone(),
            source_document: source_document.clone(),
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            summary: "probe execute".to_string(),
            summary_i18n: None,
            bytes_before: original_content.len(),
            bytes_after: next_content.len(),
            duration_ms: None,
            created_at_ms: Utc::now().timestamp_millis(),
        },
    )?;

    connector::agent_memory_set(
        state.clone(),
        agent_id.as_str(),
        source_document.as_str(),
        original_content.as_str(),
    )
    .await?;
    if let Err(error) = connector::agent_memory_index(state.clone(), agent_id.as_str(), true).await {
        println!("rollback_index_warning={error}");
    }

    let after_rollback = connector::agent_memory_get(state.clone(), agent_id.as_str()).await?;
    let restored = after_rollback
        .documents
        .iter()
        .find(|document| document.name == source_document)
        .and_then(|document| document.content.as_ref())
        .map(|content| content == &original_content)
        .unwrap_or(false);
    println!("rollback_restored={restored}");

    append_history(
        &store_paths,
        &EvolutionHistoryEntry {
            operation_id: random_id("probe-rb"),
            operation_kind: EvolutionOperationKind::Rollback,
            status: EvolutionOperationStatus::RolledBack,
            agent_id: agent_id.clone(),
            node_label: agent_id.clone(),
            template: EvolutionTemplateKind::Conservative,
            operation_type: EvolutionOperationType::RestoreSnapshot,
            snapshot_id,
            source_document,
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            summary: "probe rollback".to_string(),
            summary_i18n: None,
            bytes_before: original_content.len(),
            bytes_after: original_content.len(),
            duration_ms: None,
            created_at_ms: Utc::now().timestamp_millis(),
        },
    )?;

    let history = load_history(&store_paths)?;
    println!("history_entries={}", history.len());

    let _ = connector::disconnect(state).await;
    Ok(())
}

fn random_id(prefix: &str) -> String {
    let mut bytes = [0_u8; 8];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!(
        "{}-{}",
        prefix,
        bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
    )
}
