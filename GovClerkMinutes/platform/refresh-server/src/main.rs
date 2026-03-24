use chrono::{DateTime, NaiveDateTime, Utc};
use nix::unistd::Uid;
use regex::Regex;
use reqwest::Client;
use std::io::Result;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
    thread,
};

const NGINX_CONF_PATH: &str = "/etc/nginx/nginx.conf";

fn read_file_lines(path: &str) -> Vec<String> {
    let mut file = File::open(path).expect("Unable to open file");
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .expect("Unable to read file");
    contents.lines().map(|s| s.to_string()).collect()
}

fn write_file_lines(path: &str, lines: Vec<String>) {
    let output = lines.join("\n");
    let mut file = File::create(path).expect("Unable to create file");
    file.write_all(output.as_bytes())
        .expect("Unable to write data to file");
}

fn patch_nginx_config_and_reload() -> anyhow::Result<()> {
    let lines = read_file_lines(NGINX_CONF_PATH);
    let mut inside_patch_section = false;
    let patched = lines
        .iter()
        .map(|line| {
            if line.contains("# $$$$PATCHME") {
                inside_patch_section = !inside_patch_section;
                return line.clone();
            }
            if inside_patch_section {
                if line.contains("upstream backend {") || line.contains("}") {
                    return line.clone();
                } else if line.contains("server localhost:8000;") {
                    println!("- server localhost:8000;");
                    println!("+ server localhost:8001;");
                    return "server localhost:8001;".to_string();
                } else if line.contains("server localhost:8001;") {
                    println!("- server localhost:8001;");
                    println!("+ server localhost:8000;");
                    return "server localhost:8000;".to_string();
                } else if line.contains("server localhost:8000 backup;") {
                    println!("- server localhost:8000 backup;");
                    println!("+ server localhost:8001 backup;");
                    return "server localhost:8001 backup;".to_string();
                } else if line.contains("server localhost:8001 backup;") {
                    println!("- server localhost:8001 backup;");
                    println!("+ server localhost:8000 backup;");
                    return "server localhost:8000 backup;".to_string();
                } else {
                    unreachable!();
                }
            }
            return line.clone();
        })
        .collect::<Vec<String>>();

    write_file_lines(NGINX_CONF_PATH, patched);

    println!("\nReloading nginx...");
    let status = std::process::Command::new("service")
        .arg("nginx")
        .arg("reload")
        .status()?;

    if !status.success() {
        println!("Nginx reload failed???");
        return Err(anyhow::anyhow!("Failed to reload nginx"));
    }
    println!("Nginx reloaded!");

    return Ok(());
}

fn backup_gc_prod() -> anyhow::Result<()> {
    std::fs::copy("/home/ec2-user/mg.prod", "/home/ec2-user/mg.prod.backup")?;
    return Ok(());
}

fn copy_gc_staging_to_prod() -> anyhow::Result<String> {
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");

    // As std::time::Duration does not have a direct method to get the total milliseconds
    // we have to calculate it manually
    let timestamp_in_millis =
        since_the_epoch.as_secs() * 1000 + since_the_epoch.subsec_nanos() as u64 / 1_000_000;

    let destination_path = format!("/home/ec2-user/mg-{}.prod", timestamp_in_millis);
    std::fs::copy("/home/ec2-user/mg.staging", &destination_path)?;

    return Ok(destination_path);
}

fn update_gc_prod_symlink(new_gc_prod: &str) -> anyhow::Result<()> {
    let symlink_path = PathBuf::from("/home/ec2-user/mg.prod");

    // If the symlink already exists, remove it
    if symlink_path.exists() {
        std::fs::remove_file(&symlink_path)?;
    }

    // Create a new symlink
    std::os::unix::fs::symlink(new_gc_prod, &symlink_path)?;

    Ok(())
}

fn systemctl_restart(service: &str) -> anyhow::Result<()> {
    let status = std::process::Command::new("systemctl")
        .arg("restart")
        .arg(service)
        .status()?;

    if status.success() {
        return Ok(());
    } else {
        return Err(anyhow::anyhow!("Failed to start service: {}", service));
    }
}

async fn get_pending_tasks(port: u16) -> anyhow::Result<usize> {
    let http_client = Client::new();

    let res = http_client
        .get(format!("http://localhost:{}/api/get-pending-tasks", port))
        .header("Content-Type", "application/json")
        .send()
        .await?;

    let status = res.status();

    let response = res.json::<serde_json::Value>().await?;

    if !status.is_success() {
        println!("get-pending-tasks failed: {}", response);
        return Err(anyhow::anyhow!("get-pending-tasks failed"));
    }

    let pending_tasks = response["tasks"].as_u64().unwrap() as usize;
    return Ok(pending_tasks);
}

async fn wait_for_pending_tasks(port: u16) -> anyhow::Result<()> {
    let mut secs_waited = 0;
    // TODO: is 30 minutes right?
    while secs_waited < 30 * 60 {
        let pending_tasks = get_pending_tasks(port).await?;
        if pending_tasks == 0 {
            break;
        }
        println!(
            "Waiting for {} pending tasks to complete on port {}...",
            pending_tasks, port
        );
        secs_waited += 5;
        thread::sleep(Duration::from_secs(5));
    }
    return Ok(());
}

/// Returns how many files were deleted
fn cleanup() -> Result<usize> {
    // Create a Regex to match a unix timestamp within the filename
    let re = Regex::new(r"mg-(\d+)\.prod").unwrap();

    // Get the current unix timestamp
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Convert current timestamp to DateTime
    let now_datetime = DateTime::<Utc>::from_utc(
        NaiveDateTime::from_timestamp_opt(now as i64, 0).unwrap(),
        Utc,
    );

    let mut num_deleted = 0;

    for entry in std::fs::read_dir("/home/ec2-user")? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if let Some(filename) = path.file_name() {
                if let Some(filename) = filename.to_str() {
                    // Check if the filename matches the regex
                    if let Some(caps) = re.captures(filename) {
                        // Parse the timestamp from the filename
                        if let Some(timestamp_str) = caps.get(1) {
                            let timestamp = timestamp_str.as_str().parse::<i64>().unwrap();
                            let file_datetime = DateTime::<Utc>::from_utc(
                                NaiveDateTime::from_timestamp_opt(timestamp, 0).unwrap(),
                                Utc,
                            );

                            // If the file is older than an hour, delete it
                            if now_datetime.signed_duration_since(file_datetime)
                                > chrono::Duration::days(1)
                            {
                                std::fs::remove_file(path)?;
                                num_deleted += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(num_deleted)
}

#[tokio::main]
async fn main() {
    if !Uid::effective().is_root() {
        panic!("This program must be run as root!");
    }
    if !Path::new("/home/ec2-user/mg.staging").exists() {
        panic!("~/mg.staging does not exist");
    }

    println!("Cleaning up old server versions...");
    let num_deleted = cleanup();
    println!("Cleanup done! Deleted {} files", num_deleted.unwrap());

    println!(
        "Patching nginx.conf file at: {} so 8001 is primary...",
        NGINX_CONF_PATH
    );
    match patch_nginx_config_and_reload() {
        Ok(_) => println!("Nginx reload successful!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Backing up mg.prod -> mg.prod.backup...");
    match backup_gc_prod() {
        Ok(_) => println!("mg.prod backed up to mg.prod.backup"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Copying mg.staging -> mg-TS.prod...");
    let gc_prod_path = match copy_gc_staging_to_prod() {
        Ok(dst) => {
            println!("mg.staging copied to {}", dst);
            dst
        }
        Err(e) => {
            todo!("handle error {}", e);
        }
    };

    println!("Updating mg.prod symlink...");
    match update_gc_prod_symlink(&gc_prod_path) {
        Ok(_) => println!("mg.prod symlink updated!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Waiting 75 seconds for timeouts on 8000...");
    thread::sleep(Duration::from_secs(75));
    println!("Waiting done!");

    println!("Waiting for pending tasks to complete on 8000...");
    match wait_for_pending_tasks(8000).await {
        Ok(_) => println!("Waiting for pending tasks done!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Restarting GovClerkMinutes8000.service...");
    match systemctl_restart("GovClerkMinutes8000.service") {
        Ok(_) => println!("GovClerkMinutes8000.service restarted!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Patching nginx.conf file so 8000 is primary again...");
    match patch_nginx_config_and_reload() {
        Ok(_) => println!("Nginx reload successful!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Waiting 75 seconds for timeouts on 8001...");
    thread::sleep(Duration::from_secs(75));
    println!("Waiting done!");

    println!("Waiting for pending tasks to complete on 8001...");
    match wait_for_pending_tasks(8001).await {
        Ok(_) => println!("Waiting for pending tasks done!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    println!("Restarting GovClerkMinutes8001.service...");
    match systemctl_restart("GovClerkMinutes8001.service") {
        Ok(_) => println!("GovClerkMinutes8001.service restarted!"),
        Err(e) => {
            todo!("handle error {}", e);
        }
    }

    // TODO: if anything fails, revert to mg.prod.backup

    println!("Deleting mg.staging...");
    std::fs::remove_file("/home/ec2-user/mg.staging").expect("Unable to delete mg.staging");

    println!("DONE!");
}
