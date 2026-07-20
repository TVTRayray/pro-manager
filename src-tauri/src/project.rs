use std::{
    path::{Path, PathBuf},
    process::Command,
};

use chrono::{DateTime, Utc};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{ActivityPoint, ActivityStats, OpenConfig, Project, ProjectInput, ProjectRow},
    state::WorkspaceHandle,
};

const PROJECT_SELECT: &str = r#"
SELECT id, name, path, description, open_config, is_favourite, created_at, updated_at
FROM projects
"#;

pub fn sanitize_path_buf(path: PathBuf) -> PathBuf {
    let s = path.to_string_lossy();
    // Remove U+202A (Left-To-Right Embedding) and U+202C (Pop Directional Formatting)
    // capable of copy-paste from Windows explorer
    if s.contains('\u{202a}') || s.contains('\u{202c}') {
        let cleaned = s.replace('\u{202a}', "").replace('\u{202c}', "");
        return PathBuf::from(cleaned.trim());
    }
    path
}

pub async fn list_projects(handle: &WorkspaceHandle) -> AppResult<Vec<Project>> {
    let rows =
        sqlx::query_as::<_, ProjectRow>(&format!("{PROJECT_SELECT} ORDER BY name COLLATE NOCASE"))
            .fetch_all(&handle.pool)
            .await?;
    rows.into_iter().map(row_to_project).collect()
}

pub async fn upsert_project(
    handle: &WorkspaceHandle,
    mut payload: ProjectInput,
) -> AppResult<Project> {
    // Sanitize paths
    payload.path = sanitize_path_buf(payload.path);
    if let OpenConfig::CustomApp { executable, .. } = &mut payload.open_config {
        *executable = sanitize_path_buf(executable.clone());
    }

    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("project name cannot be empty".into()));
    }
    payload.name = payload.name.trim().to_string();

    if !payload.path.is_dir() {
        return Err(AppError::Validation(format!(
            "project path is not a directory: {}",
            payload.path.display()
        )));
    }

    validate_open_config(&payload.open_config)?;

    let open_config_json = serde_json::to_string(&payload.open_config)?;
    let path_str = normalise_path(payload.path);
    let now = Utc::now().to_rfc3339();

    let pool = &handle.pool;

    let project_id = if let Some(id) = payload.id {
        let id_str = id.to_string();
        let affected = sqlx::query(
            r#"
        UPDATE projects
        SET name = ?, path = ?, description = ?, open_config = ?, updated_at = ?
        WHERE id = ?
      "#,
        )
        .bind(&payload.name)
        .bind(&path_str)
        .bind(payload.description.as_deref())
        .bind(&open_config_json)
        .bind(&now)
        .bind(&id_str)
        .execute(pool)
        .await?
        .rows_affected();

        if affected == 0 {
            return Err(AppError::ProjectNotFound(id_str));
        }
        id
    } else {
        let id = Uuid::new_v4();
        let id_str = id.to_string();
        let created_at = now.clone();
        sqlx::query(
            r#"
        INSERT INTO projects (id, name, path, description, open_config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      "#,
        )
        .bind(&id_str)
        .bind(&payload.name)
        .bind(&path_str)
        .bind(payload.description.as_deref())
        .bind(&open_config_json)
        .bind(&created_at)
        .bind(&now)
        .execute(pool)
        .await?;
        id
    };

    fetch_project(pool, &project_id).await
}

pub async fn delete_project(handle: &WorkspaceHandle, project_id: Uuid) -> AppResult<Uuid> {
    let id_str = project_id.to_string();
    let affected = sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id_str)
        .execute(&handle.pool)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(AppError::ProjectNotFound(id_str));
    }
    Ok(project_id)
}

pub async fn set_project_favourite(
    handle: &WorkspaceHandle,
    project_id: Uuid,
    is_favourite: bool,
) -> AppResult<Project> {
    let id = project_id.to_string();
    let affected = sqlx::query("UPDATE projects SET is_favourite = ?, updated_at = ? WHERE id = ?")
        .bind(is_favourite)
        .bind(Utc::now().to_rfc3339())
        .bind(&id)
        .execute(&handle.pool)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(AppError::ProjectNotFound(id));
    }
    fetch_project(&handle.pool, &project_id).await
}

pub async fn get_project(handle: &WorkspaceHandle, project_id: Uuid) -> AppResult<Project> {
    fetch_project(&handle.pool, &project_id).await
}

pub async fn launch_project(
    handle: &WorkspaceHandle,
    project: &Project,
) -> AppResult<Option<std::process::Child>> {
    let (child, track_child) = match &project.open_config {
        OpenConfig::SystemDefault => (Some(open_with_system(&project.path)?), false),
        OpenConfig::CustomApp { executable, args } => (
            Some(spawn_with_program(executable, args, &project.path)?),
            true,
        ),
        OpenConfig::CustomCommand { command, args } => (
            Some(spawn_with_command(command, args, &project.path)?),
            true,
        ),
    };

    let now = Utc::now().to_rfc3339();
    let project_id = project.id.to_string();

    if let Err(error) =
        sqlx::query("INSERT INTO launch_history (project_id, launched_at) VALUES (?, ?)")
            .bind(&project_id)
            .bind(&now)
            .execute(&handle.pool)
            .await
    {
        if let Some(mut child) = child {
            let cleanup = if track_child {
                stop_project(&mut child)
            } else {
                stop_direct_child(&mut child)
            };
            if let Err(cleanup_error) = cleanup {
                return Err(AppError::Launch(format!(
                    "{error}; failed to clean up launched process: {cleanup_error}"
                )));
            }
        }
        return Err(error.into());
    }

    if track_child {
        Ok(child)
    } else {
        if let Some(mut child) = child {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
        Ok(None)
    }
}

pub fn stop_project(child: &mut std::process::Child) -> AppResult<()> {
    #[cfg(unix)]
    {
        let process_group = i32::try_from(child.id())
            .map_err(|_| AppError::Launch("process id is outside the Unix pid range".into()))?;
        // SAFETY: spawn_child creates a process group whose id is the child's pid.
        if unsafe { libc::kill(-process_group, libc::SIGKILL) } != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ESRCH) {
                return Err(AppError::Launch(format!(
                    "failed to kill process group: {error}"
                )));
            }
        }
    }
    #[cfg(not(unix))]
    child
        .kill()
        .map_err(|err| AppError::Launch(format!("failed to kill process: {err}")))?;
    child
        .wait()
        .map_err(|err| AppError::Launch(format!("failed to wait for process: {err}")))?;
    Ok(())
}

fn stop_direct_child(child: &mut std::process::Child) -> AppResult<()> {
    child
        .kill()
        .map_err(|err| AppError::Launch(format!("failed to kill process: {err}")))?;
    child
        .wait()
        .map_err(|err| AppError::Launch(format!("failed to wait for process: {err}")))?;
    Ok(())
}

pub async fn get_activity_stats(handle: &WorkspaceHandle) -> AppResult<ActivityStats> {
    // 1. Get all launches in the last year
    let rows = sqlx::query(
        r#"
        SELECT date(launched_at) as day, count(*) as count
        FROM launch_history
        WHERE launched_at > date('now', '-365 days')
        GROUP BY day
        ORDER BY day ASC
        "#,
    )
    .fetch_all(&handle.pool)
    .await?;

    let mut map = std::collections::HashMap::new();
    for row in rows {
        let day: String = row.get("day");
        let count: i64 = row.get("count");
        map.insert(day, count as u32);
    }

    // 2. Generate activity vectors
    let generate_activity = |days: i64| -> Vec<ActivityPoint> {
        let mut activity = Vec::new();
        for i in (0..days).rev() {
            let date = Utc::now() - chrono::Duration::days(i);
            let date_str = date.format("%Y-%m-%d").to_string();
            let count = map.get(&date_str).cloned().unwrap_or(0);
            activity.push(ActivityPoint {
                date: date_str,
                count,
            });
        }
        activity
    };

    let weekly_activity = generate_activity(7);
    let monthly_activity = generate_activity(30);
    let yearly_activity = generate_activity(365);

    // 3. Total stats
    let total_launches: i64 = sqlx::query_scalar("SELECT count(*) FROM launch_history")
        .fetch_one(&handle.pool)
        .await?;

    let total_projects: i64 = sqlx::query_scalar("SELECT count(*) FROM projects")
        .fetch_one(&handle.pool)
        .await?;

    // 4. Project counts
    let project_rows = sqlx::query(
        r#"
        SELECT p.name, count(lh.id) as count
        FROM projects p
        LEFT JOIN launch_history lh ON p.id = lh.project_id
        GROUP BY p.id
        ORDER BY count DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&handle.pool)
    .await?;

    let project_counts = project_rows
        .into_iter()
        .map(|row| crate::models::ProjectCount {
            name: row.get("name"),
            count: row.get("count"),
        })
        .collect();

    // 5. Average daily launches (based on last 30 days active days or just simple average)
    // Let's do simple average over last 30 days
    let last_30_days_launches: u32 = monthly_activity.iter().map(|p| p.count).sum();
    let average_daily_launches = last_30_days_launches as f64 / 30.0;

    Ok(ActivityStats {
        weekly_activity,
        monthly_activity,
        yearly_activity,
        project_counts,
        total_launches,
        total_projects,
        average_daily_launches,
    })
}

async fn fetch_project(pool: &SqlitePool, project_id: &Uuid) -> AppResult<Project> {
    let id_str = project_id.to_string();
    let row = sqlx::query_as::<_, ProjectRow>(&format!("{PROJECT_SELECT} WHERE id = ?"))
        .bind(&id_str)
        .fetch_one(pool)
        .await?;
    row_to_project(row)
}

fn row_to_project(row: ProjectRow) -> AppResult<Project> {
    let id = Uuid::parse_str(&row.id)
        .map_err(|err| AppError::Validation(format!("invalid project id '{}': {err}", row.id)))?;
    let created_at = parse_timestamp(&row.created_at)?;
    let updated_at = parse_timestamp(&row.updated_at)?;
    let open_config: OpenConfig = serde_json::from_str(&row.open_config)?;
    Ok(Project {
        id,
        name: row.name,
        path: PathBuf::from(row.path),
        description: row.description,
        open_config,
        is_favourite: row.is_favourite,
        created_at,
        updated_at,
    })
}

fn parse_timestamp(value: &str) -> AppResult<DateTime<Utc>> {
    Ok(DateTime::parse_from_rfc3339(value)
        .map_err(|err| AppError::Validation(format!("invalid timestamp '{}': {err}", value)))?
        .with_timezone(&Utc))
}

fn normalise_path(path: PathBuf) -> String {
    path.to_string_lossy().to_string()
}

pub(crate) fn validate_open_config(config: &OpenConfig) -> AppResult<()> {
    match config {
        OpenConfig::SystemDefault => Ok(()),
        OpenConfig::CustomApp { executable, .. } => {
            if executable.as_os_str().is_empty() {
                return Err(AppError::Validation(
                    "startup program cannot be empty".to_string(),
                ));
            }
            if !executable.is_file() {
                return Err(AppError::Validation(format!(
                    "startup program is not a file: {}",
                    executable.display()
                )));
            }
            Ok(())
        }
        OpenConfig::CustomCommand { command, .. } => {
            if command.trim().is_empty() {
                return Err(AppError::Validation(
                    "custom command cannot be empty".to_string(),
                ));
            }
            Ok(())
        }
    }
}

fn spawn_with_program(
    executable: &Path,
    args: &[String],
    project_path: &Path,
) -> AppResult<std::process::Child> {
    let mut command = Command::new(executable);
    command.args(args.iter());
    command.arg(project_path);
    let label = format!("program {}", executable.display());
    spawn_child(command, &label)
}

fn spawn_with_command(
    command_name: &str,
    args: &[String],
    project_path: &Path,
) -> AppResult<std::process::Child> {
    let mut command = Command::new(command_name);
    command.args(args.iter());
    command.current_dir(project_path); // Set CWD for custom commands
    spawn_child(command, command_name)
}

fn open_with_system(path: &Path) -> AppResult<std::process::Child> {
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("explorer");
        command.arg(path);
        return spawn_detached(command, "explorer");
    }
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(path);
        return spawn_detached(command, "open");
    }
    #[cfg(target_os = "linux")]
    {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        return spawn_detached(command, "xdg-open");
    }
    #[allow(unreachable_code)]
    {
        Err(AppError::Launch(
            "system open is not supported on this platform".to_string(),
        ))
    }
}

fn spawn_detached(mut command: Command, label: &str) -> AppResult<std::process::Child> {
    command
        .spawn()
        .map_err(|err| AppError::Launch(format!("{label}: {err}")))
}

fn spawn_child(mut command: Command, label: &str) -> AppResult<std::process::Child> {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    command
        .spawn()
        .map_err(|err| AppError::Launch(format!("{label}: {err}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db::init_workspace_schema, state::WorkspaceHandle};
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn updates_and_returns_project_favourite() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        init_workspace_schema(&pool).await.unwrap();
        let id = Uuid::new_v4();
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO projects (id, name, path, open_config, created_at, updated_at) VALUES (?, 'Project', '/tmp', ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(serde_json::to_string(&OpenConfig::SystemDefault).unwrap())
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await
        .unwrap();
        let handle = WorkspaceHandle {
            id: Uuid::new_v4(),
            pool,
        };

        let project = set_project_favourite(&handle, id, true).await.unwrap();

        assert!(project.is_favourite);
        assert!(get_project(&handle, id).await.unwrap().is_favourite);
    }

    #[tokio::test]
    async fn trims_names_and_validates_project_and_app_paths() {
        let root = std::env::temp_dir().join(format!("pro-manager-project-{}", Uuid::new_v4()));
        let project_path = root.join("project");
        let executable = root.join("editor");
        std::fs::create_dir_all(&project_path).unwrap();
        std::fs::write(&executable, []).unwrap();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        init_workspace_schema(&pool).await.unwrap();
        let handle = WorkspaceHandle {
            id: Uuid::new_v4(),
            pool,
        };

        let saved = upsert_project(
            &handle,
            ProjectInput {
                id: None,
                name: "  Project  ".into(),
                path: project_path,
                description: None,
                open_config: OpenConfig::CustomApp {
                    executable: executable.clone(),
                    args: Vec::new(),
                },
            },
        )
        .await
        .unwrap();
        assert_eq!(saved.name, "Project");

        let error = upsert_project(
            &handle,
            ProjectInput {
                id: None,
                name: "Invalid".into(),
                path: executable,
                description: None,
                open_config: OpenConfig::SystemDefault,
            },
        )
        .await
        .unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));

        let error = upsert_project(
            &handle,
            ProjectInput {
                id: None,
                name: "Invalid app".into(),
                path: saved.path,
                description: None,
                open_config: OpenConfig::CustomApp {
                    executable: root.clone(),
                    args: Vec::new(),
                },
            },
        )
        .await
        .unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));

        handle.pool.close().await;
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[cfg(unix)]
    fn tracked_children_use_their_own_process_group() {
        let mut command = Command::new("sh");
        command.arg("-c").arg("sleep 30");
        let mut child = spawn_child(command, "test child").unwrap();
        let pid = child.id() as i32;

        // SAFETY: getpgid only reads process metadata for the spawned child.
        assert_eq!(unsafe { libc::getpgid(pid) }, pid);
        stop_project(&mut child).unwrap();
        // SAFETY: signal 0 only checks whether the reaped child pid still exists.
        assert_eq!(unsafe { libc::kill(pid, 0) }, -1);
    }
}
