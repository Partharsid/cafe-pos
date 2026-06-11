export type UserRole = "super_admin" | "cafe_admin" | "cashier" | "customer";
export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "qr";

export interface Cafe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  royalty_percentage: number;
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
  created_at: string;
  menu_item?: MenuItem;
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
