use tauri::{AppHandle, Manager, PhysicalPosition, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

fn toggle_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            position_like_spotlight(&window);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn position_like_spotlight(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        if let Ok(size) = window.outer_size() {
            let work = monitor.work_area();
            let x = work.position.x + ((work.size.width as i32 - size.width as i32) / 2);
            let y = work.position.y + (work.size.height as i32 / 7);
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_overlay(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));

                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::HudWindow,
                        Some(NSVisualEffectState::Active),
                        Some(24.0),
                    );
                }

                #[cfg(target_os = "windows")]
                {
                    use window_vibrancy::apply_acrylic;
                    let _ = apply_acrylic(&window, Some((18, 18, 18, 90)));
                }

                position_like_spotlight(&window);
            }

            app.global_shortcut()
                .register("CommandOrControl+Shift+J")?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
