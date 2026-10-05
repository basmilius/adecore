//! Tunnels for MySQL connections: the system's `ssh -W`, and Docker through a published port or `docker exec`.
//!
//! A tunnel belongs to the session that asked for it. Dropping it stops the listener and kills every process it started.

use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::tcp::OwnedWriteHalf;
use tokio::net::{TcpListener, TcpStream};
use tokio::process::ChildStdout;
use tokio::task::{JoinHandle, JoinSet};

use crate::docker::{self, DockerFailure};
use crate::error::{DatabaseError, Result};
use crate::protocol::{DockerTunnel, SshTunnel, Tunnel as TunnelConfig};
use crate::tools;

const EXIT_GRACE: Duration = Duration::from_secs(2);
const STDERR_LIMIT: u64 = 16 * 1024;
const COPY_BUFFER: usize = 16 * 1024;

/// A program with its arguments, as started for every connection through a listener.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: &'static str,
    pub arguments: Vec<String>,
}

fn reject_leading_dash(label: &str, value: &str) -> Result<()> {
    if value.is_empty() {
        return Err(DatabaseError::invalid_request(format!("The {label} of a tunnel must not be empty.")));
    }

    if value.starts_with('-') {
        return Err(DatabaseError::invalid_request(format!("The {label} of a tunnel must not start with a dash.")));
    }

    Ok(())
}

/// `ssh -W` wants IPv6 addresses in brackets.
fn forward_target(host: &str, port: u16) -> String {
    if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]:{port}")
    } else {
        format!("{host}:{port}")
    }
}

pub fn ssh_command(tunnel: &SshTunnel, host: &str, port: u16) -> CommandSpec {
    let mut arguments = vec![
        "-W".to_string(),
        forward_target(host, port),
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ExitOnForwardFailure=yes".to_string(),
    ];

    if let Some(port) = tunnel.port {
        arguments.extend(["-p".to_string(), port.to_string()]);
    }

    if let Some(user) = tunnel.user.as_ref().filter(|user| !user.is_empty()) {
        arguments.extend(["-l".to_string(), user.clone()]);
    }

    if let Some(identity_file) = tunnel.identity_file.as_ref().filter(|file| !file.is_empty()) {
        arguments.extend(["-i".to_string(), identity_file.clone()]);
    }

    arguments.push(tunnel.host.clone());

    CommandSpec { program: "ssh", arguments }
}

pub fn docker_inspect_arguments(tunnel: &DockerTunnel) -> Vec<String> {
    let mut arguments = docker::context_arguments(tunnel.context.as_deref());
    arguments.extend(["inspect".to_string(), "--type".to_string(), "container".to_string(), tunnel.container.clone()]);

    arguments
}

pub fn docker_exec_command(tunnel: &DockerTunnel, port: u16) -> CommandSpec {
    let mut arguments = docker::context_arguments(tunnel.context.as_deref());
    arguments.extend([
        "exec".to_string(),
        "-i".to_string(),
        tunnel.container.clone(),
        "bash".to_string(),
        "-c".to_string(),
        format!("exec 3<>/dev/tcp/127.0.0.1/{port}; cat <&3 & cat >&3; kill $! 2>/dev/null"),
    ]);

    CommandSpec { program: "docker", arguments }
}

#[derive(Default)]
struct Failures {
    first: Mutex<Option<String>>,
}

impl Failures {
    fn record(&self, message: String) {
        let mut first = self.first.lock().unwrap_or_else(|poisoned| poisoned.into_inner());

        first.get_or_insert(message);
    }

    fn get(&self) -> Option<String> {
        self.first.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).clone()
    }
}

/// The local address a MySQL connection is made to, and what keeps it served.
pub struct Tunnel {
    host: String,
    port: u16,
    failures: Arc<Failures>,
    server: Option<JoinHandle<()>>,
}

impl Drop for Tunnel {
    fn drop(&mut self) {
        if let Some(server) = &self.server {
            server.abort();
        }
    }
}

impl Tunnel {
    /// Brings the tunnel up for a server at `host:port` as the far end sees it.
    pub async fn start(config: &TunnelConfig, host: &str, port: u16) -> Result<Tunnel> {
        match config {
            TunnelConfig::Ssh(ssh) => {
                reject_leading_dash("host", &ssh.host)?;

                if tools::find("ssh").is_none() {
                    return Err(DatabaseError::tunnel_failed("ssh was not found in PATH or in the usual install locations."));
                }

                Tunnel::listen(ssh_command(ssh, host, port)).await
            }
            TunnelConfig::Docker(container) => {
                reject_leading_dash("container", &container.container)?;

                Tunnel::through_docker(container).await
            }
        }
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Why a connection through the tunnel went wrong, when a process of the tunnel said.
    pub fn failure(&self) -> Option<DatabaseError> {
        self.failures.get().map(DatabaseError::tunnel_failed)
    }

    async fn through_docker(tunnel: &DockerTunnel) -> Result<Tunnel> {
        let port = tunnel.port.unwrap_or(3306);
        let inspected = docker::stdout_of(&docker_inspect_arguments(tunnel))
            .await
            .map_err(DockerFailure::into_tunnel_error)?;
        let container = docker::parse_inspect(&inspected)?
            .into_iter()
            .next()
            .ok_or_else(|| DatabaseError::tunnel_failed(format!("No such container: {}", tunnel.container)))?;

        if !container.running {
            return Err(DatabaseError::tunnel_failed(format!("The container \"{}\" is not running.", container.name)));
        }

        if let Some((host, host_port)) = container.published(port)
            && !Tunnel::is_remote_daemon(tunnel).await
        {
            return Ok(Tunnel {
                host,
                port: host_port,
                failures: Arc::default(),
                server: None,
            });
        }

        if tools::find("docker").is_none() {
            return Err(DatabaseError::tunnel_failed(docker::missing_message()));
        }

        Tunnel::listen(docker_exec_command(tunnel, port)).await
    }

    /// A published port lives on the machine of the daemon; for a remote daemon that is not this one.
    async fn is_remote_daemon(tunnel: &DockerTunnel) -> bool {
        let mut arguments = docker::context_arguments(tunnel.context.as_deref());
        arguments.extend([
            "context".to_string(),
            "inspect".to_string(),
            "--format".to_string(),
            "{{.Endpoints.docker.Host}}".to_string(),
        ]);

        docker::stdout_of(&arguments).await.is_ok_and(|endpoint| docker::is_remote_endpoint(&endpoint))
    }

    async fn listen(spec: CommandSpec) -> Result<Tunnel> {
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|e| DatabaseError::tunnel_failed(format!("Could not open a local port for the tunnel: {e}.")))?;
        let port = listener
            .local_addr()
            .map_err(|e| DatabaseError::tunnel_failed(format!("Could not open a local port for the tunnel: {e}.")))?
            .port();
        let failures = Arc::new(Failures::default());
        let server = tokio::spawn(serve(listener, spec, failures.clone()));

        Ok(Tunnel {
            host: "127.0.0.1".to_string(),
            port,
            failures,
            server: Some(server),
        })
    }
}

async fn serve(listener: TcpListener, spec: CommandSpec, failures: Arc<Failures>) {
    let spec = Arc::new(spec);
    let mut connections = JoinSet::new();

    loop {
        tokio::select! {
            accepted = listener.accept() => match accepted {
                Ok((socket, _)) => {
                    connections.spawn(carry(socket, spec.clone(), failures.clone()));
                }
                Err(e) => {
                    eprintln!("adecore-database: the tunnel stopped accepting connections: {e}");

                    return;
                }
            },
            Some(_) = connections.join_next(), if !connections.is_empty() => {}
        }
    }
}

enum Ended {
    /// The process closed its output: the far end hung up, or the process died.
    Process,
    /// The client closed its side.
    Client,
}

/// Pipes one accepted connection through a process of its own.
async fn carry(socket: TcpStream, spec: Arc<CommandSpec>, failures: Arc<Failures>) {
    let Some(mut command) = tools::command(spec.program) else {
        failures.record(format!("{} was not found in PATH or in the usual install locations.", spec.program));

        return;
    };

    command
        .args(&spec.arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(e) => {
            failures.record(format!("Could not start {}: {e}.", spec.program));

            return;
        }
    };

    let (Some(mut stdin), Some(mut stdout), Some(stderr)) = (child.stdin.take(), child.stdout.take(), child.stderr.take()) else {
        return;
    };

    let errors = tokio::spawn(async move {
        let mut text = Vec::new();
        let _ = stderr.take(STDERR_LIMIT).read_to_end(&mut text).await;

        String::from_utf8_lossy(&text).trim().to_string()
    });

    let (mut reader, mut writer) = socket.into_split();
    let received = AtomicU64::new(0);

    let ended = tokio::select! {
        _ = tokio::io::copy(&mut reader, &mut stdin) => Ended::Client,
        _ = forward_output(&mut stdout, &mut writer, &received) => Ended::Process,
    };

    if matches!(ended, Ended::Client) {
        // The last thing a client sends (COM_QUIT) may still sit in the pipe; closing the input lets the process pass it on and end by itself.
        drop(stdin);
        let _ = tokio::time::timeout(EXIT_GRACE, child.wait()).await;
    }

    if matches!(ended, Ended::Process) && received.load(Ordering::Relaxed) == 0 {
        match tokio::time::timeout(EXIT_GRACE, child.wait()).await {
            Ok(Ok(status)) if !status.success() => {
                let said = tokio::time::timeout(EXIT_GRACE, errors)
                    .await
                    .ok()
                    .and_then(|text| text.ok())
                    .unwrap_or_default();

                failures.record(if said.is_empty() {
                    format!("{} stopped with {status}.", spec.program)
                } else {
                    said
                });
            }
            Ok(Err(e)) => failures.record(format!("Could not wait for {}: {e}.", spec.program)),
            _ => {}
        }
    }

    let _ = writer.shutdown().await;
}

async fn forward_output(stdout: &mut ChildStdout, writer: &mut OwnedWriteHalf, received: &AtomicU64) -> std::io::Result<()> {
    let mut buffer = vec![0u8; COPY_BUFFER];

    loop {
        let read = stdout.read(&mut buffer).await?;

        if read == 0 {
            return Ok(());
        }

        received.fetch_add(read as u64, Ordering::Relaxed);
        writer.write_all(&buffer[..read]).await?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ssh(host: &str) -> SshTunnel {
        SshTunnel {
            host: host.to_string(),
            port: None,
            user: None,
            identity_file: None,
        }
    }

    #[test]
    fn builds_the_minimal_ssh_command() {
        let spec = ssh_command(&ssh("production"), "db.internal", 3306);

        assert_eq!(spec.program, "ssh");
        assert_eq!(
            spec.arguments,
            ["-W", "db.internal:3306", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "production"]
        );
    }

    #[test]
    fn builds_the_full_ssh_command() {
        let tunnel = SshTunnel {
            host: "production".to_string(),
            port: Some(2222),
            user: Some("deploy".to_string()),
            identity_file: Some("/Users/demo/.ssh/id_ed25519".to_string()),
        };
        let spec = ssh_command(&tunnel, "127.0.0.1", 3307);

        assert_eq!(
            spec.arguments,
            [
                "-W",
                "127.0.0.1:3307",
                "-o",
                "BatchMode=yes",
                "-o",
                "ExitOnForwardFailure=yes",
                "-p",
                "2222",
                "-l",
                "deploy",
                "-i",
                "/Users/demo/.ssh/id_ed25519",
                "production"
            ]
        );
    }

    #[test]
    fn brackets_an_ipv6_target() {
        assert_eq!(ssh_command(&ssh("jump"), "::1", 3306).arguments[1], "[::1]:3306");
        assert_eq!(forward_target("[::1]", 3306), "[::1]:3306");
    }

    #[test]
    fn leaves_out_empty_ssh_options() {
        let tunnel = SshTunnel {
            host: "production".to_string(),
            port: None,
            user: Some(String::new()),
            identity_file: Some(String::new()),
        };

        assert_eq!(ssh_command(&tunnel, "db", 3306).arguments.len(), 7);
    }

    #[test]
    fn builds_docker_arguments() {
        let tunnel = DockerTunnel {
            container: "shop_db_1".to_string(),
            port: None,
            context: Some("remote".to_string()),
        };

        assert_eq!(
            docker_inspect_arguments(&tunnel),
            ["--context", "remote", "inspect", "--type", "container", "shop_db_1"]
        );

        let spec = docker_exec_command(&tunnel, 3306);

        assert_eq!(spec.program, "docker");
        assert_eq!(
            spec.arguments,
            [
                "--context",
                "remote",
                "exec",
                "-i",
                "shop_db_1",
                "bash",
                "-c",
                "exec 3<>/dev/tcp/127.0.0.1/3306; cat <&3 & cat >&3; kill $! 2>/dev/null"
            ]
        );
    }

    #[test]
    fn builds_docker_arguments_without_a_context() {
        let tunnel = DockerTunnel {
            container: "db".to_string(),
            port: Some(3307),
            context: None,
        };

        assert_eq!(docker_inspect_arguments(&tunnel), ["inspect", "--type", "container", "db"]);
        assert_eq!(docker_exec_command(&tunnel, 3307).arguments[..3], ["exec", "-i", "db"]);
    }

    #[test]
    fn refuses_a_name_that_would_pass_as_an_option() {
        assert!(reject_leading_dash("host", "-oProxyCommand=evil").is_err());
        assert!(reject_leading_dash("host", "").is_err());
        assert!(reject_leading_dash("host", "production").is_ok());
    }
}
