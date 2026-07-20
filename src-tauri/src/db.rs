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
      is_favourite INTEGER NOT NULL DEFAULT 0,
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

    let has_favourite: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('projects') WHERE name = 'is_favourite')",
    )
    .fetch_one(pool)
    .await?;
    if !has_favourite {
        sqlx::query("ALTER TABLE projects ADD COLUMN is_favourite INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await?;
    }

    Ok(())
}

pub fn apply_default_pragmas(
    options: sqlx::sqlite::SqliteConnectOptions,
) -> sqlx::sqlite::SqliteConnectOptions {
    options
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(std::time::Duration::from_secs(5))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn adds_favourite_to_existing_projects_table() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, description TEXT, open_config TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO projects VALUES ('id', 'name', '/tmp', NULL, '{}', 'now', 'now')")
            .execute(&pool)
            .await
            .unwrap();

        init_workspace_schema(&pool).await.unwrap();
        init_workspace_schema(&pool).await.unwrap();

        let favourite: bool =
            sqlx::query_scalar("SELECT is_favourite FROM projects WHERE id = 'id'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(!favourite);
    }

    #[tokio::test]
    async fn enables_foreign_keys() {
        let options =
            apply_default_pragmas(sqlx::sqlite::SqliteConnectOptions::new()).filename(":memory:");
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();
        let enabled: bool = sqlx::query_scalar("PRAGMA foreign_keys")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(enabled);
    }
}
