export type Unit =
  | "piece" | "kg" | "g" | "litre" | "ml" | "metre" | "bag" | "carton" | "box" | "dozen";

export type Role = "owner" | "manager" | "storekeeper" | "cashier";

/** Roles a manager (as opposed to owner/admin) is allowed to create or edit. */
export const MANAGER_ASSIGNABLE_ROLES: Role[] = ["storekeeper", "cashier"];

export interface RolePermissions {
  label: string;
  canPOS: boolean;
  canViewInventory: boolean;
  canEditInventory: boolean;
  canManageStock: boolean;
  canPurchase: boolean;
  canEditCost: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageLocations: boolean;
  canReturn: boolean;
  /** Only true for owner/admin: can see and act across every location instead of just their own. */
  multiLocation: boolean;
  /** False for cashiers: they can view a sales report, but only their own sales, not the whole store's. */
  canViewAllSales: boolean;
  /**
   * True only for owner/admin: can manage every user, any role, any store. Managers also have
   * canManageUsers=true but are restricted (see roleManageableRoles below) to creating/editing
   * cashiers and storekeepers within their own store only.
   */
  canManageAllUsers: boolean;
}

export interface Location {
  id: string;
  name: string;
}

export interface UserAccount {
  id: string;
  username: string;
  /** Plaintext for demo purposes only — see README for why this must change before real use. */
  password: string;
  name: string;
  role: Role;
  /** The location/branch this user is assigned to. Set by an admin when creating the account. */
  locationId: string;
  active?: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: Unit;
  sellPrice: number;
  costPrice: number;
  lowStockThreshold: number;
  category: string;
  /** locationId -> quantity in stock */
  stock: Record<string, number>;
}

export interface SaleItem {
  productId: string;
  code?: string;
  name: string;
  unit: Unit;
  qty: number;
  price: number;
  lineTotal: number;
}

export type SaleStatus = "completed" | "returned" | "partially_returned";

export interface Sale {
  id: string;
  number: number;
  timestamp: number;
  cashierId: string;
  cashierName: string;
  locationId: string;
  items: SaleItem[];
  total: number;
  payment: string;
  status: SaleStatus;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  unit: Unit;
  qty: number;
  cost: number;
}

export interface Purchase {
  id: string;
  number: number;
  timestamp: number;
  supplier: string;
  locationId: string;
  recordedBy: string;
  items: PurchaseItem[];
  total: number;
}

export type MovementType = "sale" | "return" | "purchase" | "transfer" | "adjustment";

export interface StockMovement {
  id: string;
  timestamp: number;
  type: MovementType;
  productId: string;
  productName: string;
  locationId: string;
  toLocationId?: string;
  qty: number;
  reason: string;
  user: string;
}

export interface EtimsSettings {
  connected: boolean;
  kraPin: string;
  deviceId: string;
}

export interface AppState {
  locations: Location[];
  users: UserAccount[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  stockMovements: StockMovement[];
  nextInvoiceNo: number;
  etims: EtimsSettings;
}

export interface Session {
  userId: string;
  userName: string;
  role: Role;
  locationId: string;
}

/** Function shape used everywhere to apply an immutable update to AppState and persist it. */
export type UpdateFn = (updater: (prev: AppState) => AppState) => void;
