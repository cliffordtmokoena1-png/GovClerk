use mysql_async::{
  params,
  prelude::{Query, WithParams},
  Conn,
};

pub async fn get_current_balance(conn: &mut Conn, user_id: String) -> anyhow::Result<i32> {
  let payment_rows = r"SELECT SUM(credit) FROM payments WHERE user_id = :user_id;"
    .with(params! {
      "user_id" => user_id.clone(),
    })
    .map(conn, |sum: i32| {
      return sum;
    })
    .await?;

  return payment_rows
    .first()
    .cloned()
    .ok_or(anyhow::anyhow!("No balance found"));
}
