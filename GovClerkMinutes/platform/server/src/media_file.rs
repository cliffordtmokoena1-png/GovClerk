use anyhow::{anyhow, Result};
use ffmpeg_sys_next::{
  av_channel_layout_copy, av_channel_layout_default, av_channel_layout_uninit, av_frame_alloc,
  av_frame_free, av_frame_get_buffer, av_frame_make_writable, av_get_bytes_per_sample,
  av_log_set_level, av_malloc, av_opt_set_chlayout, av_opt_set_int, av_opt_set_sample_fmt,
  av_packet_alloc, av_packet_free, av_packet_unref, av_read_frame, av_write_frame,
  av_write_trailer, avcodec_alloc_context3, avcodec_find_decoder, avcodec_find_encoder,
  avcodec_free_context, avcodec_open2, avcodec_parameters_from_context,
  avcodec_parameters_to_context, avcodec_receive_frame, avcodec_receive_packet, avcodec_send_frame,
  avcodec_send_packet, avformat_alloc_context, avformat_alloc_output_context2,
  avformat_close_input, avformat_find_stream_info, avformat_free_context, avformat_new_stream,
  avformat_open_input, avformat_write_header, avio_alloc_context, swr_alloc, swr_convert, swr_free,
  swr_init, AVChannelLayout, AVCodecContext, AVFormatContext, AVFrame, AVMediaType, AVSampleFormat,
  SwrContext, AV_LOG_DEBUG,
};
use ffmpeg_sys_next::{av_free, av_samples_get_buffer_size};
use std::ffi::CString;
use std::mem;
use std::path::Path;
use std::ptr;
use std::sync::Arc;
use tokio::io::AsyncRead;
use tokio::io::AsyncReadExt;

pub const SAMPLE_RATE: i32 = 16_000;
pub const NUM_CHANNELS: i32 = 1;
pub const BYTES_PER_SAMPLE: i32 = 2;
pub const BYTES_PER_SECOND: i32 = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;

struct BufferWithOffset {
  buffer: Vec<u8>,
  offset: usize,
}

impl BufferWithOffset {
  fn new(buffer: Vec<u8>) -> Self {
    Self { buffer, offset: 0 }
  }
}

unsafe fn ffmpeg_error_to_string(errnum: i32) -> String {
  let mut buf = [0i8; 128];
  ffmpeg_sys_next::av_strerror(errnum, buf.as_mut_ptr(), buf.len());
  let c_str = std::ffi::CStr::from_ptr(buf.as_ptr());
  c_str.to_string_lossy().into_owned()
}

unsafe extern "C" fn read_packet(
  opaque: *mut std::os::raw::c_void,
  buf: *mut u8,
  buf_size: i32,
) -> i32 {
  let buffer_with_offset = &mut *(opaque as *mut BufferWithOffset);
  let buffer = &buffer_with_offset.buffer;
  let offset = &mut buffer_with_offset.offset;

  let remaining = buffer.len() - *offset;
  if remaining == 0 {
    return ffmpeg_sys_next::AVERROR_EOF;
  }

  let bytes_to_copy = std::cmp::min(buf_size as usize, remaining);
  std::ptr::copy_nonoverlapping(buffer.as_ptr().add(*offset), buf, bytes_to_copy);
  *offset += bytes_to_copy;

  bytes_to_copy as i32
}

unsafe extern "C" fn write_packet(
  opaque: *mut std::os::raw::c_void,
  buf: *const u8,
  buf_size: i32,
) -> i32 {
  let output = &mut *(opaque as *mut Vec<u8>);
  let data = std::slice::from_raw_parts(buf, buf_size as usize);
  output.extend_from_slice(data);
  buf_size
}

unsafe extern "C" fn seek(opaque: *mut std::os::raw::c_void, offset: i64, whence: i32) -> i64 {
  let buffer_with_offset = &mut *(opaque as *mut BufferWithOffset);
  let buffer_len = buffer_with_offset.buffer.len() as i64;

  match whence {
    ffmpeg_sys_next::AVSEEK_SIZE => buffer_len,
    ffmpeg_sys_next::SEEK_SET => {
      if offset >= 0 && offset <= buffer_len {
        buffer_with_offset.offset = offset as usize;
        offset
      } else {
        -1
      }
    }
    ffmpeg_sys_next::SEEK_CUR => {
      let new_offset = buffer_with_offset.offset as i64 + offset;
      if new_offset >= 0 && new_offset <= buffer_len {
        buffer_with_offset.offset = new_offset as usize;
        new_offset
      } else {
        -1
      }
    }
    ffmpeg_sys_next::SEEK_END => {
      let new_offset = buffer_len + offset;
      if new_offset >= 0 && new_offset <= buffer_len {
        buffer_with_offset.offset = new_offset as usize;
        new_offset
      } else {
        -1
      }
    }
    _ => -1,
  }
}

/// Convert audio to 16 kHz, mono, s16 format
unsafe fn perform_transcoding(format_ctx: *mut AVFormatContext) -> Result<Vec<u8>> {
  let audio_stream_index = find_audio_stream(format_ctx)?;
  let mut codec_ctx = open_codec(format_ctx, audio_stream_index)?;

  let mut resample_ctx = create_resample_context(
    (*codec_ctx).ch_layout.nb_channels as i32,
    (*codec_ctx).sample_rate,
    (*codec_ctx).sample_fmt,
    NUM_CHANNELS, // Mono output
    SAMPLE_RATE,
    AVSampleFormat::AV_SAMPLE_FMT_S16,
  )?;

  let mut frame = av_frame_alloc();
  let mut packet = av_packet_alloc();

  if frame.is_null() || packet.is_null() {
    return Err(anyhow!("Failed to allocate frame or packet"));
  }

  let mut output = Vec::new();

  while av_read_frame(format_ctx, packet) >= 0 {
    if (*packet).stream_index == audio_stream_index {
      if avcodec_send_packet(codec_ctx, packet) < 0 {
        continue;
      }

      while avcodec_receive_frame(codec_ctx, frame) >= 0 {
        let resampled_data = resample_frame(resample_ctx, frame)?;
        output.extend_from_slice(&resampled_data);
      }
    }
    av_packet_unref(packet);
  }

  av_frame_free(&mut frame);
  av_packet_free(&mut packet);
  avcodec_free_context(&mut codec_ctx);
  swr_free(&mut resample_ctx);

  Ok(output)
}

unsafe fn find_audio_stream(format_ctx: *mut AVFormatContext) -> Result<i32> {
  for i in 0..(*format_ctx).nb_streams {
    let stream = *(*format_ctx).streams.offset(i as isize);
    if (*(*stream).codecpar).codec_type == AVMediaType::AVMEDIA_TYPE_AUDIO {
      return i.try_into().map_err(|_| anyhow!("Bad stream index {}", i));
    }
  }
  Err(anyhow!("No audio stream found"))
}

unsafe fn open_codec(
  format_ctx: *mut AVFormatContext,
  stream_index: i32,
) -> Result<*mut AVCodecContext> {
  let stream = *(*format_ctx).streams.offset(stream_index as isize);
  let codec = avcodec_find_decoder((*(*stream).codecpar).codec_id);
  if codec.is_null() {
    return Err(anyhow!("Failed to find decoder"));
  }

  let codec_ctx = avcodec_alloc_context3(codec);
  if avcodec_parameters_to_context(codec_ctx, (*stream).codecpar) < 0
    || avcodec_open2(codec_ctx, codec, ptr::null_mut()) < 0
  {
    return Err(anyhow!("Failed to open codec"));
  }
  Ok(codec_ctx)
}

unsafe fn create_resample_context(
  in_ch_layout_channels: i32,
  in_sample_rate: i32,
  in_sample_fmt: AVSampleFormat,
  out_ch_layout_channels: i32,
  out_sample_rate: i32,
  out_sample_fmt: AVSampleFormat,
) -> Result<*mut SwrContext> {
  let resample_ctx = swr_alloc();
  if resample_ctx.is_null() {
    return Err(anyhow!("Failed to allocate resampling context"));
  }

  let mut in_ch_layout: AVChannelLayout = mem::zeroed();
  av_channel_layout_default(&mut in_ch_layout, in_ch_layout_channels);

  let mut out_ch_layout: AVChannelLayout = mem::zeroed();
  av_channel_layout_default(&mut out_ch_layout, out_ch_layout_channels);

  let ret = av_opt_set_chlayout(
    resample_ctx as *mut _,
    c"in_chlayout".as_ptr() as *const _,
    &in_ch_layout,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set input channel layout: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  let ret = av_opt_set_chlayout(
    resample_ctx as *mut _,
    c"out_chlayout".as_ptr() as *const _,
    &out_ch_layout,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set output channel layout: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  let ret = av_opt_set_sample_fmt(
    resample_ctx as *mut _,
    c"in_sample_fmt".as_ptr() as *const _,
    in_sample_fmt,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set input sample format: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  let ret = av_opt_set_sample_fmt(
    resample_ctx as *mut _,
    c"out_sample_fmt".as_ptr() as *const _,
    out_sample_fmt,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set output sample format: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  let ret = av_opt_set_int(
    resample_ctx as *mut _,
    c"in_sample_rate".as_ptr() as *const _,
    in_sample_rate as i64,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set input sample rate: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  let ret = av_opt_set_int(
    resample_ctx as *mut _,
    c"out_sample_rate".as_ptr() as *const _,
    out_sample_rate as i64,
    0,
  );
  if ret < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!(
      "Failed to set output sample rate: {}",
      ffmpeg_error_to_string(ret)
    ));
  }

  if swr_init(resample_ctx) < 0 {
    av_channel_layout_uninit(&mut in_ch_layout);
    av_channel_layout_uninit(&mut out_ch_layout);
    return Err(anyhow!("Failed to initialize resampling context"));
  }

  av_channel_layout_uninit(&mut in_ch_layout);
  av_channel_layout_uninit(&mut out_ch_layout);

  Ok(resample_ctx)
}

unsafe fn resample_frame(resample_ctx: *mut SwrContext, frame: *mut AVFrame) -> Result<Vec<u8>> {
  let mut out_fmt = AVSampleFormat::AV_SAMPLE_FMT_NONE;
  if ffmpeg_sys_next::av_opt_get_sample_fmt(
    resample_ctx as *mut std::ffi::c_void,
    c"out_sample_fmt".as_ptr(),
    0,
    &mut out_fmt,
  ) < 0
  {
    return Err(anyhow!(
      "Failed to get output sample format from resample context"
    ));
  }

  let mut out_ch_layout: ffmpeg_sys_next::AVChannelLayout = mem::zeroed();
  if ffmpeg_sys_next::av_opt_get_chlayout(
    resample_ctx as *mut std::ffi::c_void,
    c"out_chlayout".as_ptr(),
    0,
    &mut out_ch_layout,
  ) < 0
  {
    return Err(anyhow!(
      "Failed to get output channel layout from resample context"
    ));
  }

  let out_sample_fmt = out_fmt;
  let out_channels = out_ch_layout.nb_channels;

  let bytes_per_sample = av_get_bytes_per_sample(out_sample_fmt);
  let max_out_samples = 8192;

  let mut output_buffer =
    vec![0u8; max_out_samples * out_channels as usize * bytes_per_sample as usize];
  let mut output_data = vec![output_buffer.as_mut_ptr(); 1];

  let samples_converted = swr_convert(
    resample_ctx,
    output_data.as_mut_ptr(),
    max_out_samples as i32,
    (*frame).data.as_ptr() as *mut *const u8,
    (*frame).nb_samples,
  );
  if samples_converted < 0 {
    return Err(anyhow!("Failed to resample audio frame"));
  }

  let data_size = samples_converted as usize * out_channels as usize * bytes_per_sample as usize;
  Ok(output_buffer[..data_size].to_vec())
}

unsafe fn pcm_to_wav_bytes(pcm_data: &[u8]) -> Result<Vec<u8>> {
  let mut output_ctx: *mut AVFormatContext = std::ptr::null_mut();

  if avformat_alloc_output_context2(
    &mut output_ctx,
    ptr::null_mut(),
    CString::new("wav")?.as_ptr(),
    ptr::null(),
  ) < 0
  {
    return Err(anyhow!("Failed to allocate output context"));
  }

  let codec = avcodec_find_encoder(ffmpeg_sys_next::AVCodecID::AV_CODEC_ID_PCM_S16LE);
  if codec.is_null() {
    return Err(anyhow!("WAV codec not found"));
  }

  let stream = avformat_new_stream(output_ctx, codec);
  if stream.is_null() {
    return Err(anyhow!("Failed to create new stream"));
  }

  let mut codec_ctx = avcodec_alloc_context3(codec);
  if codec_ctx.is_null() {
    return Err(anyhow!("Failed to allocate codec context"));
  }

  let mut ch_layout: AVChannelLayout = mem::zeroed();
  av_channel_layout_default(&mut ch_layout, NUM_CHANNELS);
  if av_channel_layout_copy(&mut (*codec_ctx).ch_layout, &ch_layout) < 0 {
    return Err(anyhow!("Failed to copy channel layout to codec context"));
  }

  (*codec_ctx).sample_rate = SAMPLE_RATE;
  (*codec_ctx).sample_fmt = AVSampleFormat::AV_SAMPLE_FMT_S16;
  (*codec_ctx).bit_rate = 256_000;

  if avcodec_open2(codec_ctx, codec, ptr::null_mut()) < 0 {
    return Err(anyhow!("Failed to open codec"));
  }

  if avcodec_parameters_from_context((*stream).codecpar, codec_ctx) < 0 {
    return Err(anyhow!("Failed to copy codec parameters"));
  }

  let output_data = Vec::new();
  let mut output_data_box = Box::new(output_data);
  let output_data_ptr = &mut *output_data_box as *mut Vec<u8> as *mut std::os::raw::c_void;

  let avio_ctx_buffer_size = 8192;
  let avio_buffer = av_malloc(avio_ctx_buffer_size);
  if avio_buffer.is_null() {
    return Err(anyhow!("Failed to allocate AVIO buffer"));
  }

  let pb = avio_alloc_context(
    avio_buffer as *mut u8,
    avio_ctx_buffer_size as i32,
    1,
    output_data_ptr,
    None,
    Some(write_packet),
    None,
  );

  if pb.is_null() {
    return Err(anyhow!("Failed to create AVIO context"));
  }

  (*output_ctx).pb = pb;

  if avformat_write_header(output_ctx, ptr::null_mut()) < 0 {
    return Err(anyhow!("Failed to write WAV header"));
  }

  let bytes_per_sample = av_get_bytes_per_sample((*codec_ctx).sample_fmt) as usize;
  let channels = (*codec_ctx).ch_layout.nb_channels as usize;
  let total_samples = pcm_data.len() / (channels * bytes_per_sample);

  let mut frame = av_frame_alloc();
  if frame.is_null() {
    return Err(anyhow!("Could not allocate audio frame"));
  }

  (*frame).nb_samples = total_samples as i32;
  (*frame).format = (*codec_ctx).sample_fmt as i32;
  if av_channel_layout_copy(&mut (*frame).ch_layout, &(*codec_ctx).ch_layout) < 0 {
    return Err(anyhow!("Failed to copy channel layout to frame"));
  }
  (*frame).sample_rate = (*codec_ctx).sample_rate;

  if av_frame_get_buffer(frame, 0) < 0 {
    return Err(anyhow!("Could not allocate audio data buffers"));
  }

  if av_frame_make_writable(frame) < 0 {
    return Err(anyhow!("Frame not writable"));
  }

  let data_size = av_samples_get_buffer_size(
    ptr::null_mut(),
    (*codec_ctx).ch_layout.nb_channels as i32,
    (*frame).nb_samples,
    (*codec_ctx).sample_fmt,
    1,
  );

  if data_size <= 0 {
    return Err(anyhow!("Could not get buffer size"));
  }

  std::ptr::copy_nonoverlapping(pcm_data.as_ptr(), (*frame).data[0], data_size as usize);

  if avcodec_send_frame(codec_ctx, frame) < 0 {
    return Err(anyhow!("Error sending frame to encoder"));
  }

  let mut packet = av_packet_alloc();
  if packet.is_null() {
    return Err(anyhow!("Failed to allocate packet"));
  }

  let mut pts = 0;
  while avcodec_receive_packet(codec_ctx, packet) == 0 {
    (*packet).pts = pts;
    (*packet).dts = pts;
    pts += (*frame).nb_samples as i64;

    if av_write_frame(output_ctx, packet) < 0 {
      return Err(anyhow!("Failed to write packet"));
    }
    av_packet_unref(packet);
  }

  if av_write_trailer(output_ctx) < 0 {
    return Err(anyhow!("Failed to write trailer"));
  }

  av_packet_free(&mut packet);
  av_frame_free(&mut frame);
  avcodec_free_context(&mut codec_ctx);
  av_channel_layout_uninit(&mut ch_layout);

  let result = Box::into_raw(output_data_box);
  let final_vec: Vec<u8> = (*result).clone();
  drop(Box::from_raw(result));

  av_free((*pb).buffer as *mut libc::c_void);
  av_free(pb as *mut libc::c_void);
  avformat_free_context(output_ctx);

  Ok(final_vec)
}

#[derive(Clone)]
pub struct MediaFile {
  /// Duration in seconds
  pub duration: f64,

  /// 16-bit samples, mono, 16 kHz
  pcm_data: Arc<Vec<u8>>,
}

impl MediaFile {
  pub async fn init<R: AsyncRead + Send + 'static + std::marker::Unpin>(
    mut reader: R,
  ) -> Result<Self> {
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer).await?;
    let buffer_with_offset = Box::new(BufferWithOffset::new(buffer));

    unsafe {
      av_log_set_level(AV_LOG_DEBUG);

      let mut format_ctx = avformat_alloc_context();
      if format_ctx.is_null() {
        return Err(anyhow!("Failed to allocate AVFormatContext"));
      }

      let avio_buffer = av_malloc(8192);
      if avio_buffer.is_null() {
        return Err(anyhow!("Failed to allocate AVIOContext buffer"));
      }

      let io_ctx = avio_alloc_context(
        avio_buffer as *mut u8,
        8192,
        0,
        Box::into_raw(buffer_with_offset) as *mut std::os::raw::c_void,
        Some(read_packet),
        None,
        Some(seek),
      );

      if io_ctx.is_null() {
        return Err(anyhow!("Failed to allocate AVIOContext"));
      }

      (*format_ctx).pb = io_ctx;

      let input_format: *const i8 = std::ptr::null();
      if avformat_open_input(
        &mut format_ctx,
        input_format,
        ptr::null_mut(),
        ptr::null_mut(),
      ) < 0
      {
        return Err(anyhow!("Failed to open input format context"));
      }

      if avformat_find_stream_info(format_ctx, ptr::null_mut()) < 0 {
        return Err(anyhow!("Failed to find stream info"));
      }

      let pcm_data = Arc::new(perform_transcoding(format_ctx)?);

      let duration = pcm_data.len() as f64 / BYTES_PER_SECOND as f64;

      av_free((*io_ctx).buffer as *mut libc::c_void);
      drop(Box::from_raw((*io_ctx).opaque as *mut BufferWithOffset));
      av_free(io_ctx as *mut libc::c_void);
      avformat_close_input(&mut format_ctx);

      Ok(Self { pcm_data, duration })
    }
  }

  #[allow(dead_code)]
  pub async fn write_wav(&self, output_path: &Path) -> anyhow::Result<()> {
    let wav_data = unsafe { pcm_to_wav_bytes(&self.pcm_data)? };
    tokio::fs::write(output_path, &wav_data).await?;
    Ok(())
  }

  /// Extracts a slice of the audio from `start` to `stop` timestamps and encodes it to WAVE.
  ///
  /// # Arguments
  /// * `start` - The start time in seconds (inclusive) for the slice.
  /// * `stop` - The stop time in seconds (exclusive) for the slice.
  ///
  /// # Returns
  /// A `Result` with a `Vec<u8>` representing a fully encoded WAVE file
  pub fn slice(&self, start: f64, stop: f64) -> anyhow::Result<Vec<u8>> {
    if start < 0.0 || stop <= start {
      return Err(anyhow!("Invalid start/stop times"));
    }

    let start_sample = (start * SAMPLE_RATE as f64) as usize;
    let stop_sample = (stop * SAMPLE_RATE as f64) as usize;
    let bytes_per_sample = BYTES_PER_SAMPLE as usize;
    let mut start_byte = start_sample * bytes_per_sample;
    let mut stop_byte = stop_sample * bytes_per_sample;

    stop_byte = std::cmp::min(stop_byte, self.pcm_data.len());
    start_byte = std::cmp::min(start_byte, stop_byte);

    if stop_byte == start_byte {
      return Ok(Vec::new());
    }

    let slice = &self.pcm_data[start_byte..stop_byte];
    unsafe { pcm_to_wav_bytes(slice) }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::tests::utils::download_and_cache_s3_asset;
  use tempfile::tempdir;
  use tokio::fs::File;
  use tokio::io::BufReader;

  #[tokio::test]
  async fn test_transcode_to_pcm() -> Result<()> {
    let asset_path = download_and_cache_s3_asset("lexconvo2.m4a").await?;
    let file = File::open(asset_path).await?;
    let reader = BufReader::new(file);

    let media_file = MediaFile::init(reader).await?;

    assert!(
      !media_file.pcm_data.is_empty(),
      "PCM data should not be empty"
    );

    assert_eq!(media_file.duration.round() as i32, 210, "wrong duration");

    let sliced = media_file.slice(0.0, 10.0)?;
    assert!(
      sliced.len() > (BYTES_PER_SECOND * 10) as usize,
      "wrong slice length"
    );

    let temp_dir = tempdir()?;
    let output_path = temp_dir.path().join("output.wav");

    // Uncomment this line to persist the file to disk to manually inspect it
    // media_file.write_wav(Path::new("output.wav")).await?;

    media_file.write_wav(&output_path).await?;

    let metadata = tokio::fs::metadata(&output_path).await?;
    assert!(metadata.len() > 0, "WAV file should not be empty");

    Ok(())
  }
}
