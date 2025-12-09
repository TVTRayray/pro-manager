mod commands;
mod db;
mod error;
mod models;
mod project;
mod state;

use std::path::PathBuf;

use error::AppError;
use log::LevelFilter;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();

            if cfg!(debug_assertions) {
                handle
                    .plugin(
                        tauri_plugin_log::Builder::default()
                            .level(LevelFilter::Info)
                            .build(),
                    )
                    .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            }

            let data_dir = handle
                .path()
                .app_data_dir()
                .map_err(|_| AppError::PathUnavailable(PathBuf::from("app_data_dir")))?;
            let state = tauri::async_runtime::block_on(AppState::initialise(data_dir))?;
            handle.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::get_active_workspace,
            commands::create_workspace,
            commands::set_active_workspace,
            commands::list_projects,
            commands::upsert_project,
            commands::delete_project,
            commands::launch_project,
            commands::stop_project,
            commands::get_running_projects,
            commands::get_settings,
            commands::update_settings,
            commands::get_activity_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
