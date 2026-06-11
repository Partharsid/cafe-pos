-- ============================================================
-- RR Downtown Arcade - Cafe POS Schema
-- Multi-tenant Cloud POS & QR Table Ordering System
-- ============================================================

-- ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'cafe_admin', 'cashier', 'customer');
CREATE TYPE order_status AS ENUM ('pending', 'preparing', 'ready', 'completed', 'cancelled');
CREATE TYPE order_type_enum AS ENUM ('dine_in', 'takeaway', 'qr');

-- EXTENSIONS (pgcrypto is available by default in Supabase for gen_random_uuid())

-- ============================================================
-- TABLES
-- ============================================================

-- 1. CAFES
CREATE TABLE cafes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  royalty_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cafe_id UUID REFERENCES cafes(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MENU CATEGORIES
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. MENU ITEMS
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INT,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABLES
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  qr_code_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cafe_id, table_number)
);

-- 6. ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_type order_type_enum NOT NULL DEFAULT 'dine_in',
  status order_status NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  royalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ORDER ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ROYALTY LOGS
CREATE TABLE royalty_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_total DECIMAL(10,2) NOT NULL,
  royalty_percentage DECIMAL(5,2) NOT NULL,
  royalty_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_profiles_cafe_id ON profiles(cafe_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_menu_categories_cafe_id ON menu_categories(cafe_id);
CREATE INDEX idx_menu_items_cafe_id ON menu_items(cafe_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_tables_cafe_id ON tables(cafe_id);
CREATE INDEX idx_orders_cafe_id ON orders(cafe_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_royalty_logs_cafe_id ON royalty_logs(cafe_id);

-- ============================================================
-- HELPER FUNCTIONS for RLS
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_cafe_id()
RETURNS UUID AS $$
  SELECT cafe_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_logs ENABLE ROW LEVEL SECURITY;

-- --- CAFES ---
CREATE POLICY "super_admin_full_access_cafes" ON cafes
  FOR ALL TO authenticated
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_read_own_cafe" ON cafes
  FOR SELECT TO authenticated
  USING (id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));

CREATE POLICY "anon_read_active_cafes" ON cafes
  FOR SELECT TO anon
  USING (is_active = true);

-- --- PROFILES ---
CREATE POLICY "super_admin_full_access_profiles" ON profiles
  FOR ALL TO authenticated
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "cafe_admin_manage_cashiers" ON profiles
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'cafe_admin'
    AND (cafe_id = get_user_cafe_id() OR id = auth.uid())
    AND role IN ('cashier', 'customer')
  )
  WITH CHECK (
    get_user_role() = 'cafe_admin'
    AND cafe_id = get_user_cafe_id()
    AND role = 'cashier'
  );

CREATE POLICY "users_read_update_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = get_user_role());

-- --- MENU CATEGORIES ---
CREATE POLICY "super_admin_read_categories" ON menu_categories
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_manage_categories" ON menu_categories
  FOR ALL TO authenticated
  USING (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'))
  WITH CHECK (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));

CREATE POLICY "anon_read_categories" ON menu_categories
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM cafes WHERE cafes.id = menu_categories.cafe_id AND cafes.is_active = true));

-- --- MENU ITEMS ---
CREATE POLICY "super_admin_read_items" ON menu_items
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_manage_items" ON menu_items
  FOR ALL TO authenticated
  USING (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'))
  WITH CHECK (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));

CREATE POLICY "anon_read_available_items" ON menu_items
  FOR SELECT TO anon
  USING (is_available = true AND EXISTS (SELECT 1 FROM cafes WHERE cafes.id = menu_items.cafe_id AND cafes.is_active = true));

-- --- TABLES ---
CREATE POLICY "super_admin_read_tables" ON tables
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_manage_tables" ON tables
  FOR ALL TO authenticated
  USING (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'))
  WITH CHECK (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));

-- --- ORDERS ---
CREATE POLICY "super_admin_read_orders" ON orders
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_all_orders" ON orders
  FOR ALL TO authenticated
  USING (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'))
  WITH CHECK (cafe_id = get_user_cafe_id() AND get_user_role() IN ('cafe_admin', 'cashier'));

CREATE POLICY "anon_insert_qr_order" ON orders
  FOR INSERT TO anon
  WITH CHECK (order_type = 'qr');

CREATE POLICY "anon_select_own_qr_order" ON orders
  FOR SELECT TO anon
  USING (order_type = 'qr' AND customer_phone IS NOT NULL);

-- --- ORDER ITEMS ---
CREATE POLICY "super_admin_read_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_staff_all_order_items" ON order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.cafe_id = get_user_cafe_id()
    )
    AND get_user_role() IN ('cafe_admin', 'cashier')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.cafe_id = get_user_cafe_id()
    )
    AND get_user_role() IN ('cafe_admin', 'cashier')
  );

CREATE POLICY "anon_insert_qr_order_items" ON order_items
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.order_type = 'qr'
    )
  );

-- --- ROYALTY LOGS ---
CREATE POLICY "super_admin_read_royalty" ON royalty_logs
  FOR SELECT TO authenticated
  USING (get_user_role() = 'super_admin');

CREATE POLICY "cafe_admin_read_own_royalty" ON royalty_logs
  FOR SELECT TO authenticated
  USING (cafe_id = get_user_cafe_id() AND get_user_role() = 'cafe_admin');

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cafes_updated_at BEFORE UPDATE ON cafes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'customer');
  RETURN NEW;
END;
$$ language 'plpgsql' security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
