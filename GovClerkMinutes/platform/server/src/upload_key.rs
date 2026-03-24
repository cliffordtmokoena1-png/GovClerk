// Key has format "{test_}uploads/upload_<TRANSCRIPT_ID>"
pub fn get_upload_key(transcript_id: u64, test_mode: bool) -> String {
  let test_prefix = if test_mode { "test_" } else { "" };
  return format!("{}uploads/upload_{}", test_prefix, transcript_id);
}
