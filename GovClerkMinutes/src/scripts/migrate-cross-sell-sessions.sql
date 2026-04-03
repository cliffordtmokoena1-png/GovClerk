CREATE TABLE IF NOT EXISTS gc_cross_sell_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id VARCHAR(255) NOT NULL UNIQUE,
  org_name VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'entry',
  hours_needed INT,
  recommended_plan VARCHAR(100),
  org_email VARCHAR(255),
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_state (state),
  INDEX idx_last_message_at (last_message_at)
);
