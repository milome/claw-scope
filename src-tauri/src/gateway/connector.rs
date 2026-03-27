use std::{sync::Arc, time::Duration};

use chrono::Utc;
use futures_util::{stream::SplitStream, SinkExt, StreamExt};
use rand::RngCore;
use serde_json::{json, Map, Value};
use tokio::{sync::Mutex as AsyncMutex, time::timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::gateway::{
    auth::{select_connect_auth, validate_connect_auth_config, SelectedConnectAuth},
    device_identity::GatewayDeviceIdentity,
    endpoint::{GatewayEndpoint, GatewayTransportKind},
    errors::{GatewayError, GatewayErrorSummary},
    protocol::{
        extract_connect_challenge_nonce, parse_connect_error_recovery, parse_inbound_frame,
        ConnectClientInfo, ConnectParams, HelloOk, InboundFrame, RequestFrame,
        CONNECT_ERROR_AUTH_TOKEN_MISMATCH, CONNECT_ERROR_PAIRING_REQUIRED,
        CONNECT_EVENT_CHALLENGE, DEFAULT_CLIENT_ID, DEFAULT_CLIENT_MODE,
        DEFAULT_DEVICE_FAMILY, PROTOCOL_VERSION,
    },
    signer::{sign_connect_device, DeviceSignatureContext},
    state::{GatewayActiveConnection, GatewayAppState, GatewaySocket, GatewaySocketWriter},
    store::{
        load_device_auth_token, normalize_role, normalize_scopes, resolve_store_paths,
        store_device_auth_token,
    },
    types::{
        GatewayAgentFileGetResult, GatewayAgentIdentityResult, GatewayAgentsListResult,
        GatewayConnectConfig, GatewayConnectionPhase, GatewayStatusSnapshot,
    },
};

const CONNECT_CHALLENGE_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_RESPONSE_TIMEOUT: Duration = Duration::from_secs(15);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

type GatewaySocketReader = SplitStream<GatewaySocket>;

pub async fn connect(
    state: GatewayAppState,
    config: GatewayConnectConfig,
) -> Result<GatewayStatusSnapshot, GatewayError> {
    validate_connect_auth_config(&config)?;
    let endpoint = GatewayEndpoint::from_config(&config)?;

    if let Some(existing) = state.take_session().await {
        existing.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway session replaced by a new connection attempt".to_string(),
        });
        close_connection_writer(&existing).await;
    }
    let role = normalize_role(&config.role);
    let scopes = normalize_scopes(&config.scopes);
    let store_paths = resolve_store_paths();
    let identity = GatewayDeviceIdentity::load_or_create(&store_paths)?;

    state.replace_snapshot(snapshot_for_phase(
        &endpoint,
        &identity.device_id,
        GatewayConnectionPhase::ResolvingEndpoint,
    ));

    let normalized_config = GatewayConnectConfig {
        role: role.clone(),
        scopes: scopes.clone(),
        ..config.clone()
    };
    let stored_device_token = load_device_auth_token(
        &store_paths,
        &identity.device_id,
        &endpoint.origin_key,
        &role,
        &scopes,
    )?;

    let mut retry_with_stored_device_token = false;
    let (writer, reader, hello) = loop {
        let selected_auth = select_connect_auth(
            &normalized_config,
            stored_device_token.as_ref(),
            retry_with_stored_device_token,
        );
        match perform_handshake(
            &state,
            &endpoint,
            &identity,
            &role,
            &scopes,
            &selected_auth,
        )
        .await
        {
            Ok(result) => break result,
            Err(error)
                if should_retry_with_stored_device_token(
                    &endpoint,
                    &normalized_config,
                    &selected_auth,
                    &error,
                    retry_with_stored_device_token,
                ) =>
            {
                retry_with_stored_device_token = true;
            }
            Err(error) => {
                state.replace_snapshot(failure_snapshot(&endpoint, &identity.device_id, &error));
                return Err(error);
            }
        }
    };

    if let Some(auth) = hello.auth.as_ref() {
        store_device_auth_token(
            &store_paths,
            &identity.device_id,
            &endpoint.origin_key,
            &auth.role,
            &auth.device_token,
            &auth.scopes,
        )?;
    }

    let session_id = random_hex_id();
    let writer = Arc::new(AsyncMutex::new(writer));
    let active_connection = GatewayActiveConnection::new(
        session_id.clone(),
        endpoint.clone(),
        Arc::clone(&writer),
        hello.features.methods.clone(),
    );
    let replaced = state.replace_session(Some(active_connection.clone())).await;
    if let Some(previous) = replaced {
        previous.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway session replaced by a newer live session".to_string(),
        });
        close_connection_writer(&previous).await;
    }
    spawn_connection_reader(state.clone(), active_connection, reader);

    let snapshot = GatewayStatusSnapshot {
        phase: GatewayConnectionPhase::Connected,
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(identity.device_id.clone()),
        granted_role: Some(
            hello
                .auth
                .as_ref()
                .map(|auth| auth.role.clone())
                .unwrap_or(role),
        ),
        granted_scopes: hello
            .auth
            .as_ref()
            .map(|auth| auth.scopes.clone())
            .unwrap_or(scopes),
        last_error: None,
        is_paired: true,
        can_retry_with_device_token: false,
    };
    state.replace_snapshot(snapshot.clone());
    Ok(snapshot)
}

pub async fn disconnect(state: GatewayAppState) -> Result<GatewayStatusSnapshot, GatewayError> {
    if let Some(existing) = state.take_session().await {
        existing.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway disconnected".to_string(),
        });
        close_connection_writer(&existing).await;
    }

    let mut snapshot = state.snapshot();
    snapshot.phase = GatewayConnectionPhase::Disconnected;
    snapshot.granted_role = None;
    snapshot.granted_scopes.clear();
    snapshot.last_error = None;
    snapshot.is_paired = false;
    snapshot.can_retry_with_device_token = false;
    state.replace_snapshot(snapshot.clone());
    Ok(snapshot)
}

pub async fn agents_list(state: GatewayAppState) -> Result<GatewayAgentsListResult, GatewayError> {
    let value = request_json(
        state,
        "agents.list",
        Some(Value::Object(Map::new())),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agents.list payload: {error}"),
    })
}

pub async fn agent_identity_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentIdentityResult, GatewayError> {
    let value = request_json(
        state,
        "agent.identity.get",
        Some(json!({ "agentId": agent_id })),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agent.identity.get payload: {error}"),
    })
}

pub async fn agent_soul_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_file_get(state, agent_id, "SOUL.md").await
}

pub async fn agent_workspace_identity_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_file_get(state, agent_id, "IDENTITY.md").await
}

pub async fn agent_workspace_identity_set(
    state: GatewayAppState,
    agent_id: &str,
    content: &str,
) -> Result<(), GatewayError> {
    agent_file_set(state, agent_id, "IDENTITY.md", content).await
}

pub async fn agent_soul_set(
    state: GatewayAppState,
    agent_id: &str,
    content: &str,
) -> Result<(), GatewayError> {
    agent_file_set(state, agent_id, "SOUL.md", content).await
}

async fn agent_file_get(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    let value = request_json(
        state,
        "agents.files.get",
        Some(json!({ "agentId": agent_id, "name": name })),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agents.files.get payload for {name}: {error}"),
    })
}

async fn agent_file_set(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
    content: &str,
) -> Result<(), GatewayError> {
    request_json(
        state,
        "agents.files.set",
        Some(json!({
            "agentId": agent_id,
            "name": name,
            "content": content,
        })),
    )
    .await?;
    Ok(())
}

async fn perform_handshake(
    state: &GatewayAppState,
    endpoint: &GatewayEndpoint,
    identity: &GatewayDeviceIdentity,
    role: &str,
    scopes: &[String],
    selected_auth: &SelectedConnectAuth,
) -> Result<(GatewaySocketWriter, GatewaySocketReader, HelloOk), GatewayError> {
    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::OpeningSocket,
    ));

    let (socket, _) = connect_async(endpoint.ws_url.as_str())
        .await
        .map_err(|error| GatewayError::Transport {
            message: format!("failed opening websocket to {}: {error}", endpoint.ws_url),
        })?;
    let (mut writer, mut reader) = socket.split();

    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::WaitingForChallenge,
    ));

    let nonce = timeout(
        CONNECT_CHALLENGE_TIMEOUT,
        wait_for_connect_challenge(&mut reader),
    )
    .await
    .map_err(|_| GatewayError::Transport {
        message: "timed out waiting for gateway connect challenge".to_string(),
    })??;

    let signed_at_ms = Utc::now().timestamp_millis();
    let device = sign_connect_device(
        identity,
        &DeviceSignatureContext {
            client_id: DEFAULT_CLIENT_ID.to_string(),
            client_mode: DEFAULT_CLIENT_MODE.to_string(),
            role: role.to_string(),
            scopes: scopes.to_vec(),
            signed_at_ms,
            token: selected_auth.signature_token.clone(),
            nonce: nonce.clone(),
            platform: std::env::consts::OS.to_string(),
            device_family: Some(DEFAULT_DEVICE_FAMILY.to_string()),
        },
    )?;

    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::SendingConnect,
    ));

    let request_id = random_hex_id();
    let request = RequestFrame::new(
        request_id.clone(),
        "connect",
        ConnectParams {
            min_protocol: PROTOCOL_VERSION,
            max_protocol: PROTOCOL_VERSION,
            client: ConnectClientInfo {
                id: DEFAULT_CLIENT_ID.to_string(),
                display_name: Some("Claw Scope".to_string()),
                version: APP_VERSION.to_string(),
                platform: std::env::consts::OS.to_string(),
                device_family: Some(DEFAULT_DEVICE_FAMILY.to_string()),
                model_identifier: None,
                mode: DEFAULT_CLIENT_MODE.to_string(),
                instance_id: None,
            },
            caps: Vec::new(),
            commands: None,
            permissions: None,
            path_env: None,
            role: role.to_string(),
            scopes: scopes.to_vec(),
            device: Some(device),
            auth: selected_auth.auth.clone(),
            locale: None,
            user_agent: Some(format!("claw-scope/{APP_VERSION}")),
        },
    );

    writer
        .send(Message::Text(
            serde_json::to_string(&request)
                .map_err(|error| GatewayError::Protocol {
                    message: format!("failed serializing connect request: {error}"),
                })?
                .into(),
        ))
        .await
        .map_err(|error| GatewayError::Transport {
            message: format!("failed sending gateway connect request: {error}"),
        })?;

    let hello = timeout(
        CONNECT_RESPONSE_TIMEOUT,
        wait_for_connect_response(&mut reader, &request_id),
    )
    .await
    .map_err(|_| GatewayError::Transport {
        message: "timed out waiting for gateway hello-ok response".to_string(),
    })??;

    Ok((writer, reader, hello))
}

async fn request_json(
    state: GatewayAppState,
    method: &str,
    params: Option<Value>,
) -> Result<Value, GatewayError> {
    let connection = state.session().await.ok_or_else(|| GatewayError::Transport {
        message: "gateway not connected".to_string(),
    })?;
    if !connection.supports_method(method) {
        return Err(GatewayError::NotImplemented {
            feature: format!("gateway method {method}"),
        });
    }

    let request_id = random_hex_id();
    let response_rx = connection.register_pending_request(request_id.clone());
    let request = RequestFrame::new(
        request_id.clone(),
        method,
        params.unwrap_or_else(|| Value::Object(Map::new())),
    );
    let request_text = serde_json::to_string(&request).map_err(|error| GatewayError::Protocol {
        message: format!("failed serializing {method} request: {error}"),
    })?;

    {
        let mut writer = connection.writer.lock().await;
        if let Err(error) = writer.send(Message::Text(request_text.into())).await {
            connection.remove_pending_request(&request_id);
            return Err(GatewayError::Transport {
                message: format!("failed sending gateway request {method}: {error}"),
            });
        }
    }

    match timeout(REQUEST_TIMEOUT, response_rx).await {
        Ok(Ok(Ok(value))) => Ok(value),
        Ok(Ok(Err(error))) => Err(error),
        Ok(Err(_)) => Err(GatewayError::Transport {
            message: format!("gateway request channel closed for {method}"),
        }),
        Err(_) => {
            connection.remove_pending_request(&request_id);
            Err(GatewayError::Transport {
                message: format!("gateway request timeout for {method}"),
            })
        }
    }
}

async fn wait_for_connect_challenge(
    reader: &mut GatewaySocketReader,
) -> Result<String, GatewayError> {
    loop {
        let message = next_text_message(reader).await?;
        match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
            message: format!("failed parsing gateway frame: {error}"),
        })? {
            InboundFrame::Event(event) if event.event == CONNECT_EVENT_CHALLENGE => {
                return extract_connect_challenge_nonce(event.payload.as_ref()).ok_or(
                    GatewayError::Protocol {
                        message: "gateway connect challenge missing nonce".to_string(),
                    },
                )
            }
            InboundFrame::Unknown | InboundFrame::Event(_) | InboundFrame::Response(_) => continue,
        }
    }
}

async fn wait_for_connect_response(
    reader: &mut GatewaySocketReader,
    request_id: &str,
) -> Result<HelloOk, GatewayError> {
    loop {
        let message = next_text_message(reader).await?;
        match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
            message: format!("failed parsing gateway frame: {error}"),
        })? {
            InboundFrame::Response(response) if response.id == request_id => {
                if response.ok {
                    let payload = response.payload.ok_or_else(|| GatewayError::Protocol {
                        message: "gateway connect response missing payload".to_string(),
                    })?;
                    return serde_json::from_value(payload).map_err(|error| GatewayError::Protocol {
                        message: format!("failed decoding hello-ok payload: {error}"),
                    });
                }

                let response_error = response.error;
                let details = response_error.as_ref().and_then(|error| error.details.as_ref());
                let recovery = parse_connect_error_recovery(details);
                let code = response_error
                    .as_ref()
                    .map(|error| error.code.clone())
                    .or(recovery.code.clone());
                let message = response_error
                    .as_ref()
                    .map(|error| error.message.clone())
                    .unwrap_or_else(|| "gateway connect rejected".to_string());
                let retryable = response_error
                    .as_ref()
                    .and_then(|error| error.retryable)
                    .unwrap_or(false);
                return Err(GatewayError::ConnectRejected {
                    code,
                    message,
                    retryable,
                    can_retry_with_device_token: recovery.can_retry_with_device_token,
                    recommended_next_step: recovery.recommended_next_step,
                    pairing_reason: recovery.pairing_reason,
                });
            }
            InboundFrame::Unknown | InboundFrame::Event(_) | InboundFrame::Response(_) => continue,
        }
    }
}

async fn next_text_message(reader: &mut GatewaySocketReader) -> Result<String, GatewayError> {
    loop {
        match reader.next().await {
            Some(Ok(Message::Text(text))) => return Ok(text.to_string()),
            Some(Ok(Message::Close(frame))) => {
                let reason = frame
                    .map(|frame| frame.reason.to_string())
                    .filter(|reason| !reason.is_empty())
                    .unwrap_or_else(|| "gateway closed during handshake".to_string());
                return Err(GatewayError::Transport { message: reason });
            }
            Some(Ok(_)) => continue,
            Some(Err(error)) => {
                return Err(GatewayError::Transport {
                    message: format!("gateway websocket error: {error}"),
                })
            }
            None => {
                return Err(GatewayError::Transport {
                    message: "gateway connection closed".to_string(),
                })
            }
        }
    }
}

fn spawn_connection_reader(
    state: GatewayAppState,
    connection: GatewayActiveConnection,
    mut reader: GatewaySocketReader,
) {
    tokio::spawn(async move {
        let disconnect_error = loop {
            match reader.next().await {
                Some(Ok(Message::Text(text))) => {
                    if let Err(error) = handle_runtime_frame(&connection, text.to_string()) {
                        break Some(error);
                    }
                }
                Some(Ok(Message::Close(_))) | None => break None,
                Some(Ok(_)) => continue,
                Some(Err(error)) => {
                    break Some(GatewayError::Transport {
                        message: format!("gateway websocket closed with error: {error}"),
                    })
                }
            }
        };

        let close_error = disconnect_error.clone().unwrap_or_else(|| GatewayError::Transport {
            message: "gateway connection closed".to_string(),
        });
        connection.reject_all_pending_requests(close_error);

        let _ = connection.writer.lock().await.close().await;

        if !state.clear_session_for_id(&connection.session_id).await {
            return;
        }

        let mut snapshot = state.snapshot();
        snapshot.phase = if disconnect_error.is_some() {
            GatewayConnectionPhase::Failed
        } else {
            GatewayConnectionPhase::Disconnected
        };
        snapshot.granted_role = None;
        snapshot.granted_scopes.clear();
        snapshot.is_paired = false;
        snapshot.can_retry_with_device_token = false;
        if let Some(error) = disconnect_error {
            snapshot.last_error = Some(GatewayErrorSummary::from_error(&error));
        }
        state.replace_snapshot(snapshot);
    });
}

fn handle_runtime_frame(
    connection: &GatewayActiveConnection,
    message: String,
) -> Result<(), GatewayError> {
    match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
        message: format!("failed parsing gateway frame: {error}"),
    })? {
        InboundFrame::Response(response) => {
            let result = if response.ok {
                Ok(response.payload.unwrap_or(Value::Null))
            } else {
                let response_error = response.error;
                Err(GatewayError::RequestRejected {
                    code: response_error.as_ref().map(|error| error.code.clone()),
                    message: response_error
                        .as_ref()
                        .map(|error| error.message.clone())
                        .unwrap_or_else(|| "gateway request rejected".to_string()),
                    retryable: response_error
                        .as_ref()
                        .and_then(|error| error.retryable)
                        .unwrap_or(false),
                })
            };
            let _ = connection.resolve_pending_request(&response.id, result);
            Ok(())
        }
        InboundFrame::Event(_) | InboundFrame::Unknown => Ok(()),
    }
}

async fn close_connection_writer(connection: &GatewayActiveConnection) {
    let mut writer = connection.writer.lock().await;
    let _ = writer.send(Message::Close(None)).await;
    let _ = writer.close().await;
}

fn should_retry_with_stored_device_token(
    endpoint: &GatewayEndpoint,
    config: &GatewayConnectConfig,
    selected_auth: &SelectedConnectAuth,
    error: &GatewayError,
    already_retried: bool,
) -> bool {
    if already_retried || selected_auth.resolved_device_token.is_some() {
        return false;
    }
    if !matches!(config.auth_mode, crate::gateway::types::GatewayAuthMode::Token) {
        return false;
    }
    if config
        .auth_secret
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return false;
    }
    if selected_auth.stored_token.is_none() || !is_trusted_device_retry_endpoint(endpoint) {
        return false;
    }
    error.connect_error_code().as_deref() == Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH)
        || error.can_retry_with_device_token()
        || error.recommended_next_step() == Some("retry_with_device_token")
}

fn is_trusted_device_retry_endpoint(endpoint: &GatewayEndpoint) -> bool {
    matches!(endpoint.transport, GatewayTransportKind::LocalLoopback)
}

fn snapshot_for_phase(
    endpoint: &GatewayEndpoint,
    device_id: &str,
    phase: GatewayConnectionPhase,
) -> GatewayStatusSnapshot {
    GatewayStatusSnapshot {
        phase,
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(device_id.to_string()),
        granted_role: None,
        granted_scopes: Vec::new(),
        last_error: None,
        is_paired: false,
        can_retry_with_device_token: false,
    }
}

fn failure_snapshot(
    endpoint: &GatewayEndpoint,
    device_id: &str,
    error: &GatewayError,
) -> GatewayStatusSnapshot {
    GatewayStatusSnapshot {
        phase: if error.connect_error_code().as_deref() == Some(CONNECT_ERROR_PAIRING_REQUIRED) {
            GatewayConnectionPhase::WaitingForApproval
        } else {
            GatewayConnectionPhase::Failed
        },
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(device_id.to_string()),
        granted_role: None,
        granted_scopes: Vec::new(),
        last_error: Some(GatewayErrorSummary::from_error(error)),
        is_paired: false,
        can_retry_with_device_token: error.can_retry_with_device_token(),
    }
}

fn random_hex_id() -> String {
    let mut bytes = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}



