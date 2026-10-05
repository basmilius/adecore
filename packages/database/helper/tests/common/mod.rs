#![allow(dead_code)]

use std::sync::Arc;

use adecore_database_helper::dispatcher::Dispatcher;
use serde_json::{Value, json};

pub struct Client {
    pub dispatcher: Arc<Dispatcher>,
    next: u32,
}

impl Client {
    pub fn new() -> Self {
        Client {
            dispatcher: Arc::new(Dispatcher::new()),
            next: 0,
        }
    }

    pub fn next_id(&mut self) -> String {
        self.next += 1;

        format!("r{}", self.next)
    }

    /// Sends a request and returns the whole response.
    pub async fn request(&mut self, method: &str, params: Value) -> Value {
        let id = self.next_id();
        self.raw(&json!({ "id": id, "method": method, "params": params }).to_string()).await
    }

    pub async fn raw(&self, line: &str) -> Value {
        serde_json::from_str(&self.dispatcher.submit(line).await).expect("the answer is JSON")
    }

    /// The result of a request that must succeed.
    pub async fn ok(&mut self, method: &str, params: Value) -> Value {
        let response = self.request(method, params).await;
        assert_eq!(response["ok"], json!(true), "{method} failed: {response}");

        response["result"].clone()
    }

    /// The error code of a request that must fail.
    pub async fn error(&mut self, method: &str, params: Value) -> Value {
        let response = self.request(method, params).await;
        assert_eq!(response["ok"], json!(false), "{method} succeeded: {response}");

        response["error"].clone()
    }

    pub async fn open(&mut self, connection: Value) -> String {
        let result = self.ok("open", json!({ "connection": connection })).await;

        result["session"].as_str().expect("a session id").to_string()
    }
}

pub mod scenarios;
