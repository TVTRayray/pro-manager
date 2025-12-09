# Pro Manager

**Pro Manager** is a modern, cross-platform desktop application designed to unify the management of your local development projects. Built with efficiency in mind, it allows developers to organize, launch, and track projects across different languages and frameworks (SpringBoot, C++, Python, etc.) from a single, beautiful interface.

## ✨ Features

- **Unified Project Hub**: Import and manage all your local projects in one place.
- **Smart Launch Presets**: Define custom launch configurations (e.g., Environment Variables, Command Arguments) for each project.
- **Workspace Management**: Organize projects into isolated workspaces for better context switching.
- **Activity & Analytics**: Track your development activity with launch statistics and usage charts.
- **Quick Search**: Instantly find projects with a powerful search bar.
- **Process Management**: Monitor running projects and stop them directly from the dashboard.
- **Modern UI**: A sleek, responsive interface built with React and TailwindCSS, featuring:
    - 🌓 **Dark/Light Mode** support (with system sync)
    - 🎨 **Custom Accent Colors**
    - 🖼️ **Glassmorphism** effects

## 🛠️ Tech Stack

**Pro Manager** leverages the power of Rust and the flexibility of the Web ecosystem:

- **Core**: [Tauri v2](https://tauri.app/) (Rust + Webview) - Lightweight and secure.
- **Frontend**:
    - [React v19](https://react.dev/) - UI Library.
    - [Vite](https://vitejs.dev/) - Build tool.
    - [TailwindCSS](https://tailwindcss.com/) - Styling.
    - [Recharts](https://recharts.org/) - Data visualization.
    - [`lucide-react`](https://lucide.dev/) - Icons.
- **Backend (Rust)**:
    - [SQLx](https://github.com/launchbadge/sqlx) - Type-safe SQL database interactions (SQLite).
    - [Tokio](https://tokio.rs/) - Async runtime for high performance.
- **Storage**:
    - SQLite (`projects.sqlite`) for project data.
    - JSON (`workspaces.json`) for configuration.

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- **Node.js** (v20+) & **npm**
- **Rust** (Stable) & **Cargo**
- **System Dependencies** needed for Tauri (Build Tools, Webview2 on Windows, etc.)

### Installation & Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/pro-manager.git
    cd pro-manager
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    cd web
    npm install
    ```

3.  **Run the Application (Development Mode):**
    Return to the root directory or run directly:
    ```bash
    # This command handles both frontend and backend dev servers
    cargo tauri dev
    ```
    *Note: The frontend will be verified automatically via the `beforeDevCommand`.*

4.  **Build for Production:**
    ```bash
    cargo tauri build
    ```
    The output executable will be located in `src-tauri/target/release/bundle`.

## 📂 Project Structure

```text
pro-manager/
├── web/                 # Frontend (React + Vite)
│   ├── src/             # Components, Pages, Context, Hooks
│   └── public/          # Static assets
├── src-tauri/           # Backend (Rust)
│   ├── src/
│   │   ├── main.rs      # App Entry
│   │   ├── commands.rs  # Tauri Commands (API)
│   │   ├── db.rs        # Database Layer
│   │   └── ...          # Models & Logic
│   └── tauri.conf.json  # Application Configuration
└── README.md            # Project Documentation
```

## 📄 License

[MIT License](LICENSE) © 2025 Pro Manager Team
