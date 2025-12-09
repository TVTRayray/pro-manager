use tauri::State;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{
        ActivityStats, AppSettings, AppSettingsUpdate, Project, ProjectInput, WorkspaceInput,
        WorkspaceRecord,
    },
    project,
    state::AppState,
};

#[tauri::command]
pub async fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<WorkspaceRecord>, AppError> {
    Ok(state.list_workspaces().await)
}

#[tauri::command]
pub async fn get_active_workspace(
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceRecord>, AppError> {
    Ok(state.get_active_workspace().await)
}

#[tauri::command]
pub async fn create_workspace(
    state: State<'_, AppState>,
    payload: WorkspaceInput,
) -> Result<WorkspaceRecord, AppError> {
    state.create_workspace(payload).await
}

#[tauri::command]
pub async fn set_active_workspace(
    state: State<'_, AppState>,
    workspace_id: Uuid,
) -> Result<WorkspaceRecord, AppError> {
    state.set_active_workspace(workspace_id).await
}

#[tauri::command]
pub async fn list_projects(
    state: State<'_, AppState>,
    workspace_id: Option<Uuid>,
) -> Result<Vec<Project>, AppError> {
    let handle = state.workspace_handle(workspace_id).await?;
    project::list_projects(&handle).await
}

#[tauri::command]
pub async fn upsert_project(
    state: State<'_, AppState>,
    workspace_id: Option<Uuid>,
    payload: ProjectInput,
) -> Result<Project, AppError> {
    let handle = state.workspace_handle(workspace_id).await?;
    project::upsert_project(&handle, payload).await
}

#[tauri::command]
pub async fn delete_project(
    state: State<'_, AppState>,
    workspace_id: Option<Uuid>,
    project_id: Uuid,
) -> AppResult<Uuid> {
    let handle = state.workspace_handle(workspace_id).await?;
    project::delete_project(&handle, project_id).await
}

#[tauri::command]
pub async fn launch_project(
    state: State<'_, AppState>,
    workspace_id: Option<Uuid>,
    project_id: Uuid,
) -> AppResult<()> {
    let handle = state.workspace_handle(workspace_id).await?;
    let project = project::get_project(&handle, project_id).await?;
    
    // Check if already running
    {
        let mut inner = state.inner.write().await;
        if let Some(child) = inner.running_processes.get_mut(&project_id) {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // Process finished, remove it
                    inner.running_processes.remove(&project_id);
                }
                Ok(None) => {
                    // Still running
                    return Ok(());
                }
                Err(_) => {
                    inner.running_processes.remove(&project_id);
                }
            }
        }
    }

    if let Some(child) = project::launch_project(&handle, &project).await? {
        let mut inner = state.inner.write().await;
        inner.running_processes.insert(project_id, child);
    }
    
    Ok(())
}

#[tauri::command]
pub async fn stop_project(
    state: State<'_, AppState>,
    project_id: Uuid,
) -> AppResult<()> {
    let mut inner = state.inner.write().await;
    if let Some(child) = inner.running_processes.get_mut(&project_id) {
        project::stop_project(child)?;
        inner.running_processes.remove(&project_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_running_projects(state: State<'_, AppState>) -> Result<Vec<Uuid>, AppError> {
    let mut inner = state.inner.write().await;
    let mut running = Vec::new();
    let mut to_remove = Vec::new();

    for (id, child) in inner.running_processes.iter_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                to_remove.push(*id);
            }
            Ok(None) => {
                running.push(*id);
            }
            Err(_) => {
                to_remove.push(*id);
            }
        }
    }

    for id in to_remove {
        inner.running_processes.remove(&id);
    }

    Ok(running)
}

#[tauri::command]
pub async fn get_activity_stats(
    state: State<'_, AppState>,
    workspace_id: Option<Uuid>,
) -> Result<ActivityStats, AppError> {
    let handle = state.workspace_handle(workspace_id).await?;
    project::get_activity_stats(&handle).await
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    Ok(state.get_settings().await)
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    payload: AppSettingsUpdate,
) -> AppResult<AppSettings> {
    state.update_settings(payload).await
}
