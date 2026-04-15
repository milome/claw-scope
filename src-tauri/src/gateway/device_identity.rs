use std::convert::TryInto;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use ed25519_dalek::{Signer, SigningKey};
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};

use crate::gateway::{
    errors::GatewayError,
    store::{
        load_stored_device_identity, store_device_identity, GatewayStorePaths, StoredDeviceIdentity,
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GatewayDeviceIdentity {
    pub device_id: String,
    pub public_key_base64url: String,
    pub secret_key_base64url: String,
}

impl GatewayDeviceIdentity {
    pub fn load_or_create(paths: &GatewayStorePaths) -> Result<Self, GatewayError> {
        if let Some(stored) = load_stored_device_identity(paths)?
            && stored.version == 1
            && let Ok(identity) = Self::from_stored(&stored)
        {
            if identity.device_id != stored.device_id {
                store_device_identity(
                    paths,
                    &StoredDeviceIdentity {
                        version: 1,
                        device_id: identity.device_id.clone(),
                        public_key: identity.public_key_base64url.clone(),
                        secret_key: identity.secret_key_base64url.clone(),
                        created_at_ms: stored.created_at_ms,
                    },
                )?;
            }
            return Ok(identity);
        }

        let identity = Self::generate();
        store_device_identity(
            paths,
            &StoredDeviceIdentity {
                version: 1,
                device_id: identity.device_id.clone(),
                public_key: identity.public_key_base64url.clone(),
                secret_key: identity.secret_key_base64url.clone(),
                created_at_ms: Utc::now().timestamp_millis(),
            },
        )?;
        Ok(identity)
    }

    pub fn from_stored(stored: &StoredDeviceIdentity) -> Result<Self, GatewayError> {
        let public_key = decode_fixed_base64url::<32>(&stored.public_key, "public key")?;
        let _secret_key = decode_fixed_base64url::<32>(&stored.secret_key, "secret key")?;
        Ok(Self {
            device_id: derive_device_id_from_public_key(&public_key),
            public_key_base64url: stored.public_key.clone(),
            secret_key_base64url: stored.secret_key.clone(),
        })
    }

    pub fn signing_key(&self) -> Result<SigningKey, GatewayError> {
        let secret_key = decode_fixed_base64url::<32>(&self.secret_key_base64url, "secret key")?;
        Ok(SigningKey::from_bytes(&secret_key))
    }

    pub fn sign_payload(&self, payload: &str) -> Result<String, GatewayError> {
        let signing_key = self.signing_key()?;
        let signature = signing_key.sign(payload.as_bytes());
        Ok(URL_SAFE_NO_PAD.encode(signature.to_bytes()))
    }

    fn generate() -> Self {
        let mut secret_key = [0_u8; 32];
        OsRng.fill_bytes(&mut secret_key);
        let signing_key = SigningKey::from_bytes(&secret_key);
        let public_key = signing_key.verifying_key().to_bytes();
        Self {
            device_id: derive_device_id_from_public_key(&public_key),
            public_key_base64url: URL_SAFE_NO_PAD.encode(public_key),
            secret_key_base64url: URL_SAFE_NO_PAD.encode(secret_key),
        }
    }
}

pub fn derive_device_id_from_public_key(public_key: &[u8]) -> String {
    let digest = Sha256::digest(public_key);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn decode_fixed_base64url<const N: usize>(
    value: &str,
    label: &str,
) -> Result<[u8; N], GatewayError> {
    let decoded = URL_SAFE_NO_PAD.decode(value).map_err(|error| GatewayError::DeviceIdentity {
        message: format!("failed decoding {label}: {error}"),
    })?;
    decoded.as_slice().try_into().map_err(|_| GatewayError::DeviceIdentity {
        message: format!("{label} has unexpected length"),
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::gateway::store::GatewayStorePaths;
    use rand::RngCore;

    fn temp_paths() -> GatewayStorePaths {
        let mut suffix = [0_u8; 8];
        rand::thread_rng().fill_bytes(&mut suffix);
        let root = std::env::temp_dir().join(format!(
            "claw-scope-device-identity-test-{}",
            suffix.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
        ));
        GatewayStorePaths::from_root(root)
    }

    #[test]
    fn derives_device_id_from_known_public_key_bytes() {
        let public_key = (1_u8..=32).collect::<Vec<_>>();
        let device_id = derive_device_id_from_public_key(&public_key);
        assert_eq!(
            device_id,
            "ae216c2ef5247a3782c135efa279a3e4cdc61094270f5d2be58c6204b7a612c9"
        );
    }

    #[test]
    fn load_or_create_reuses_existing_identity() {
        let paths = temp_paths();
        let first = GatewayDeviceIdentity::load_or_create(&paths).expect("create identity");
        let second = GatewayDeviceIdentity::load_or_create(&paths).expect("load identity");
        assert_eq!(first, second);
        let _ = fs::remove_dir_all(paths.root);
    }
}
