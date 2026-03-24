pub fn timestamp_to_seconds(timestamp: &str) -> anyhow::Result<f32> {
  let parts: Vec<&str> = timestamp.split(':').collect();
  if parts.len() != 3 {
    return Err(anyhow::anyhow!("Invalid timestamp: {}", timestamp));
  }

  let hours: f32 = parts[0].parse()?;
  let minutes: f32 = parts[1].parse()?;
  let seconds: f32 = parts[2].parse()?;

  return Ok(hours * 3600.0 + minutes * 60.0 + seconds);
}

pub fn seconds_to_timestamp(seconds: f64) -> String {
  let hours = (seconds / 3600.0).floor() as u32;
  let minutes = ((seconds % 3600.0) / 60.0).floor() as u32;
  let seconds = (seconds % 60.0).floor() as u32;
  format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}
