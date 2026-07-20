use std::{
    collections::HashSet,
    env,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};

use crate::models::{LaunchPresetInput, OpenConfig};

const GUI_EDITORS: &[(&str, &[&str])] = &[
    ("Kate", &["kate"]),
    ("GVim", &["gvim"]),
    ("IntelliJ IDEA", &["idea"]),
    ("PyCharm", &["pycharm"]),
    ("Visual Studio Code", &["code"]),
    ("Visual Studio Code OSS", &["code-oss"]),
    ("VSCodium", &["codium"]),
    ("Zed", &["zeditor", "zed"]),
    ("Sublime Text", &["subl", "sublime", "sublime_text"]),
    ("Emacs", &["emacs"]),
    ("Cursor", &["cursor"]),
];

const TERMINALS: &[&str] = &[
    "konsole",
    "gnome-terminal",
    "kitty",
    "alacritty",
    "wezterm",
    "xterm",
];

pub fn detect_editor_presets() -> Vec<LaunchPresetInput> {
    let paths = env::var_os("PATH")
        .map(|path| env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default();
    detect_in_paths(&paths)
}

fn detect_in_paths(paths: &[PathBuf]) -> Vec<LaunchPresetInput> {
    let mut presets = Vec::new();
    let mut seen = HashSet::new();

    for &(name, commands) in GUI_EDITORS {
        if let Some(executable) = commands
            .iter()
            .find_map(|command| find_executable(paths, command))
        {
            push_preset(&mut presets, &mut seen, name, executable, Vec::new());
        }
    }

    if let Some(terminal) = TERMINALS
        .iter()
        .find_map(|command| find_executable(paths, command))
    {
        for (name, command) in [("Vim", "vim"), ("Neovim", "nvim")] {
            if let Some(editor) = find_executable(paths, command) {
                if let Some(args) = terminal_args(&terminal, &editor) {
                    push_preset(&mut presets, &mut seen, name, terminal.clone(), args);
                }
            }
        }
    }

    presets
}

fn push_preset(
    presets: &mut Vec<LaunchPresetInput>,
    seen: &mut HashSet<PathBuf>,
    name: &str,
    executable: PathBuf,
    args: Vec<String>,
) {
    if seen.insert(executable.clone()) || !args.is_empty() {
        presets.push(LaunchPresetInput {
            id: None,
            name: name.to_string(),
            description: None,
            config: OpenConfig::CustomApp { executable, args },
        });
    }
}

fn find_executable(paths: &[PathBuf], command: &str) -> Option<PathBuf> {
    find_executable_with_extensions(paths, command, &executable_extensions())
}

fn find_executable_with_extensions(
    paths: &[PathBuf],
    command: &str,
    extensions: &[OsString],
) -> Option<PathBuf> {
    paths.iter().find_map(|directory| {
        let path = directory.join(command);
        if is_executable(&path) {
            return Some(path);
        }
        extensions.iter().find_map(|extension| {
            let mut candidate = OsString::from(command);
            candidate.push(extension);
            let path = directory.join(candidate);
            is_executable(&path).then_some(path)
        })
    })
}

fn executable_extensions() -> Vec<OsString> {
    #[cfg(windows)]
    {
        let mut extensions = env::var_os("PATHEXT")
            .map(|value| {
                value
                    .to_string_lossy()
                    .split(';')
                    .filter(|value| !value.is_empty())
                    .map(OsString::from)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        for extension in [".exe", ".cmd", ".bat"] {
            if !extensions
                .iter()
                .any(|value| value.eq_ignore_ascii_case(extension))
            {
                extensions.push(extension.into());
            }
        }
        extensions
    }
    #[cfg(not(windows))]
    Vec::new()
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    true
}

fn terminal_args(terminal: &Path, editor: &Path) -> Option<Vec<String>> {
    let editor = editor.to_str()?.to_string();
    let terminal = terminal.file_name().and_then(OsStr::to_str)?;
    Some(match terminal {
        "gnome-terminal" => vec!["--".into(), editor],
        "kitty" => vec![editor],
        "wezterm" => vec!["start".into(), "--".into(), editor],
        _ => vec!["-e".into(), editor],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(unix)]
    fn executable(directory: &Path, name: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let path = directory.join(name);
        fs::write(&path, []).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    #[test]
    #[cfg(unix)]
    fn detects_gui_and_terminal_editors_without_resolving_paths() {
        let root = env::temp_dir().join(format!("pro-manager-editors-{}", uuid::Uuid::new_v4()));
        let first = root.join("first");
        let second = root.join("second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir_all(&second).unwrap();
        let code = executable(&first, "code");
        executable(&second, "code");
        let terminal = executable(&first, "konsole");
        let nvim = executable(&second, "nvim");

        let presets = detect_in_paths(&[first.clone(), second.clone(), first]);

        assert_eq!(presets.len(), 2);
        match &presets[0].config {
            OpenConfig::CustomApp { executable, args } => {
                assert_eq!(executable, &code);
                assert!(args.is_empty());
            }
            _ => panic!("expected custom app"),
        }
        match &presets[1].config {
            OpenConfig::CustomApp { executable, args } => {
                assert_eq!(executable, &terminal);
                assert_eq!(args, &["-e", nvim.to_str().unwrap()]);
            }
            _ => panic!("expected terminal custom app"),
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn executable_lookup_uses_supplied_platform_extensions() {
        let root = env::temp_dir().join(format!("pro-manager-shims-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let shim = root.join("code.cmd");
        fs::write(&shim, []).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&shim, fs::Permissions::from_mode(0o755)).unwrap();
        }

        assert_eq!(
            find_executable_with_extensions(&[root.clone()], "code", &[".cmd".into()]),
            Some(shim)
        );
        fs::remove_dir_all(root).unwrap();
    }
}
