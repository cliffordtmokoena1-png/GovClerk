use crate::get_diarization::GCSegmentsRow;
use crate::SharedRequestState;
use mysql_async::{prelude::Queryable, Conn, Error, Value};
use std::sync::Arc;
use tracing::info;

/// Represents an update to a segment in the gc_segments database.
pub struct SegmentUpdate {
  pub segment_index: usize,
  pub source: String,
  /// If None, no need to update because it's already stored.
  pub transcript: Option<String>,
}

/// Inserts rows into `gc_segments` in batches of 50.
pub async fn insert_gc_segments_batch(
  conn: &mut Conn,
  rows: &[GCSegmentsRow],
) -> Result<(), Error> {
  const ROW_PLACEHOLDER: &str = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";

  for chunk in rows.chunks(50) {
    let values_clause = std::iter::repeat(ROW_PLACEHOLDER)
      .take(chunk.len())
      .collect::<Vec<_>>()
      .join(", ");

    let sql = format!(
            "INSERT INTO gc_segments \
             (transcript_id, start, stop, speaker, transcript, segment_index, fast_mode, is_user_visible, is_orphan) \
             VALUES {}",
            values_clause
        );

    let params: Vec<Value> = chunk
      .iter()
      .flat_map(|row| {
        let base = vec![
          Value::from(row.transcript_id),
          Value::from(row.start.clone()),
          Value::from(row.stop.clone()),
          Value::from(row.speaker.clone()),
          row
            .transcript
            .as_ref()
            .map_or(Value::NULL, |t| Value::from(t.clone())),
          Value::from(row.segment_index),
          Value::from(row.fast_mode),
          Value::from(row.is_user_visible),
          Value::from(row.is_orphan),
        ];
        base
      })
      .collect();

    conn.exec_drop(sql, params).await?;
  }

  Ok(())
}

/// Updates rows in `gc_segments` in batches of 50. (for segment_update)
pub async fn update_segments_table(
  transcript_id: u64,
  state: Arc<SharedRequestState>,
  updates: Vec<SegmentUpdate>,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  for chunk in updates.chunks(50) {
    let mut params: Vec<mysql_async::Value> = Vec::new();

    let mut transcript_update_case_inner = String::new();
    for update in chunk.iter() {
      if let Some(text) = &update.transcript {
        transcript_update_case_inner.push_str(&format!(
          "WHEN segment_index = {} THEN ?\n",
          update.segment_index,
        ));
        params.push(mysql_async::Value::from(text));
      }
    }

    let transcript_update_case = if transcript_update_case_inner.is_empty() {
      "transcript,".to_string()
    } else {
      format!(
        "CASE
            {}
            ELSE transcript
          END,",
        transcript_update_case_inner
      )
    };

    let mut is_user_visible_update_case = String::new();
    for update in chunk.iter() {
      is_user_visible_update_case.push_str(&format!(
        "WHEN segment_index = {} THEN 1\n",
        update.segment_index,
      ));
    }

    let mut source_update_case = String::new();
    for update in chunk.iter() {
      source_update_case.push_str(&format!(
        "WHEN segment_index = {} THEN ?\n",
        update.segment_index,
      ));
      params.push(mysql_async::Value::from(&update.source));
    }

    let segment_indices: Vec<String> = chunk
      .iter()
      .map(|update| update.segment_index.to_string())
      .collect();

    let query = format!(
      "
        UPDATE gc_segments
        SET 
          transcript = {}
          is_user_visible = CASE 
            {}
            ELSE is_user_visible
          END,
          source = CASE 
            {}
            ELSE source
          END
        WHERE transcript_id = ?
        AND fast_mode = 0
        AND segment_index IN ({})
        ",
      transcript_update_case,
      is_user_visible_update_case,
      source_update_case,
      segment_indices.join(", ")
    );

    info!("update_segments_table query: {}", query);
    info!("update_segments_table params: {:?}", params);

    params.push(mysql_async::Value::from(transcript_id));

    conn.exec_drop(query, params).await?;
  }

  return Ok(());
}
