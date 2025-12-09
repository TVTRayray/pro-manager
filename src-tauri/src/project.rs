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
SELECT id, name, path, description, open_config, created_at, updated_at
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

pub async fn upsert_project(handle: &WorkspaceHandle, mut payload: ProjectInput) -> AppResult<Project> {
    // Sanitize paths
    payload.path = sanitize_path_buf(payload.path);
    if let OpenConfig::CustomApp { executable, .. } = &mut payload.open_config {
        *executable = sanitize_path_buf(executable.clone());
    }

    if payload.name.trim().is_empty() {
        return Err(AppError::Validation("project name cannot be empty".into()));
    }

    if !payload.path.exists() {
        return Err(AppError::Validation(format!(
            "project path does not exist: {}",
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

pub async fn get_project(handle: &WorkspaceHandle, project_id: Uuid) -> AppResult<Project> {
    fetch_project(&handle.pool, &project_id).await
}

pub async fn launch_project(
    handle: &WorkspaceHandle,
    project: &Project,
) -> AppResult<Option<std::process::Child>> {
    let child = match &project.open_config {
        OpenConfig::SystemDefault => {
            open_with_system(&project.path)?;
            None
        }
        OpenConfig::CustomApp { executable, args } => {
            Some(spawn_with_program(executable, args, &project.path)?)
        }
        OpenConfig::CustomCommand { command, args } => {
            Some(spawn_with_command(command, args, &project.path)?)
        }
    };

    let now = Utc::now().to_rfc3339();
    let project_id = project.id.to_string();

    sqlx::query("INSERT INTO launch_history (project_id, launched_at) VALUES (?, ?)")
        .bind(&project_id)
        .bind(&now)
        .execute(&handle.pool)
        .await?;

    Ok(child)
}

pub fn stop_project(child: &mut std::process::Child) -> AppResult<()> {
    child
        .kill()
        .map_err(|err| AppError::Launch(format!("failed to kill process: {err}")))
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
        .await
        .unwrap_or(0);

    let total_projects: i64 = sqlx::query_scalar("SELECT count(*) FROM projects")
        .fetch_one(&handle.pool)
        .await
        .unwrap_or(0);

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
            if !executable.exists() {
                return Err(AppError::Validation(format!(
                    "startup program not found: {}",
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

fn open_with_system(path: &Path) -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("explorer");
        command.arg(path);
        spawn_detached(command, "explorer")?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(path);
        spawn_detached(command, "open")?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        spawn_detached(command, "xdg-open")?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    {
        Err(AppError::Launch(
            "system open is not supported on this platform".to_string(),
        ))
    }
}

fn spawn_detached(mut command: Command, label: &str) -> AppResult<()> {
    command
        .spawn()
        .map(|_| ())
        .map_err(|err| AppError::Launch(format!("{label}: {err}")))
}

fn spawn_child(mut command: Command, label: &str) -> AppResult<std::process::Child> {
    command
        .spawn()
        .map_err(|err| AppError::Launch(format!("{label}: {err}")))
}
