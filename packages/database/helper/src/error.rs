use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
    InvalidRequest,
    UnknownSession,
    ConnectFailed,
    AuthFailed,
    QueryFailed,
    ReadOnly,
    NoRowKey,
    Conflict,
    Cancelled,
    Unsupported,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sql_state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub change: Option<usize>,
}

pub type Result<T> = std::result::Result<T, DatabaseError>;

impl DatabaseError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        DatabaseError {
            code,
            message: message.into(),
            sql_state: None,
            change: None,
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidRequest, message)
    }

    pub fn unknown_session(session: &str) -> Self {
        Self::new(ErrorCode::UnknownSession, format!("Unknown session \"{session}\"."))
    }

    pub fn connect_failed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::ConnectFailed, message)
    }

    pub fn query_failed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::QueryFailed, message)
    }

    pub fn cancelled() -> Self {
        Self::new(ErrorCode::Cancelled, "The request was cancelled.")
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }

    pub fn with_sql_state(mut self, sql_state: impl Into<String>) -> Self {
        self.sql_state = Some(sql_state.into());
        self
    }

    pub fn with_change(mut self, change: usize) -> Self {
        self.change = Some(change);
        self
    }
}

impl fmt::Display for DatabaseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for DatabaseError {}

impl From<rusqlite::Error> for DatabaseError {
    fn from(error: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(failure, _) = &error
            && failure.code == rusqlite::ErrorCode::OperationInterrupted
        {
            return DatabaseError::cancelled();
        }

        DatabaseError::query_failed(error.to_string())
    }
}

impl From<mysql_async::Error> for DatabaseError {
    fn from(error: mysql_async::Error) -> Self {
        match error {
            mysql_async::Error::Server(server) => DatabaseError::query_failed(server.message).with_sql_state(server.state),
            other => DatabaseError::query_failed(other.to_string()),
        }
    }
}
