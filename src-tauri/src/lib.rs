use std::time::Duration;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

fn work_area_logical(window: &WebviewWindow) -> (f64, f64) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let work = monitor.work_area();
        let scale = monitor.scale_factor();
        (
            work.size.width as f64 / scale,
            work.size.height as f64 / scale,
        )
    } else {
        (1512.0, 982.0)
    }
}

fn target_for_mode(window: &WebviewWindow, mode: &str) -> (f64, f64) {
    let (work_w, work_h) = work_area_logical(window);
    match mode {
        "board" => (
            (work_w * 0.92).max(1200.0).min((work_w - 48.0).max(1200.0)),
            (work_h * 0.88).max(820.0).min((work_h - 48.0).max(820.0)),
        ),
        _ => (
            (work_w * 0.74).max(1080.0).min(work_w * 0.82),
            (work_h * 0.78).max(760.0).min(work_h * 0.86),
        ),
    }
}

fn animate_window_to(window: WebviewWindow, target_w: f64, target_h: f64) {
    std::thread::spawn(move || {
        let Ok(start) = window.outer_size() else { return };
        let scale = window.scale_factor().unwrap_or(1.0);
        let from_w = start.width as f64 / scale;
        let from_h = start.height as f64 / scale;
        let Ok(pos) = window.outer_position() else { return };
        let cx = pos.x as f64 + start.width as f64 / 2.0;
        let top = pos.y as f64;
        const STEPS: i32 = 16;
        for step in 1..=STEPS {
            let t = step as f64 / STEPS as f64;
            let e = 1.0 - (1.0 - t).powi(4);
            let width = from_w + (target_w - from_w) * e;
            let height = from_h + (target_h - from_h) * e;
            let _ = window.set_size(LogicalSize::new(width, height));
            let _ = window.set_position(PhysicalPosition::new(
                (cx - width * scale / 2.0) as i32,
                top as i32,
            ));
            std::thread::sleep(Duration::from_millis(16));
        }
    });
}

#[tauri::command]
fn set_hud_mode(window: WebviewWindow, mode: String) {
    let (width, height) = target_for_mode(&window, &mode);
    animate_window_to(window, width, height);
}

fn jev_api_key() -> Result<String, String> {
    std::env::var("TYPESAFE_API_KEY")
        .or_else(|_| std::env::var("VITE_TYPESAFE_API_KEY"))
        .map_err(|_| "Missing TYPESAFE_API_KEY or VITE_TYPESAFE_API_KEY".into())
        .and_then(|key| {
            let trimmed = key.trim().to_string();
            if trimmed.is_empty() {
                Err("TYPESAFE API key is empty".into())
            } else {
                Ok(trimmed)
            }
        })
}

#[tauri::command]
async fn jev_system_one(payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let key = jev_api_key()?;
    let response = reqwest::Client::new()
        .post("https://api.typesafe.ai/v1/systemone")
        .bearer_auth(key)
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("Jev request failed: {err}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|err| format!("Jev body failed: {err}"))?;
    if !status.is_success() {
        return Err(format!("Jev HTTP {status}: {text}"));
    }
    serde_json::from_str(&text).map_err(|err| format!("Jev JSON failed: {err}"))
}

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
            let y = work.position.y + (work.size.height as i32 / 18).max(28);
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();

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
        .invoke_handler(tauri::generate_handler![set_hud_mode, jev_system_one])
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
