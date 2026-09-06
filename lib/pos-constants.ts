import type { AppState, Product, Role, RolePermissions, Unit } from "@/types/pos";

export const UNITS: Unit[] = [
  "piece", "kg", "g", "litre", "ml", "metre", "bag", "carton", "box", "dozen",
];

export const ROLES: Record<Role, RolePermissions> = {
  owner: {
    label: "Owner / Admin",
    canPOS: true, canViewInventory: true, canEditInventory: true,
    canManageStock: true, canPurchase: true, canEditCost: true,
    canManageUsers: true, canViewReports: true, canManageLocations: true,
    canReturn: true, multiLocation: true, canViewAllSales: true, canManageAllUsers: true,
  },
  manager: {
    label: "Manager",
    canPOS: true, canViewInventory: true, canEditInventory: true,
    canManageStock: true, canPurchase: true, canEditCost: true,
    canManageUsers: true, canViewReports: true, canManageLocations: false,
    canReturn: true, multiLocation: false, canViewAllSales: true, canManageAllUsers: false,
  },
  storekeeper: {
    label: "Storekeeper",
    canPOS: false, canViewInventory: true, canEditInventory: false,
    canManageStock: true, canPurchase: true, canEditCost: false,
    canManageUsers: false, canViewReports: true, canManageLocations: false,
    canReturn: false, multiLocation: false, canViewAllSales: true, canManageAllUsers: false,
  },
  cashier: {
    label: "Cashier",
    canPOS: true, canViewInventory: true, canEditInventory: false,
    canManageStock: false, canPurchase: false, canEditCost: false,
    canManageUsers: false, canViewReports: true, canManageLocations: false,
    canReturn: true, multiLocation: false, canViewAllSales: false, canManageAllUsers: false,
  },
};

/** Firestore document id (within the private/shared "storage" collections) that holds the whole app state. */
export const STORAGE_KEY = "dukabook-pos-state-v1";

export const fmt = (n: number): string =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

export const fmtQty = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
};

export const genId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export function seedState(): AppState {
  const loc1 = genId("loc");
  const loc2 = genId("loc");

  const p = (
    code: string, name: string, unit: Unit, sellPrice: number, costPrice: number,
    qty1: number, qty2: number, low: number
  ): Product => ({
    id: genId("prod"), code, name, unit, sellPrice, costPrice, lowStockThreshold: low,
    category: "General",
    stock: { [loc1]: qty1, [loc2]: qty2 },
  });

  const products: Product[] = [
    p("SUG-2KG", "Sugar 2kg Bag", "bag", 260, 220, 40, 12, 10),
    p("RICE-BULK", "Pishori Rice", "kg", 165, 130, 85.5, 20, 15),
    p("OIL-1L", "Cooking Oil 1L", "piece", 320, 270, 30, 8, 8),
    p("FAB-ANK", "Ankara Fabric", "metre", 450, 350, 24, 6, 5),
    p("SODA-CRT", "Soda Crate (Assorted)", "carton", 1450, 1200, 15, 4, 4),
    p("MAIZE-FLR", "Maize Flour 2kg", "bag", 210, 175, 60, 18, 12),
  ];

  return {
    locations: [
      { id: loc1, name: "Main Store" },
      { id: loc2, name: "Branch - Eldoret Town" },
    ],
    products,
    sales: [],
    purchases: [],
    stockMovements: [],
    nextInvoiceNo: 1001,
    etims: { connected: false, kraPin: "", deviceId: "" },
  };
}