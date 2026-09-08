// Forge desktop shell. The UI is the same React bundle the Android app uses for
// its shared pieces; the shell adds the things only a desktop app can do —
// OS keychain storage for bring-your-own-key secrets, and native file dialogs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use keyring::Entry;

const SERVICE: &str = "games.dustline.forge";

/// Store a provider key in the OS keychain. Keys never leave this device and
/// are never written to the synced project.
#[tauri::command]
fn set_secret(name: String, value: String) -> Result<(), String> {
    Entry::new(SERVICE, &name)
        .and_then(|e| e.set_password(&value))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_secret(name: String) -> Result<Option<String>, String> {
    match Entry::new(SERVICE, &name).and_then(|e| e.get_password()) {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_secret(name: String) -> Result<(), String> {
    match Entry::new(SERVICE, &name).and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![set_secret, get_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running Forge");
}
