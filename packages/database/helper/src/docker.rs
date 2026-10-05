use std::collections::BTreeMap;
use std::process::Output;
use std::time::Duration;

use serde_json::Value as Json;

use crate::error::{DatabaseError, Result};
use crate::tools;

const RUN_TIMEOUT: Duration = Duration::from_secs(20);

/// What `docker inspect` says about one container, reduced to what the helper reads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Inspected {
    pub id: String,
    pub name: String,
    pub image: String,
    pub running: bool,
    /// Per container port: the bindings on the host as (host IP, host port), empty when the port is not published.
    pub ports: BTreeMap<u16, Vec<(String, u16)>>,
    pub environment: BTreeMap<String, String>,
    pub labels: BTreeMap<String, String>,
}

/// The global flags that choose a Docker context.
pub fn context_arguments(context: Option<&str>) -> Vec<String> {
    match context {
        Some(context) if !context.is_empty() => vec!["--context".to_string(), context.to_string()],
        _ => Vec::new(),
    }
}

/// Runs `docker` and returns what it printed. `None` means docker is not installed.
pub async fn run(arguments: &[String]) -> Option<std::io::Result<Output>> {
    let mut command = tools::command("docker")?;
    command.args(arguments).stdin(std::process::Stdio::null()).kill_on_drop(true);

    Some(match tokio::time::timeout(RUN_TIMEOUT, command.output()).await {
        Ok(output) => output,
        Err(_) => Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "docker did not answer within 20 seconds")),
    })
}

pub fn missing_message() -> String {
    "Docker is not installed: the docker command was not found in PATH or in the usual install locations.".to_string()
}

/// What docker said on failure, trimmed; stdout when it left stderr empty.
pub fn failure_text(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stderr = stderr.trim();

    if !stderr.is_empty() {
        return stderr.to_string();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stdout = stdout.trim();

    if stdout.is_empty() {
        format!("docker exited with {}.", output.status)
    } else {
        stdout.to_string()
    }
}

/// Runs docker and returns its stdout, or the text it printed on failure.
pub async fn stdout_of(arguments: &[String]) -> std::result::Result<String, DockerFailure> {
    match run(arguments).await {
        None => Err(DockerFailure::Missing),
        Some(Err(e)) => Err(DockerFailure::Failed(format!("Could not run docker: {e}."))),
        Some(Ok(output)) if output.status.success() => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
        Some(Ok(output)) => Err(DockerFailure::Failed(failure_text(&output))),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DockerFailure {
    Missing,
    Failed(String),
}

impl DockerFailure {
    pub fn message(&self) -> String {
        match self {
            DockerFailure::Missing => missing_message(),
            DockerFailure::Failed(message) => message.clone(),
        }
    }

    pub fn into_tunnel_error(self) -> DatabaseError {
        DatabaseError::tunnel_failed(self.message())
    }
}

fn text_map(value: Option<&Json>) -> BTreeMap<String, String> {
    value
        .and_then(Json::as_object)
        .map(|object| {
            object
                .iter()
                .filter_map(|(key, value)| Some((key.clone(), value.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default()
}

fn tcp_port(key: &str) -> Option<u16> {
    key.strip_suffix("/tcp")?.parse().ok()
}

fn read_container(entry: &Json) -> Option<Inspected> {
    let config = entry.get("Config");
    let image = config.and_then(|config| config.get("Image")).and_then(Json::as_str).unwrap_or_default();
    let id: String = entry.get("Id")?.as_str()?.chars().take(12).collect();
    let name = entry.get("Name").and_then(Json::as_str).unwrap_or_default().trim_start_matches('/').to_string();

    let mut ports: BTreeMap<u16, Vec<(String, u16)>> = BTreeMap::new();

    if let Some(exposed) = config.and_then(|config| config.get("ExposedPorts")).and_then(Json::as_object) {
        for key in exposed.keys() {
            if let Some(port) = tcp_port(key) {
                ports.entry(port).or_default();
            }
        }
    }

    if let Some(published) = entry
        .get("NetworkSettings")
        .and_then(|settings| settings.get("Ports"))
        .and_then(Json::as_object)
    {
        for (key, bindings) in published {
            let Some(port) = tcp_port(key) else {
                continue;
            };
            let slot = ports.entry(port).or_default();

            for binding in bindings.as_array().into_iter().flatten() {
                let host_ip = binding.get("HostIp").and_then(Json::as_str).unwrap_or_default().to_string();
                let host_port = binding.get("HostPort").and_then(Json::as_str).and_then(|port| port.parse().ok());

                if let Some(host_port) = host_port {
                    slot.push((host_ip, host_port));
                }
            }
        }
    }

    let environment = config
        .and_then(|config| config.get("Env"))
        .and_then(Json::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Json::as_str)
                .filter_map(|entry| entry.split_once('='))
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Some(Inspected {
        id,
        name,
        image: image.to_string(),
        running: entry
            .get("State")
            .and_then(|state| state.get("Running"))
            .and_then(Json::as_bool)
            .unwrap_or(false),
        ports,
        environment,
        labels: text_map(config.and_then(|config| config.get("Labels"))),
    })
}

/// Parses the JSON array `docker inspect` prints.
pub fn parse_inspect(text: &str) -> Result<Vec<Inspected>> {
    let parsed: Json = serde_json::from_str(text).map_err(|e| DatabaseError::internal(format!("Could not read the output of docker inspect: {e}.")))?;

    Ok(parsed.as_array().into_iter().flatten().filter_map(read_container).collect())
}

/// The address on this machine behind which a published port listens.
pub fn local_address(host_ip: &str) -> String {
    match host_ip {
        "" | "0.0.0.0" | "::" | "[::]" => "127.0.0.1".to_string(),
        other => other.to_string(),
    }
}

impl Inspected {
    /// Where a published port can be reached from this machine, as (host, port).
    pub fn published(&self, port: u16) -> Option<(String, u16)> {
        let bindings = self.ports.get(&port)?;
        let preferred = bindings.iter().find(|(host_ip, _)| !host_ip.contains(':')).or_else(|| bindings.first())?;

        Some((local_address(&preferred.0), preferred.1))
    }
}

/// Whether the endpoint of a Docker context is on another machine, where published ports are not ours to connect to.
pub fn is_remote_endpoint(endpoint: &str) -> bool {
    let endpoint = endpoint.trim();

    !(endpoint.is_empty() || endpoint.starts_with("unix://") || endpoint.starts_with("npipe://"))
}

#[cfg(test)]
pub(crate) const SAMPLE_INSPECT: &str = r#"[
  {
    "Id": "54d5a9a2c9f92db5866926f24e216a5e0f14bad949b4b3880d2ed9806f8ebba7",
    "Name": "/shop_db_1",
    "State": { "Status": "running", "Running": true },
    "Config": {
      "Image": "docksal/mysql:8.0",
      "Env": ["PATH=/usr/bin", "MYSQL_USER=user", "MYSQL_PASSWORD=pa=ss", "MYSQL_DATABASE=default"],
      "ExposedPorts": { "3306/tcp": {}, "33060/tcp": {}, "53/udp": {} },
      "Labels": { "com.docker.compose.project": "shop", "com.docker.compose.service": "db" }
    },
    "NetworkSettings": {
      "Ports": {
        "3306/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "32768" }, { "HostIp": "::", "HostPort": "32768" }],
        "33060/tcp": null
      }
    }
  }
]"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_container() {
        let containers = parse_inspect(SAMPLE_INSPECT).unwrap();
        let container = &containers[0];

        assert_eq!(container.id, "54d5a9a2c9f9");
        assert_eq!(container.name, "shop_db_1");
        assert_eq!(container.image, "docksal/mysql:8.0");
        assert!(container.running);
        assert_eq!(container.environment["MYSQL_PASSWORD"], "pa=ss");
        assert_eq!(container.labels["com.docker.compose.project"], "shop");
        assert_eq!(container.ports.keys().copied().collect::<Vec<_>>(), vec![3306, 33060]);
        assert!(container.ports[&33060].is_empty());
    }

    #[test]
    fn a_published_port_is_reached_on_localhost() {
        let container = &parse_inspect(SAMPLE_INSPECT).unwrap()[0];

        assert_eq!(container.published(3306), Some(("127.0.0.1".to_string(), 32768)));
        assert_eq!(container.published(33060), None);
        assert_eq!(container.published(5432), None);
    }

    #[test]
    fn a_specific_host_ip_is_kept() {
        assert_eq!(local_address("192.168.1.5"), "192.168.1.5");
        assert_eq!(local_address("127.0.0.1"), "127.0.0.1");
        assert_eq!(local_address("::"), "127.0.0.1");
        assert_eq!(local_address("0.0.0.0"), "127.0.0.1");
    }

    #[test]
    fn a_stopped_container_and_an_empty_answer() {
        let stopped = SAMPLE_INSPECT.replace("\"Running\": true", "\"Running\": false");

        assert!(!parse_inspect(&stopped).unwrap()[0].running);
        assert!(parse_inspect("[]").unwrap().is_empty());
        assert!(parse_inspect("not json").is_err());
    }

    #[test]
    fn knows_remote_endpoints() {
        assert!(!is_remote_endpoint("unix:///var/run/docker.sock"));
        assert!(!is_remote_endpoint(""));
        assert!(is_remote_endpoint("tcp://1.2.3.4:2375"));
        assert!(is_remote_endpoint("ssh://me@host"));
    }

    #[test]
    fn builds_context_arguments() {
        assert_eq!(context_arguments(Some("remote")), vec!["--context", "remote"]);
        assert!(context_arguments(None).is_empty());
        assert!(context_arguments(Some("")).is_empty());
    }
}
