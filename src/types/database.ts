export type UserRole = "super_admin" | "cafe_admin" | "cashier" | "customer";
export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "qr";
export type PaymentMethod = "cash" | "upi_qr" | "razorpay" | "split";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Cafe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  royalty_percentage: number;
  avg_prep_time_minutes: number;
  tax_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  cafe_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  cafe_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  cafe_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CafeTable {
  id: string;
  cafe_id: string;
  table_number: string;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  cafe_id: string;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  staff_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  royalty_amount: number;
  total: number;
  notes: string | null;
  cancellation_reason: string | null;
  discount_percentage: number;
  discount_amount: number;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  cafe?: Cafe;
  table?: CafeTable;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  modifiers: any | null;
  created_at: string;
  menu_item?: MenuItem;
}

export interface ItemModifier {
  id: string;
  menu_item_id: string;
  name: string;
  type: "select" | "multi";
  options: { name: string; price_modifier: number }[];
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoyaltyLog {
  id: string;
  cafe_id: string;
  order_id: string;
  order_total: number;
  royalty_percentage: number;
  royalty_amount: number;
  created_at: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  netEarnings: number;
  totalRoyalty: number;
  topItems: { name: string; count: number; revenue: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
}

export interface Payment {
  id: string;
  order_id: string;
  cafe_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  qr_code_url: string | null;
  split_details: any | null;
  cash_amount: number | null;
  upi_amount: number | null;
  created_at: string;
  updated_at: string;
}
