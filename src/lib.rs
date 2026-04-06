mod error;

use napi_derive::napi;
use std::collections::HashMap;

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
) -> napi::Result<RaxiosResponse> {
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => {
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                format!("Invalid method: {}", method),
            ))
        }
    };

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
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    let status = res.status().as_u16();

    let headers = res
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let data = res
        .text()
        .await
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    Ok(RaxiosResponse {
        status,
        data,
        headers,
    })
}
