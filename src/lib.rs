mod error;

use napi_derive::napi;
use std::collections::HashMap;

use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    CLIENT.get_or_init(reqwest::Client::new)
}

#[napi(object)]
pub struct RaxiosResponse {
    pub status: u16,
    pub data: String,
    pub headers: HashMap<String, String>,
}
#[napi]
pub async fn request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    timeout: Option<u32>,
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
            if e.is_timeout() {
                napi::Error::new(napi::Status::GenericFailure, format!("timeout of {}ms exceeded", timeout.unwrap_or(0)))
            } else {
                napi::Error::new(napi::Status::GenericFailure, e.to_string())
            }
        })?;

    let status = res.status().as_u16();
    let is_success = res.status().is_success();

    let headers: HashMap<String, String> = res
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let data = res
        .text()
        .await
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    if !is_success {
        let error_obj = serde_json::json!({
            "status": status,
            "data": data,
            "headers": headers,
        });
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
