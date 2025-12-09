use crate::error::AppResult;
use sqlx::{sqlite::SqliteJournalMode, SqlitePool};

pub async fn init_workspace_schema(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query(
        r#"
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      open_config TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS launch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      launched_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub fn apply_default_pragmas(
    options: sqlx::sqlite::SqliteConnectOptions,
) -> sqlx::sqlite::SqliteConnectOptions {
    options
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(5))
}
