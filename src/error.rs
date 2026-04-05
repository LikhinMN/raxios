use napi::Status;

#[derive(Debug)]
pub enum RaxiosError {
    ConnectionError(String),
    TimeoutError(String),
    ResponseError { status: u16, message: String },
    InvalidUrlError(String),
    ParsingError(String),
    UnknownError(String),
}

impl From<reqwest::Error> for RaxiosError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            return RaxiosError::TimeoutError(e.to_string());
        }
        if e.is_connect() {
            return RaxiosError::ConnectionError(e.to_string());
        }
        if e.is_builder() {
            return RaxiosError::InvalidUrlError(e.to_string());
        }
        if e.is_decode() || e.is_body() {
            return RaxiosError::ParsingError(e.to_string());
        }
        if let Some(status) = e.status() {
            return RaxiosError::ResponseError {
                status: status.as_u16(),
                message: e.to_string(),
            };
        }
        RaxiosError::UnknownError(e.to_string())
    }
}

impl From<RaxiosError> for napi::Error {
    fn from(err: RaxiosError) -> Self {
        match err {
            RaxiosError::ConnectionError(msg) => napi::Error::new(Status::GenericFailure, msg),
            RaxiosError::TimeoutError(msg) => napi::Error::new(Status::GenericFailure, msg),
            RaxiosError::ResponseError { status, message } => {
                napi::Error::new(Status::GenericFailure, format!("{}: {}", status, message))
            }
            RaxiosError::InvalidUrlError(msg) => napi::Error::new(Status::InvalidArg, msg),
            RaxiosError::ParsingError(msg) => napi::Error::new(Status::GenericFailure, msg),
            RaxiosError::UnknownError(msg) => napi::Error::new(Status::GenericFailure, msg),
        }
    }
}