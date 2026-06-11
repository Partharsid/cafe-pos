-- Item modifiers for menu items (sizes, add-ons)
CREATE TABLE IF NOT EXISTS item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'select',
  options JSONB NOT NULL DEFAULT '[]',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add tax_percentage to cafes if not present
ALTER TABLE cafes ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC NOT NULL DEFAULT 5;

-- Add discount fields to orders if not present
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;

-- Add cancellation_reason to orders if not present
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add modifiers to order_items if not present
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers JSONB;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_modifiers_menu_item_id ON item_modifiers(menu_item_id);