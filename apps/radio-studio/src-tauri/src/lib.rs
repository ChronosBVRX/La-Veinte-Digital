use std::{
    fs,
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

fn port_is_open(host: &str, port: u16) -> bool {
    let Ok(mut addrs) = (host, port).to_socket_addrs() else {
        return false;
    };
    let Some(addr) = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(350)).is_ok()
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn start_sidecar_if_needed() {
    if port_is_open("127.0.0.1", 3977) {
        return;
    }

    let root = repo_root();
    let sidecar = root
        .join("apps")
        .join("radio-studio")
        .join("sidecar")
        .join("dist")
        .join("sidecar.js");
    if !sidecar.exists() {
        eprintln!("[radio-studio] sidecar no encontrado: {}", sidecar.display());
        return;
    }

    let log_dir = root.join("data").join("tts");
    if let Err(e) = fs::create_dir_all(&log_dir) {
        eprintln!("[radio-studio] no pude crear logs: {e}");
        return;
    }

    let Ok(out) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("sidecar-tauri.log"))
    else {
        eprintln!("[radio-studio] no pude abrir sidecar-tauri.log");
        return;
    };
    let err = out.try_clone().ok();

    let mut cmd = Command::new("node");
    cmd.arg("--no-warnings")
        .arg(&sidecar)
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(out));

    if let Some(err) = err {
        cmd.stderr(Stdio::from(err));
    } else {
        cmd.stderr(Stdio::null());
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    if let Err(e) = cmd.spawn() {
        eprintln!("[radio-studio] no pude iniciar el sidecar: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            start_sidecar_if_needed();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
