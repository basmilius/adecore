use std::env;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

/// Where an app started from the Dock still finds `docker` and `ssh`: its PATH is minimal there.
pub const FALLBACK_DIRECTORIES: [&str; 4] = [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/Applications/Docker.app/Contents/Resources/bin",
    "/usr/bin",
];

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        path.metadata()
            .is_ok_and(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
    }

    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// The directories to look in: the ones of `path` first, then the fallbacks that it lacks.
pub fn search_directories(path: Option<&OsStr>) -> Vec<PathBuf> {
    let mut directories: Vec<PathBuf> = path
        .map(|path| env::split_paths(path).filter(|dir| !dir.as_os_str().is_empty()).collect())
        .unwrap_or_default();

    for fallback in FALLBACK_DIRECTORIES {
        let fallback = PathBuf::from(fallback);

        if !directories.contains(&fallback) {
            directories.push(fallback);
        }
    }

    directories
}

/// The first executable called `name` in the directories of `path` and then in the fallbacks.
pub fn find_in(name: &str, path: Option<&OsStr>) -> Option<PathBuf> {
    search_directories(path)
        .into_iter()
        .map(|directory| directory.join(name))
        .find(|candidate| is_executable(candidate))
}

pub fn find(name: &str) -> Option<PathBuf> {
    find_in(name, env::var_os("PATH").as_deref())
}

/// A PATH that includes the fallbacks, so a tool that starts helpers of its own finds them too.
pub fn extended_path() -> OsString {
    env::join_paths(search_directories(env::var_os("PATH").as_deref())).unwrap_or_default()
}

/// A command for an installed tool, with the rest of the environment passed through.
pub fn command(name: &str) -> Option<tokio::process::Command> {
    let program = find(name)?;
    let mut command = tokio::process::Command::new(program);
    command.env("PATH", extended_path());

    Some(command)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn make_executable(path: &Path) {
        use std::os::unix::fs::PermissionsExt;

        std::fs::write(path, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[test]
    fn fallbacks_follow_the_path_without_repeating() {
        let directories = search_directories(Some(OsStr::new("/custom/bin:/usr/local/bin")));

        assert_eq!(directories[0], PathBuf::from("/custom/bin"));
        assert_eq!(directories[1], PathBuf::from("/usr/local/bin"));
        assert_eq!(
            directories
                .iter()
                .filter(|directory| directory.as_path() == Path::new("/usr/local/bin"))
                .count(),
            1
        );
        assert!(directories.contains(&PathBuf::from("/opt/homebrew/bin")));
        assert!(directories.contains(&PathBuf::from("/Applications/Docker.app/Contents/Resources/bin")));
        assert_eq!(directories.last().unwrap(), &PathBuf::from("/usr/bin"));
    }

    #[test]
    fn a_missing_path_still_has_the_fallbacks() {
        assert_eq!(search_directories(None).len(), FALLBACK_DIRECTORIES.len());
    }

    #[cfg(unix)]
    #[test]
    fn finds_an_executable_in_the_path_first() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        make_executable(&first.path().join("adecore-tool"));
        make_executable(&second.path().join("adecore-tool"));
        let path = env::join_paths([first.path(), second.path()]).unwrap();

        assert_eq!(find_in("adecore-tool", Some(&path)), Some(first.path().join("adecore-tool")));
        assert_eq!(find_in("adecore-no-such-tool", Some(&path)), None);
    }

    #[cfg(unix)]
    #[test]
    fn skips_a_file_that_is_not_executable() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(directory.path().join("adecore-plain"), "").unwrap();

        assert_eq!(find_in("adecore-plain", Some(directory.path().as_os_str())), None);
    }
}
