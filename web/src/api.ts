import { invoke } from '@tauri-apps/api/core'
import type {
  ActivityStats,
  AppSettings,
  AppSettingsPayload,
  Project,
  ProjectInput,
  Workspace,
  WorkspaceInput,
} from './types'

export async function fetchWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>('list_workspaces')
}

export async function fetchActiveWorkspace(): Promise<Workspace | null> {
  return invoke<Workspace | null>('get_active_workspace')
}

export async function createWorkspace(
  payload: WorkspaceInput,
): Promise<Workspace> {
  return invoke<Workspace>('create_workspace', { payload })
}

export async function setActiveWorkspace(workspaceId: string): Promise<Workspace> {
  return invoke<Workspace>('set_active_workspace', { workspaceId })
}

export async function renameWorkspace(workspaceId: string, newName: string): Promise<Workspace> {
  return invoke<Workspace>('rename_workspace', { workspaceId, newName })
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await invoke('delete_workspace', { workspaceId })
}

export async function fetchProjects(
  workspaceId: string | null = null,
): Promise<Project[]> {
  return invoke<Project[]>('list_projects', {
    workspaceId,
  })
}

export async function upsertProject(
  payload: ProjectInput,
  workspaceId: string | null = null,
): Promise<Project> {
  return invoke<Project>('upsert_project', {
    workspaceId,
    payload,
  })
}

export async function deleteProject(
  projectId: string,
  workspaceId: string | null = null,
): Promise<string> {
  return invoke<string>('delete_project', {
    workspaceId,
    projectId,
  })
}

export async function launchProject(
  projectId: string,
  workspaceId: string | null = null,
): Promise<void> {
  await invoke('launch_project', {
    workspaceId,
    projectId,
  })
}

export async function fetchActivityStats(
  workspaceId: string | null = null,
): Promise<ActivityStats> {
  return invoke<ActivityStats>('get_activity_stats', {
    workspaceId,
  })
}

export async function fetchSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings')
}

export async function updateSettings(payload: AppSettingsPayload): Promise<AppSettings> {
  return invoke<AppSettings>('update_settings', { payload })
}

export async function stopProject(projectId: string): Promise<void> {
  await invoke('stop_project', { projectId })
}

export async function getRunningProjects(): Promise<string[]> {
  return await invoke('get_running_projects')
}

export const getActivityStats = fetchActivityStats;
