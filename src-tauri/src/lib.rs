mod commands;
mod db;
mod editors;
mod error;
mod models;
mod project;
mod state;

use std::path::PathBuf;

use error::AppError;
use log::LevelFilter;
use state::AppState;
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(|app| {
            let projects =
                MenuItem::with_id(app, "navigate-projects", "Projects", true, None::<&str>)?;
            let dashboard =
                MenuItem::with_id(app, "navigate-dashboard", "Dashboard", true, None::<&str>)?;
            let favourites =
                MenuItem::with_id(app, "navigate-favourites", "Favourites", true, None::<&str>)?;
            let settings =
                MenuItem::with_id(app, "navigate-settings", "Settings", true, None::<&str>)?;
            let navigate = Submenu::with_items(
                app,
                "Navigate",
                true,
                &[&projects, &dashboard, &favourites, &settings],
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let application = Submenu::with_items(app, "Application", true, &[&quit])?;
            Menu::with_items(app, &[&navigate, &application])
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "navigate-projects" => {
                let _ = app.emit("navigate", "projects");
            }
            "navigate-dashboard" => {
                let _ = app.emit("navigate", "dashboards");
            }
            "navigate-favourites" => {
                let _ = app.emit("navigate", "favourites");
            }
            "navigate-settings" => {
                let _ = app.emit("navigate", "settings");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle();

            // System Tray Setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Pro Manager", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
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
            commands::set_project_favourite,
            commands::detect_editor_presets,
            commands::launch_project,
            commands::stop_project,
            commands::get_running_projects,
            commands::get_settings,
            commands::update_settings,
            commands::get_activity_stats
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app.try_state::<AppState>() {
                let _ = tauri::async_runtime::block_on(state.stop_all_processes());
            }
        }
    });
}
