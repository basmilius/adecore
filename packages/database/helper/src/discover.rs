//! Finds running Docker containers that look like database servers.

use crate::docker::{self, DockerFailure, Inspected};
use crate::error::{DatabaseError, Result};
use crate::protocol::{ContainerPort, DiscoverParams, DiscoverResult, DockerContainer, EngineName, SuggestedLogin};

const DATABASE_IMAGES: [&str; 3] = ["mysql", "mariadb", "percona"];
const MYSQL_PORT: u16 = 3306;

fn image_looks_like_a_database(image: &str) -> bool {
    let repository = image.split('@').next().unwrap_or_default().to_lowercase();

    DATABASE_IMAGES.iter().any(|name| repository.contains(name))
}

fn first_of(inspected: &Inspected, names: &[&str]) -> Option<String> {
    names.iter().find_map(|name| inspected.environment.get(*name)).cloned()
}

fn flag_set(inspected: &Inspected, names: &[&str]) -> bool {
    first_of(inspected, names).is_some_and(|value| matches!(value.to_lowercase().as_str(), "1" | "yes" | "true"))
}

/// The login the image's own variables create: the app user when there is one, else root.
pub fn suggested_login(inspected: &Inspected) -> SuggestedLogin {
    let database = first_of(inspected, &["MYSQL_DATABASE", "MARIADB_DATABASE"]);

    if let Some(user) = first_of(inspected, &["MYSQL_USER", "MARIADB_USER"]) {
        return SuggestedLogin {
            user: Some(user),
            password: first_of(inspected, &["MYSQL_PASSWORD", "MARIADB_PASSWORD"]),
            database,
        };
    }

    let root_password = first_of(inspected, &["MYSQL_ROOT_PASSWORD", "MARIADB_ROOT_PASSWORD"]);
    let empty_root_password = flag_set(inspected, &["MYSQL_ALLOW_EMPTY_PASSWORD", "MARIADB_ALLOW_EMPTY_ROOT_PASSWORD"]);

    if root_password.is_some() || empty_root_password {
        return SuggestedLogin {
            user: Some("root".to_string()),
            password: root_password,
            database,
        };
    }

    SuggestedLogin {
        database,
        ..SuggestedLogin::default()
    }
}

/// The container as the protocol lists it, or `None` when it does not look like a database server.
pub fn describe(inspected: &Inspected) -> Option<DockerContainer> {
    if !inspected.running || !(image_looks_like_a_database(&inspected.image) || inspected.ports.contains_key(&MYSQL_PORT)) {
        return None;
    }

    Some(DockerContainer {
        id: inspected.id.clone(),
        name: inspected.name.clone(),
        image: inspected.image.clone(),
        engine: Some(EngineName::Mysql),
        ports: inspected
            .ports
            .iter()
            .map(|(container, bindings)| ContainerPort {
                container: *container,
                host: bindings.first().map(|(_, host)| *host),
            })
            .collect(),
        project: inspected.labels.get("com.docker.compose.project").cloned(),
        service: inspected.labels.get("com.docker.compose.service").cloned(),
        suggested: suggested_login(inspected),
    })
}

fn unsupported(failure: DockerFailure) -> DatabaseError {
    DatabaseError::unsupported(failure.message())
}

pub async fn discover(params: DiscoverParams) -> Result<DiscoverResult> {
    let mut list = docker::context_arguments(params.context.as_deref());
    list.extend(["ps".to_string(), "--quiet".to_string()]);

    let listed = docker::stdout_of(&list).await.map_err(unsupported)?;
    let ids: Vec<&str> = listed.split_whitespace().collect();

    if ids.is_empty() {
        return Ok(DiscoverResult { containers: Vec::new() });
    }

    let mut inspect = docker::context_arguments(params.context.as_deref());
    inspect.extend(["inspect".to_string(), "--type".to_string(), "container".to_string()]);
    inspect.extend(ids.iter().map(|id| id.to_string()));

    // A container that stopped since the listing makes the exit code fail but leaves the others in stdout.
    let output = match docker::run(&inspect).await {
        None => return Err(unsupported(DockerFailure::Missing)),
        Some(Err(e)) => return Err(DatabaseError::unsupported(format!("Could not run docker: {e}."))),
        Some(Ok(output)) => output,
    };
    let text = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() && text.trim().len() <= 2 {
        return Err(DatabaseError::unsupported(docker::failure_text(&output)));
    }

    let mut containers: Vec<DockerContainer> = docker::parse_inspect(&text)?.iter().filter_map(describe).collect();
    containers.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(DiscoverResult { containers })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docker::{SAMPLE_INSPECT, parse_inspect};

    fn container(json: &str) -> Inspected {
        parse_inspect(json).unwrap().remove(0)
    }

    fn environment(entries: &[&str]) -> Inspected {
        let mut inspected = container(SAMPLE_INSPECT);
        inspected.environment = entries
            .iter()
            .filter_map(|entry| entry.split_once('='))
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect();

        inspected
    }

    #[test]
    fn describes_a_compose_container() {
        let described = describe(&container(SAMPLE_INSPECT)).unwrap();

        assert_eq!(described.id, "54d5a9a2c9f9");
        assert_eq!(described.name, "shop_db_1");
        assert_eq!(described.engine, Some(EngineName::Mysql));
        assert_eq!(
            described.ports,
            vec![
                ContainerPort {
                    container: 3306,
                    host: Some(32768)
                },
                ContainerPort { container: 33060, host: None }
            ]
        );
        assert_eq!(described.project.as_deref(), Some("shop"));
        assert_eq!(described.service.as_deref(), Some("db"));
        assert_eq!(
            described.suggested,
            SuggestedLogin {
                user: Some("user".to_string()),
                password: Some("pa=ss".to_string()),
                database: Some("default".to_string())
            }
        );
    }

    #[test]
    fn serializes_like_the_fixture() {
        let described = describe(&container(SAMPLE_INSPECT)).unwrap();
        let json = serde_json::to_value(&described).unwrap();

        assert_eq!(
            json["ports"],
            serde_json::json!([{ "container": 3306, "host": 32768 }, { "container": 33060, "host": null }])
        );
        assert_eq!(json["engine"], "mysql");
    }

    #[test]
    fn keeps_a_database_image_without_ports() {
        let mut inspected = container(SAMPLE_INSPECT);
        inspected.ports.clear();
        inspected.image = "mariadb:11".to_string();

        let described = describe(&inspected).unwrap();

        assert!(described.ports.is_empty());
    }

    #[test]
    fn keeps_a_container_that_exposes_3306() {
        let mut inspected = container(SAMPLE_INSPECT);
        inspected.image = "acme/data-store:2".to_string();

        assert!(describe(&inspected).is_some());

        inspected.ports.remove(&3306);

        assert!(describe(&inspected).is_none());
    }

    #[test]
    fn drops_what_is_not_a_database_or_not_running() {
        let mut inspected = container(SAMPLE_INSPECT);
        inspected.running = false;

        assert!(describe(&inspected).is_none());

        let mut web = container(SAMPLE_INSPECT);
        web.image = "nginx:1.27".to_string();
        web.ports.clear();

        assert!(describe(&web).is_none());
    }

    #[test]
    fn recognizes_the_usual_images() {
        for image in [
            "mysql:8.4",
            "mariadb:11",
            "percona/percona-server:8.0",
            "docker.io/library/MySQL:5.7",
            "bitnami/mariadb@sha256:abc",
        ] {
            assert!(image_looks_like_a_database(image), "{image}");
        }

        assert!(!image_looks_like_a_database("postgres:16"));
        assert!(!image_looks_like_a_database("redis:7"));
    }

    #[test]
    fn suggests_the_app_user_first() {
        let login = suggested_login(&environment(&[
            "MARIADB_USER=app",
            "MARIADB_PASSWORD=pw",
            "MARIADB_DATABASE=appdb",
            "MARIADB_ROOT_PASSWORD=root",
        ]));

        assert_eq!(login.user.as_deref(), Some("app"));
        assert_eq!(login.password.as_deref(), Some("pw"));
        assert_eq!(login.database.as_deref(), Some("appdb"));
    }

    #[test]
    fn prefers_the_mysql_variables() {
        let login = suggested_login(&environment(&["MYSQL_USER=a", "MARIADB_USER=b"]));

        assert_eq!(login.user.as_deref(), Some("a"));
        assert_eq!(login.password, None);
    }

    #[test]
    fn falls_back_to_root() {
        let login = suggested_login(&environment(&["MYSQL_ROOT_PASSWORD=secret", "MYSQL_DATABASE=shop"]));

        assert_eq!(login.user.as_deref(), Some("root"));
        assert_eq!(login.password.as_deref(), Some("secret"));
        assert_eq!(login.database.as_deref(), Some("shop"));

        let login = suggested_login(&environment(&["MARIADB_ROOT_PASSWORD=other"]));

        assert_eq!(login.password.as_deref(), Some("other"));

        let login = suggested_login(&environment(&["MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1"]));

        assert_eq!(login.user.as_deref(), Some("root"));
        assert_eq!(login.password, None);
    }

    #[test]
    fn suggests_nothing_without_variables() {
        assert_eq!(suggested_login(&environment(&["PATH=/usr/bin"])), SuggestedLogin::default());
    }
}
