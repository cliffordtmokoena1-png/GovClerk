use mysql_async::futures::GetConn;
use mysql_async::{OptsBuilder, Pool, SslOpts};
use std::env;
use std::path::Path;

#[derive(Clone)]
pub struct DbManager {
  pub pool: Pool,
}

impl DbManager {
  pub fn new() -> Self {
    let db_name = env::var("PLANETSCALE_DB").expect("PLANETSCALE_DB not found in env");
    let db_username =
      env::var("PLANETSCALE_DB_USERNAME").expect("PLANETSCALE_DB_USERNAME not found in env");
    let db_password =
      env::var("PLANETSCALE_DB_PASSWORD").expect("PLANETSCALE_DB_PASSWORD not found in env");
    let db_host = env::var("PLANETSCALE_DB_HOST").expect("PLANETSCALE_DB_HOST not found in env");

    let ssl_opts = if cfg!(target_os = "linux") {
      SslOpts::default()
        .with_root_certs(vec![Path::new("/etc/ssl/certs/ca-certificates.crt").into()])
    } else {
      SslOpts::default().with_root_certs(vec![Path::new("/etc/ssl/cert.pem").into()])
    };

    let opts = OptsBuilder::default()
      .ip_or_hostname(db_host)
      .user(Some(db_username))
      .pass(Some(db_password))
      .ssl_opts(ssl_opts)
      .db_name(Some(db_name));

    Self {
      pool: Pool::new(opts),
    }
  }

  pub fn get_conn(&self) -> GetConn {
    return self.pool.get_conn();
  }
}
