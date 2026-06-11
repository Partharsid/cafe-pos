CREATE TYPE payment_method AS ENUM ('cash', 'upi_qr', 'razorpay', 'split');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  qr_code_url TEXT,
  split_details JSONB,
  cash_amount DECIMAL(10,2) DEFAULT 0,
  upi_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_cafe_id ON payments(cafe_id);
CREATE INDEX idx_payments_status ON payments(status);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_payments" ON payments FOR SELECT TO authenticated USING (get_user_role() = 'super_admin');
CREATE POLICY "cafe_staff_all_payments" ON payments FOR ALL TO authenticated USING (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier')) WITH CHECK (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.order_type = 'qr'));