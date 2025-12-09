use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRecord {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub database_path: PathBuf,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInput {
    pub name: String,
    pub description: Option<String>,
    pub database_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSelection {
    pub workspace_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "mode")]
pub enum OpenConfig {
    SystemDefault,
    CustomApp {
        executable: PathBuf,
        #[serde(default)]
        args: Vec<String>,
    },
    CustomCommand {
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
}

impl Default for OpenConfig {
    fn default() -> Self {
        Self::SystemDefault
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub path: PathBuf,
    pub description: Option<String>,
    pub open_config: OpenConfig,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub id: Option<Uuid>,
    pub name: String,
    pub path: PathBuf,
    pub description: Option<String>,
    #[serde(default)]
    pub open_config: OpenConfig,
}

#[derive(Debug, FromRow)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub open_config: String,
    pub created_at: String,
    pub updated_at: String,
}

fn default_font_size() -> u8 {
    16
}

fn default_accent_color() -> String {
    "#3b82f6".to_string()
}

fn default_zoom_level() -> u8 {
    100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

impl Default for ThemePreference {
    fn default() -> Self {
        Self::Light
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchPreset {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub config: OpenConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchPresetInput {
    pub id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub config: OpenConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub theme: ThemePreference,
    #[serde(default = "default_accent_color")]
    pub accent_color: String,
    #[serde(default = "default_zoom_level")]
    pub zoom_level: u8,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    #[serde(default)]
    pub launch_presets: Vec<LaunchPreset>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::Light,
            accent_color: default_accent_color(),
            zoom_level: default_zoom_level(),
            font_family: None,
            font_size: default_font_size(),
            launch_presets: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsUpdate {
    pub theme: ThemePreference,
    pub accent_color: String,
    pub zoom_level: u8,
    pub font_family: Option<String>,
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    #[serde(default)]
    pub launch_presets: Vec<LaunchPresetInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityPoint {
    pub date: String, // YYYY-MM-DD
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCount {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityStats {
    pub weekly_activity: Vec<ActivityPoint>,
    pub monthly_activity: Vec<ActivityPoint>,
    pub yearly_activity: Vec<ActivityPoint>,
    pub project_counts: Vec<ProjectCount>,
    pub total_launches: i64,
    pub total_projects: i64,
    pub average_daily_launches: f64,
}
