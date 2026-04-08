mod error;

use napi::bindgen_prelude::Either;
use napi_derive::napi;
use std::collections::HashMap;
use crate::error::RaxiosError;

use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    CLIENT.get_or_init(reqwest::Client::new)
}

#[napi(object)]
pub struct RaxiosResponse {
    pub status: u16,
    pub data: Either<String, napi::bindgen_prelude::Buffer>,
    pub headers: HashMap<String, String>,
}
#[napi]
pub async fn request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    timeout: Option<u32>,
    response_type: Option<String>,
) -> napi::Result<RaxiosResponse> {
    let client = get_client();
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &url),
        _ => {
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                format!("Invalid method: {}", method),
            ))
        }
    };

    if let Some(ms) = timeout {
        req = req.timeout(Duration::from_millis(ms as u64));
    }

    if let Some(b) = body {
        req = req.body(b);
    }

    if let Some(h) = headers {
        for (k, v) in h.iter() {
            req = req.header(k, v);
        }
    }

    let res = req
        .send()
        .await
        .map_err(|e| {
            napi::Error::new(
                napi::Status::GenericFailure,
                RaxiosError::from(e).to_string(),
            )
        })?;

    let status = res.status().as_u16();
    let is_success = res.status().is_success();

    let headers: HashMap<String, String> = res
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let response_type = response_type.as_deref().map(|value| value.to_ascii_lowercase());
    let is_binary = matches!(
        response_type.as_deref(),
        Some("arraybuffer") | Some("buffer") | Some("blob") | Some("bytes")
    );

    let data = if is_binary {
        let bytes = res
            .bytes()
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, RaxiosError::from(e).to_string()))?;
        Either::B(bytes.to_vec().into())
    } else {
        let text = res
            .text()
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, RaxiosError::from(e).to_string()))?;
        Either::A(text)
    };

    if !is_success {
        let error_obj = match &data {
            Either::A(text) => serde_json::json!({
                "status": status,
                "data": text,
                "headers": headers,
            }),
            Either::B(_) => serde_json::json!({
                "status": status,
                "data": "[binary data]",
                "headers": headers,
            }),
        };
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            error_obj.to_string(),
        ));
    }

    Ok(RaxiosResponse {
        status,
        data,
        headers,
    })
}
