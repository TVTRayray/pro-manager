# AGENT.md

This file is for coding agents working in this repository. It is generated from the existing codegraph and local project configuration.

## Project Shape

Pro Manager is a Tauri v2 desktop app:

- `src-tauri/`: Rust backend, Tauri app setup, SQLite access, workspace/project state, process launching.
- `web/`: React 19 + Vite frontend, Tailwind CSS UI, Tauri `invoke` API wrappers.
- Persistent data:
  - `workspaces.json` under Tauri `app_data_dir()` stores workspace metadata, active workspace, and app settings.
  - Each workspace has its own SQLite database with `projects` and `launch_history` tables.

## Main Execution Flow

Backend startup:

- `src-tauri/src/main.rs` calls `app_lib::run()`.
- `src-tauri/src/lib.rs::run` builds the Tauri app, installs dialog/log plugins, configures tray behavior, initializes `AppState`, registers commands, and hides the main window instead of closing it.
- `AppState::initialise` loads or creates `workspaces.json`, opens workspace SQLite pools, and runs `init_workspace_schema`.

Frontend startup:

- `web/src/main.tsx` renders `App`.
- `web/src/App.tsx` wraps the app in `AppProvider`, then renders `MainLayout`.
- `activePage` from `AppContext` switches between `Projects`, `Dashboards`, `Settings`, and the placeholder favourites view.

Frontend/backend boundary:

- `web/src/api.ts` is the only regular Tauri command wrapper layer. Add new frontend command calls there before using them from pages/components.
- Tauri command names are snake_case strings passed to `invoke`, for example `list_projects`, `upsert_project`, `get_activity_stats`.
- Rust command functions live in `src-tauri/src/commands.rs` and are registered in `src-tauri/src/lib.rs` inside `tauri::generate_handler![...]`.

## Backend Map

- `commands.rs`: Tauri command surface. It should stay thin: resolve workspace handles, coordinate running processes, then delegate business logic.
- `state.rs`: global app state, workspace config persistence, workspace pool management, app settings updates.
- `project.rs`: project CRUD, launch/stop helpers, open config validation, activity stats aggregation.
- `db.rs`: SQLite schema creation for workspace databases.
- `models.rs`: shared serializable data contracts. Serde uses camelCase for most structs and tagged snake_case for `OpenConfig`.
- `error.rs`: app error type and result alias. Prefer returning `AppResult<T>` or `Result<T, AppError>` from Rust command paths.

Important backend behavior:

- `launch_project` records launch history after opening/spawning the project.
- Custom app launches pass the project path as an argument to the executable.
- Custom command launches set `current_dir` to the project path.
- `running_processes` is in-memory only and tracks spawned child processes by project UUID.
- `get_running_projects` prunes finished or errored child processes before returning IDs.
- `delete_workspace` refuses to delete the last workspace, removes the pool/config record, then attempts to delete the workspace directory.

## Frontend Map

- `web/src/context/AppContext.tsx`: active page, global search, theme/accent/font settings, workspace list/active workspace, `workspaceVersion` reload trigger.
- `web/src/pages/Projects.tsx`: project list/grid, search filtering, create/edit/delete modal, launch actions, periodic running-status polling.
- `web/src/pages/Dashboards.tsx`: activity stats and charts via Recharts.
- `web/src/pages/Settings.tsx`: theme, appearance, workspace management, launch presets.
- `web/src/components/WorkspaceSelector.tsx`: workspace selection and workspace CRUD entry points.
- `web/src/components/ProjectModal.tsx`: project create/edit form and open configuration input.
- `web/src/types.ts`: frontend mirror of Rust models. Keep these synchronized with `src-tauri/src/models.rs`.

UI conventions visible in the current code:

- Tailwind utility classes are used directly in components.
- Icons come from `lucide-react`.
- Shared class merging uses `cn` from `web/src/lib/utils.ts`.
- The UI currently mixes English and Chinese labels; preserve nearby wording style when editing existing screens.
- Theme values are expressed with CSS variables and app settings, especially `accentColor`, `theme`, `fontFamily`, `fontSize`, and `zoomLevel`.

## Data Contracts

Keep these Rust and TypeScript shapes aligned:

- `WorkspaceRecord` <-> `Workspace`
- `WorkspaceInput` <-> `WorkspaceInput`
- `Project` <-> `Project`
- `ProjectInput` <-> `ProjectInput`
- `OpenConfig` <-> `OpenConfig`
- `AppSettings` / `AppSettingsUpdate` <-> `AppSettings` / `AppSettingsPayload`
- `ActivityStats`, `ActivityPoint`, `ProjectCount`

`OpenConfig` is serialized as a tagged enum using `mode`:

- `system_default`
- `custom_app`
- `custom_command`

When adding or renaming fields, update both sides and verify the Tauri invoke path manually or with tests.

## Development Commands

From the repository root:

```bash
cargo tauri dev
cargo tauri build
```

Frontend-only commands:

```bash
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
npm run lint --prefix web
```

Rust checks:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

The Tauri config in `src-tauri/tauri.conf.json` expects the dev server at `http://localhost:5173` and runs `npm run dev --prefix ../web` before dev mode.

## Editing Guidance

- Prefer codegraph for first-pass exploration of symbols and dependencies in this repo.
- Do not duplicate command names by hand across files without checking `web/src/api.ts`, `src-tauri/src/commands.rs`, and `src-tauri/src/lib.rs`.
- When changing a persisted model, consider backward compatibility for existing `workspaces.json` and workspace SQLite databases.
- Avoid holding `AppStateInner` write locks across slow work unless the existing pattern already requires it.
- Validate user-provided paths and launch configs through existing helpers in `project.rs`.
- Keep `commands.rs` as orchestration; put durable backend behavior in `state.rs` or `project.rs`.
- For frontend changes, reuse existing components and app context before introducing new global state.
- There are no indexed covering tests reported by codegraph for the main pages/commands. For risky changes, add focused tests or at least run the relevant build/check commands.

## Verification Checklist

Before claiming a code change is complete, run the smallest relevant set:

- Frontend UI/type changes: `npm run build --prefix web` and usually `npm run lint --prefix web`.
- Rust/backend changes: `cargo check --manifest-path src-tauri/Cargo.toml`; run `cargo test --manifest-path src-tauri/Cargo.toml` when behavior changed.
- Cross-boundary Tauri command/model changes: run both frontend build and Rust check, then manually exercise the command path in the app if possible.
- Tauri config/build changes: run `cargo tauri dev` or `cargo tauri build` as appropriate.

## Known Agent Notes

- The current workspace may contain unrelated uncommitted changes. Check `git status --short` before editing and avoid reverting user work.
- `.codegraph/` is present locally and should be treated as generated/index data unless the user explicitly asks to modify it.
- This repository uses npm lockfiles; use npm commands unless the package manager changes intentionally.
