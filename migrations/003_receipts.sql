-- Printable booking and money receipts for MTI International.

CREATE TABLE IF NOT EXISTS booking_receipts (
  id BIGSERIAL PRIMARY KEY,
  receipt_no TEXT UNIQUE,
  receipt_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  received_by TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Other')),
  note TEXT,
  total_paisa BIGINT NOT NULL CHECK (total_paisa > 0),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_receipt_items (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES booking_receipts(id) ON DELETE CASCADE,
  passenger_id BIGINT REFERENCES passenger_files(id) ON DELETE SET NULL,
  passenger_name TEXT NOT NULL,
  passport_number TEXT NOT NULL,
  country TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS money_receipts (
  id BIGSERIAL PRIMARY KEY,
  receipt_no TEXT UNIQUE,
  receipt_date DATE NOT NULL,
  received_from TEXT NOT NULL,
  received_by TEXT NOT NULL,
  purpose TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Other')),
  note TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_receipts_date_idx ON booking_receipts (receipt_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS booking_receipt_items_receipt_idx ON booking_receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS money_receipts_date_idx ON money_receipts (receipt_date DESC, id DESC);

ALTER TABLE booking_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_receipts ENABLE ROW LEVEL SECURITY;
