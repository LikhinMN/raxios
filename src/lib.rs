mod error;

use napi_derive::napi;

#[napi]
pub fn hello() -> String {
    "raxios works".to_string()
}