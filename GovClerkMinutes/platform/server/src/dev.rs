pub fn is_dev() -> bool {
  return cfg!(target_os = "macos");
}
