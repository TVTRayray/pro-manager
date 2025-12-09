use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    db::{apply_default_pragmas, init_workspace_schema},
    error::{AppError, AppResult},
    models::{
        AppSettings, AppSettingsUpdate, LaunchPreset, LaunchPresetInput, ThemePreference,
        WorkspaceInput, WorkspaceRecord,
    },
    project,
};

const CONFIG_FILENAME: &str = "workspaces.json";

#[derive(Debug, Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<AppStateInner>>,
}

#[derive(Debug)]
pub struct AppStateInner {
    base_dir: PathBuf,
    config_path: PathBuf,
    config: AppConfig,
    workspace_pools: HashMap<Uuid, SqlitePool>,
    pub running_processes: HashMap<Uuid, std::process::Child>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    #[serde(default)]
    workspaces: Vec<WorkspaceRecord>,
    active_workspace_id: Option<Uuid>,
    #[serde(default)]
    settings: AppSettings,
}

impl AppState {
    pub async fn initialise(base_dir: PathBuf) -> AppResult<Self> {
        if !base_dir.exists() {
            fs::create_dir_all(&base_dir)?;
        }
        let config_path = base_dir.join(CONFIG_FILENAME);

        let mut created_new_config = false;
        let mut settings_missing_in_file = false;
        let config = if config_path.exists() {
            let contents = fs::read(&config_path)?;
            if let Ok(text) = std::str::from_utf8(&contents) {
                settings_missing_in_file = !text.contains("\"settings\"");
            }
            serde_json::from_slice::<AppConfig>(&contents)?
        } else {
            created_new_config = true;
            AppConfig::bootstrap(&base_dir)?
        };

        let (mut config, mut config_changed) = config.ensure_active_id();
        config_changed |= config.ensure_settings(settings_missing_in_file);
        if created_new_config {
            config_changed = true;
        }

        let mut workspace_pools = HashMap::new();
        for workspace in &config.workspaces {
            if let Some(parent) = workspace.database_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }

            let options = apply_default_pragmas(
                SqliteConnectOptions::new().filename(&workspace.database_path),
            );
            let pool = SqlitePoolOptions::new()
                .max_connections(5)
                .connect_with(options)
                .await?;
            init_workspace_schema(&pool).await?;
            workspace_pools.insert(workspace.id, pool);
        }

        let inner = AppStateInner {
            base_dir,
            config_path,
            config,
            workspace_pools,
            running_processes: HashMap::new(),
        };
        let state = Self {
            inner: Arc::new(RwLock::new(inner)),
        };

        if config_changed {
            state.persist_config().await?;
        }

        Ok(state)
    }

    pub async fn list_workspaces(&self) -> Vec<WorkspaceRecord> {
        let inner = self.inner.read().await;
        inner.config.workspaces.clone()
    }

    pub async fn get_active_workspace(&self) -> Option<WorkspaceRecord> {
        let inner = self.inner.read().await;
        inner
            .config
            .active_workspace_id
            .and_then(|id| inner.config.find_workspace(id).cloned())
    }

    pub async fn set_active_workspace(&self, workspace_id: Uuid) -> AppResult<WorkspaceRecord> {
        let mut inner = self.inner.write().await;
        if inner.config.find_workspace(workspace_id).is_none() {
            return Err(AppError::WorkspaceNotFound(workspace_id.to_string()));
        }
        inner.config.active_workspace_id = Some(workspace_id);
        inner.persist_config()?;
        Ok(inner
            .config
            .find_workspace(workspace_id)
            .expect("workspace checked above")
            .clone())
    }

    pub async fn create_workspace(&self, payload: WorkspaceInput) -> AppResult<WorkspaceRecord> {
        if payload.name.trim().is_empty() {
            return Err(AppError::Validation(
                "workspace name cannot be empty".to_string(),
            ));
        }

        let mut inner = self.inner.write().await;
        if inner
            .config
            .workspaces
            .iter()
            .any(|ws| ws.name.eq_ignore_ascii_case(&payload.name))
        {
            return Err(AppError::Validation(format!(
                "workspace name '{}' already exists",
                payload.name
            )));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let database_path = match payload.database_path {
            Some(path) => path,
            None => inner.default_workspace_db_path(&id),
        };

        if let Some(parent) = database_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        let options =
            apply_default_pragmas(SqliteConnectOptions::new().filename(database_path.as_path()));
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;
        init_workspace_schema(&pool).await?;

        let record = WorkspaceRecord {
            id,
            name: payload.name,
            description: payload.description,
            database_path: database_path.clone(),
            created_at: now,
            updated_at: now,
        };

        inner.config.workspaces.push(record.clone());
        inner.workspace_pools.insert(id, pool);
        if inner.config.active_workspace_id.is_none() {
            inner.config.active_workspace_id = Some(id);
        }
        inner.persist_config()?;
        Ok(record)
    }

    pub async fn workspace_handle(&self, workspace_id: Option<Uuid>) -> AppResult<WorkspaceHandle> {
        let inner = self.inner.read().await;
        let id = match workspace_id {
            Some(id) => id,
            None => inner
                .config
                .active_workspace_id
                .ok_or_else(|| AppError::Validation("no active workspace selected".into()))?,
        };

        let meta = inner
            .config
            .find_workspace(id)
            .ok_or_else(|| AppError::WorkspaceNotFound(id.to_string()))?
            .clone();
        let pool = inner
            .workspace_pools
            .get(&id)
            .cloned()
            .ok_or_else(|| AppError::WorkspaceNotFound(id.to_string()))?;

        Ok(WorkspaceHandle { meta, pool })
    }

    pub async fn get_settings(&self) -> AppSettings {
        let inner = self.inner.read().await;
        inner.config.settings.clone()
    }

    pub async fn update_settings(&self, payload: AppSettingsUpdate) -> AppResult<AppSettings> {
        let mut inner = self.inner.write().await;

        let font_family = payload
            .font_family
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let font_size = payload.font_size.clamp(10, 28);

        let mut launch_presets: Vec<LaunchPreset> =
            Vec::with_capacity(payload.launch_presets.len());

        for mut preset in payload.launch_presets {
            let name = preset.name.trim();
            if name.is_empty() {
                return Err(AppError::Validation(
                    "launch preset name cannot be empty".into(),
                ));
            }

            // Sanitize executable path
            if let crate::models::OpenConfig::CustomApp { executable, .. } = &mut preset.config {
                *executable = project::sanitize_path_buf(executable.clone());
            }

            project::validate_open_config(&preset.config)?;

            let id = preset.id.unwrap_or_else(Uuid::new_v4);
            let description = preset.description.and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });

            launch_presets.push(LaunchPreset {
                id,
                name: name.to_string(),
                description,
                config: preset.config,
            });
        }

        inner.config.settings = AppSettings {
            theme: payload.theme,
            accent_color: payload.accent_color,
            zoom_level: payload.zoom_level,
            font_family,
            font_size,
            launch_presets,
        };
        inner.persist_config()?;
        Ok(inner.config.settings.clone())
    }

    pub async fn persist_config(&self) -> AppResult<()> {
        let inner = self.inner.read().await;
        inner.persist_config()
    }
}

#[derive(Debug, Clone)]
pub struct WorkspaceHandle {
    pub meta: WorkspaceRecord,
    pub pool: SqlitePool,
}

impl AppConfig {
    fn bootstrap(base_dir: &Path) -> AppResult<Self> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let workspace_dir = base_dir.join("workspaces").join(id.to_string());
        if !workspace_dir.exists() {
            fs::create_dir_all(&workspace_dir)?;
        }
        let database_path = workspace_dir.join("projects.sqlite");

        let default_workspace = WorkspaceRecord {
            id,
            name: "Default Workspace".to_string(),
            description: Some("Initial workspace".to_string()),
            database_path,
            created_at: now,
            updated_at: now,
        };

        Ok(Self {
            workspaces: vec![default_workspace.clone()],
            active_workspace_id: Some(default_workspace.id),
            settings: AppSettings::default(),
        })
    }

    fn ensure_active_id(mut self) -> (Self, bool) {
        if self.active_workspace_id.is_some() || self.workspaces.is_empty() {
            return (self, false);
        }
        let first_id = self.workspaces.first().map(|ws| ws.id);
        self.active_workspace_id = first_id;
        (self, true)
    }

    fn ensure_settings(&mut self, was_missing: bool) -> bool {
        let mut changed = was_missing;

        if self.settings.font_size < 10 || self.settings.font_size > 28 {
            self.settings.font_size = 16;
            changed = true;
        }

        if let Some(family) = &self.settings.font_family {
            let trimmed = family.trim();
            if trimmed.is_empty() {
                self.settings.font_family = None;
                changed = true;
            } else if trimmed != family {
                self.settings.font_family = Some(trimmed.to_string());
                changed = true;
            }
        }

        for preset in &mut self.settings.launch_presets {
            let trimmed_name = preset.name.trim();
            if trimmed_name != preset.name {
                preset.name = trimmed_name.to_string();
                changed = true;
            }
            if let Some(desc) = &preset.description {
                let trimmed_desc = desc.trim();
                if trimmed_desc.is_empty() {
                    preset.description = None;
                    changed = true;
                } else if trimmed_desc != desc {
                    preset.description = Some(trimmed_desc.to_string());
                    changed = true;
                }
            }
        }

        changed
    }

    fn find_workspace(&self, id: Uuid) -> Option<&WorkspaceRecord> {
        self.workspaces.iter().find(|ws| ws.id == id)
    }
}

impl AppStateInner {
    fn persist_config(&self) -> AppResult<()> {
        if let Some(parent) = self.config_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        let payload = serde_json::to_string_pretty(&self.config)?;
        fs::write(&self.config_path, payload)?;
        Ok(())
    }

    fn default_workspace_db_path(&self, id: &Uuid) -> PathBuf {
        self.base_dir
            .join("workspaces")
            .join(id.to_string())
            .join("projects.sqlite")
    }
}
