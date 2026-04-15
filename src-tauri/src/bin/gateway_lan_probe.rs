#![allow(dead_code)]

#[path = "../gateway/mod.rs"]
mod gateway;

use gateway::{
    discovery,
    store::{load_saved_endpoints, mark_saved_endpoint_success, resolve_store_paths, select_saved_endpoint},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let store_paths = resolve_store_paths();
    let seed_url = std::env::var("LAN_PROBE_SEED_URL").ok();
    let candidates = discovery::discover_lan_candidates(seed_url.as_deref(), Some(2400)).await?;
    println!("candidate_count={}", candidates.len());
    for candidate in candidates.iter().take(12) {
        println!(
            "candidate={} source={:?} url={}",
            candidate.label, candidate.source, candidate.http_url.as_deref().unwrap_or(candidate.ws_url.as_str())
        );
    }

    if let Ok(select_host) = std::env::var("LAN_PROBE_SELECT_HOST") {
        if let Some(candidate) = candidates.iter().find(|candidate| candidate.host == select_host) {
            let saved = select_saved_endpoint(&store_paths, candidate)?;
            mark_saved_endpoint_success(&store_paths, saved.origin_key.as_str())?;
            println!(
                "selected_endpoint={} preferred={} origin={}",
                saved.label, saved.was_user_selected, saved.origin_key
            );
        } else {
            println!("selected_endpoint=not_found host={select_host}");
        }
    }

    let saved = load_saved_endpoints(&store_paths)?;
    println!("saved_endpoint_count={}", saved.len());
    for endpoint in saved.iter().take(12) {
        println!(
            "saved_endpoint={} preferred={} last_success={:?}",
            endpoint.label, endpoint.was_user_selected, endpoint.last_success_at_ms
        );
    }

    Ok(())
}
