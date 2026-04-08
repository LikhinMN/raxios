use std::fmt;
#[derive(Debug)]
pub enum RaxiosError {
    Connection(String),
    Timeout(String),
    Response { status: u16, message: String },
    InvalidUrl(String),
    Parsing(String),
    Unknown(String),
}
impl From<reqwest::Error> for RaxiosError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            RaxiosError::Timeout(e.to_string())
        } else if e.is_connect() {
            RaxiosError::Connection(e.to_string())
        } else if e.is_builder() {
            RaxiosError::InvalidUrl(e.to_string())
        } else if e.is_decode() || e.is_body() {
            RaxiosError::Parsing(e.to_string())
        } else if e.is_status() {
            let status = e.status().unwrap().as_u16();
            RaxiosError::Response {
                status,
                message: e.to_string(),
            }
        } else {
            RaxiosError::Unknown(e.to_string())
        }
    }
}
impl fmt::Display for RaxiosError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            RaxiosError::Timeout(msg) => write!(f, "timeout: {}", msg),
            RaxiosError::Connection(msg) => write!(f, "Connection error: {}", msg),
            RaxiosError::InvalidUrl(msg) => write!(f, "Invalid URL: {}", msg),
            RaxiosError::Parsing(msg) => write!(f, "Parsing error: {}", msg),
            RaxiosError::Response { status, message } => write!(f, "HTTP {}: {}", status, message),
            RaxiosError::Unknown(msg) => write!(f, "Unknown error: {}", msg),
        }
    }
}
impl std::error::Error for RaxiosError {}