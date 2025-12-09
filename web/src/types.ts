export type ViewMode = 'grid' | 'list'

export interface Workspace {
  id: string
  name: string
  description?: string | null
  databasePath: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceInput {
  name: string
  description?: string | null
  databasePath?: string | null
}

export type OpenConfig =
  | {
    mode: 'system_default'
  }
  | {
    mode: 'custom_app'
    executable: string
    args: string[]
  }
  | {
    mode: 'custom_command'
    command: string
    args: string[]
  }

export interface Project {
  id: string
  name: string
  path: string
  description?: string | null
  openConfig: OpenConfig
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  id?: string
  name: string
  path: string
  description?: string | null
  openConfig: OpenConfig
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface LaunchPreset {
  id: string
  name: string
  description?: string | null
  config: OpenConfig
}

export interface LaunchPresetInput {
  id?: string
  name: string
  description?: string | null
  config: OpenConfig
}

export interface AppSettings {
  theme: ThemePreference
  accentColor: string
  zoomLevel: number
  fontFamily?: string | null
  fontSize: number
  launchPresets: LaunchPreset[]
}

export interface AppSettingsPayload {
  theme: ThemePreference
  accentColor: string
  zoomLevel: number
  fontFamily?: string | null
  fontSize: number
  launchPresets: LaunchPresetInput[]
}

export interface ActivityPoint {
  date: string
  count: number
}

export interface ProjectCount {
  name: string
  count: number
}

export interface ActivityStats {
  weeklyActivity: ActivityPoint[]
  monthlyActivity: ActivityPoint[]
  yearlyActivity: ActivityPoint[]
  projectCounts: ProjectCount[]
  totalLaunches: number
  totalProjects: number
  averageDailyLaunches: number
}
