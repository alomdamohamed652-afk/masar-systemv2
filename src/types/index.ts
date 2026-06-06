// ============================================================
// MASAR — Complete Database Types
// Generated from final approved schema
// ============================================================

export type Role =
  | 'founder'
  | 'manager'
  | 'accountant'
  | 'customer_service'
  | 'warehouse'
  | 'employee'

export type OrderStatus =
  | 'new'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type OrderSource = 'manual' | 'wuilt'

export type MovementType =
  | 'add'
  | 'remove'
  | 'adjustment'
  | 'damaged'
  | 'customer_return'
  | 'warehouse_transfer'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export type IntegrationStatus = 'active' | 'inactive' | 'error'
export type BackupType = 'json' | 'pg_dump'

// ============================================================
// Core tables
// ============================================================

export interface Profile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: Role
  is_active: boolean
  last_login_at: string | null
  last_active_at: string | null
  created_at: string
  updated_at: string
}

export interface Settings {
  id: string
  brand_name: string
  logo_light_url: string | null
  logo_dark_url: string | null
  currency: string
  tax_rate: number
  low_stock_threshold: number
  phone: string | null
  email: string | null
  address: string | null
  timezone: string
  updated_at: string
}

export interface RolePermissions {
  id: string
  role: Role
  orders: boolean
  products: boolean
  inventory: boolean
  customers: boolean
  expenses: boolean
  reports: boolean
  hr: boolean
  settings: boolean
  updated_at: string
}

// ============================================================
// Products & Inventory
// ============================================================

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Warehouse {
  id: string
  name: string
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  sku: string | null
  barcode: string | null
  internal_code: string | null
  supplier: string | null
  brand: string | null
  description: string | null
  cost_price: number
  sell_price: number
  created_at: string
  updated_at: string
  // Joined
  category?: Category
  images?: ProductImage[]
  variants?: ProductVariant[]
}

export interface ProductImage {
  id: string
  product_id: string
  image_url: string
  sort_order: number
  is_primary: boolean
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  color: string | null
  size: string | null
  sku_variant: string | null
  // Joined
  stock?: WarehouseStock[]
}

export interface WarehouseStock {
  id: string
  warehouse_id: string
  product_id: string
  variant_id: string
  quantity: number
  updated_at: string
  // Joined
  warehouse?: Warehouse
  variant?: ProductVariant
}

export interface InventoryMovement {
  id: string
  warehouse_id: string
  product_id: string
  variant_id: string
  movement_type: MovementType
  quantity: number
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  // Joined
  warehouse?: Warehouse
  product?: Product
  variant?: ProductVariant
  creator?: Profile
}

// ============================================================
// Orders & Customers
// ============================================================

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  governorate: string | null
  notes: string | null
  tags: string[]
  facebook_url: string | null
  instagram_username: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_id: string | null
  status: OrderStatus
  source: OrderSource
  external_id: string | null
  shipping_company: string | null
  tracking_number: string | null
  internal_notes: string | null
  customer_notes: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  customer?: Customer
  items?: OrderItem[]
  creator?: Profile
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  color: string | null
  size: string | null
  quantity: number
  unit_price: number
  total_price: number
  // Joined
  product?: Product
  variant?: ProductVariant
}

export interface Expense {
  id: string
  beneficiary: string | null
  phone: string | null
  category: string | null
  amount: number
  notes: string | null
  invoice_url: string | null
  created_by: string | null
  created_at: string
  // Joined
  creator?: Profile
}

// ============================================================
// HR & Tasks
// ============================================================

export interface Task {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  created_by: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  created_at: string
  updated_at: string
  // Joined
  assignee?: Profile
  creator?: Profile
  comments?: TaskComment[]
  attachments?: TaskAttachment[]
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: Profile
}

export interface TaskAttachment {
  id: string
  task_id: string
  user_id: string | null
  file_url: string
  file_name: string | null
  created_at: string
  user?: Profile
}

export interface Salary {
  id: string
  user_id: string
  month: string // ISO date string: '2025-01-01'
  base_salary: number
  bonus: number
  deduction: number
  final_salary: number // generated
  notes: string | null
  created_at: string
  user?: Profile
}

export interface LeaveRequest {
  id: string
  user_id: string
  type: LeaveType
  start_date: string
  end_date: string
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  user?: Profile
  reviewer?: Profile
}

// ============================================================
// Logs & System
// ============================================================

export interface ActivityLog {
  id: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  action: string
  entity: string | null
  entity_id: string | null
  description: string | null
  ip_address: string | null
  browser: string | null
  device_type: string | null
  os: string | null
  timestamp: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_name: string | null
  entity: string
  entity_id: string | null
  field: string
  old_value: string | null
  new_value: string | null
  timestamp: string
}

export interface Integration {
  id: string
  name: string
  api_key: string | null
  status: IntegrationStatus
  last_sync_at: string | null
  created_at: string
}

export interface Backup {
  id: string
  type: BackupType
  file_url: string
  file_name: string | null
  size_bytes: number | null
  created_by: string | null
  created_at: string
  creator?: Profile
}

// ============================================================
// Dashboard & Reports
// ============================================================

export interface DashboardStats {
  total_orders: number
  total_revenue: number
  total_expenses: number
  net_profit: number
  orders_by_status: Record<OrderStatus, number>
  top_products: Array<{ product_id: string; name: string; total_sold: number; revenue: number }>
  top_customers: Array<{ customer_id: string; name: string; order_count: number; total_spent: number }>
  low_stock: Array<{ product_id: string; variant_id: string; name: string; color: string | null; size: string | null; quantity: number; warehouse: string }>
}

export type DatePeriod = 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'custom'

export interface PeriodFilter {
  period: DatePeriod
  from?: string
  to?: string
}

// ============================================================
// API Response wrappers
// ============================================================

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
