# Pro Manager

## Project Overview
**Pro Manager** is a cross-platform desktop application designed to unify the management of local development projects across different languages (SpringBoot, C++, Python, etc.). It allows developers to organize projects into workspaces, configure custom launch commands, and manage project metadata.

## Tech Stack
*   **Framework:** [Tauri v2](https://tauri.app/) (Rust + Web Frontend)
*   **Frontend:**
    *   [React v19](https://react.dev/)
    *   [Vite](https://vitejs.dev/)
    *   TypeScript
*   **Backend:**
    *   Rust
    *   [SQLx](https://github.com/launchbadge/sqlx) (SQLite) for data persistence
    *   Tokio for async runtime
*   **Storage:**
    *   Global Config: JSON (`AppData/workspaces.json`)
    *   Workspace Data: SQLite (`projects.sqlite`)

## Architecture
The application follows the standard Tauri architecture:

*   **Frontend (`web/`):** A Single Page Application (SPA) built with React and Vite. It handles the UI/UX, state management, and calls backend commands via `@tauri-apps/api`.
*   **Backend (`src-tauri/`):** A Rust application that hosts the webview, manages the system tray/windows, and provides specific capabilities (FileSystem access, Database operations, Process spawning) exposed as Commands.

### Data Model
*   **Workspaces:** Isolated environments for grouping projects. Each workspace has its own SQLite database.
*   **Projects:** Entities representing a local project folder. Stored in the workspace's SQLite DB.
    *   Attributes: Name, Path, Description, Open Config.

## Development

### Prerequisites
*   **Node.js** & **npm**
*   **Rust** (stable) & **Cargo**
*   **Tauri CLI** (optional but recommended)

### Setup
1.  Install frontend dependencies:
    ```bash
    cd web
    npm install
    ```
    *(Note: The root directory does not have a `package.json` based on the file list, so operations are usually centered around `web` or `src-tauri`)*

### Running the App
To start the development environment (Frontend + Tauri Window):

```bash
# From the project root (if a root package.json exists with scripts) or utilizing cargo-tauri directly if installed globally
# Based on tauri.conf.json, the frontend is expected to be built/served from `web/`

# Recommended flow if `npm` scripts are set up in root (check if root package.json exists, otherwise run from web/ or use cargo tauri)
# Since root package.json is not visible in the initial list, assume standard Tauri v2 flow:

# 1. Start the frontend dev server
cd web
npm run dev

# 2. In a separate terminal, run Tauri
cd src-tauri
cargo tauri dev
```
*Correction based on `src-tauri/tauri.conf.json`:*
`beforeDevCommand` is `"npm --prefix web run dev"`. This means running `cargo tauri dev` in `src-tauri` (or `npm run tauri dev` if configured in a root `package.json`) will automatically start the frontend.

### Build
```bash
cd src-tauri
cargo tauri build
```

## Project Structure

```text
D:\CodeRepo\pro-manager\
├── web\                 # Frontend (React + Vite)
│   ├── src\             # React source code
│   ├── package.json     # Frontend dependencies
│   └── vite.config.ts   # Vite config
├── src-tauri\           # Backend (Rust)
│   ├── src\
│   │   ├── main.rs      # Entry point
│   │   ├── lib.rs       # Lib entry, command registration
│   │   ├── commands.rs  # Tauri commands exposed to frontend
│   │   ├── db.rs        # Database operations (SQLx)
│   │   ├── models.rs    # Rust structs for data
│   │   ├── project.rs   # Project-related logic
│   │   └── state.rs     # App state management
│   ├── tauri.conf.json  # Tauri configuration
│   └── Cargo.toml       # Rust dependencies
├── ARCHITECTURE.md      # Detailed architectural documentation
└── pro-manager.md       # Product requirements and roadmap
```

## Key Conventions
*   **Commands:** All backend functionality exposed to the frontend should be defined in `src-tauri/src/commands.rs` and registered in `lib.rs`.
*   **Database:** Database logic resides in `db.rs`. Use `sqlx` macros for compile-time query verification where possible.
*   **State:** Application state (like DB connection pools) is managed via Tauri's `Manager::manage` state facility (see `state.rs`).
*   **Styling:** Frontend styling is managed within `web/src` (currently `App.css`, `index.css`).
