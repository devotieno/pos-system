"use client";

import {
  ShoppingCart, Package, Truck, ArrowLeftRight, BarChart3, Users, Settings,
  LogOut, Wifi, WifiOff, Store, type LucideIcon,
} from "lucide-react";
import { Badge } from "./ui";
import { ROLES } from "@/lib/pos-constants";
import type { RolePermissions, Session } from "@/types/pos";

export type ViewKey = "pos" | "inventory" | "purchases" | "stock" | "reports" | "users" | "settings";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  need: keyof RolePermissions;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "pos", label: "Sell", icon: ShoppingCart, need: "canPOS" },
  { key: "inventory", label: "Inventory", icon: Package, need: "canViewInventory" },
  { key: "purchases", label: "Purchases", icon: Truck, need: "canPurchase" },
  { key: "stock", label: "Stock ops", icon: ArrowLeftRight, need: "canManageStock" },
  { key: "reports", label: "Reports", icon: BarChart3, need: "canViewReports" },
  { key: "users", label: "Users", icon: Users, need: "canManageUsers" },
  { key: "settings", label: "Settings", icon: Settings, need: "canManageLocations" },
];

export function Sidebar({
  view, setView, perms, session, onLogout, saveError,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  perms: RolePermissions;
  session: Session;
  onLogout: () => void;
  saveError: boolean;
}) {
  return (
    <div className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
        <div className="bg-emerald-600 text-white p-1.5 rounded-md">
          <Store size={18} />
        </div>
        <span className="text-white font-semibold text-sm">DukaBook POS</span>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.filter((n) => perms[n.need]).map((n) => {
          const Icon = n.icon;
          const active = view === n.key;
          const label = n.key === "reports" && !perms.canViewAllSales ? "My sales" : n.label;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                active ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 mb-2 text-slate-400">
          {saveError ? (
            <>
              <WifiOff size={13} className="text-amber-400" /> <span>Sync issue - retrying</span>
            </>
          ) : (
            <>
              <Wifi size={13} className="text-emerald-400" /> <span>Synced</span>
            </>
          )}
        </div>
        <div className="text-slate-200 font-medium truncate">{session.userName}</div>
        <div className="text-slate-500">{ROLES[session.role].label}</div>
        <button onClick={onLogout} className="mt-2 flex items-center gap-1.5 text-slate-400 hover:text-white">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function TopBar({
  title, subtitle, locationName, right,
}: {
  title: string;
  subtitle?: string;
  locationName?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {locationName && (
          <Badge tone="emerald">
            <Store size={11} className="inline mr-1 -mt-0.5" />
            {locationName}
          </Badge>
        )}
        {right}
      </div>
    </div>
  );
}
