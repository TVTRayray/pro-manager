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
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri::image::Image;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();
            
            // System Tray Setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Pro Manager", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                builder = builder.icon(icon);
            }

            builder.build(app)?;

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
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::get_active_workspace,
            commands::create_workspace,
            commands::rename_workspace,
            commands::delete_workspace,
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
