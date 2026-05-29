use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start Node server sidecar
            let shell = app.shell();
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            // Ensure data directory exists
            std::fs::create_dir_all(&data_dir).ok();

            let sidecar = shell
                .sidecar("server")
                .expect("failed to create sidecar command")
                .env("AGENT_API_PORT", "8787")
                .env("AGENT_DATA_DIR", data_dir.to_string_lossy().to_string());

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn Node server sidecar");

            // Listen for sidecar output in background
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        tauri_plugin_shell::process::CommandEvent::Stdout(data) => {
                            log::info!("[server] {}", String::from_utf8_lossy(&data));
                        }
                        tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                            log::warn!("[server] {}", String::from_utf8_lossy(&data));
                        }
                        tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                            log::error!("[server] Terminated with status: {:?}", status);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            // Store child for cleanup
            app.manage(ServerChild(std::sync::Mutex::new(Some(child))));
            log::info!("Flowith server started on port 8787");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Flowith");
}

struct ServerChild(std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

impl Drop for ServerChild {
    fn drop(&mut self) {
        if let Some(child) = self.0.lock().unwrap().take() {
            log::info!("Stopping Node server...");
            let _ = child.kill();
        }
    }
}
