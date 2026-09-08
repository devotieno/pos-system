"use client";

import {
  ShoppingCart, Package, Truck, ArrowLeftRight, BarChart3, Users, Settings,
  LogOut, Wifi, WifiOff, Store, Menu, X, type LucideIcon,
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
  view, setView, perms, session, onLogout, saveError, open, onClose,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  perms: RolePermissions;
  session: Session;
  onLogout: () => void;
  saveError: boolean;
  /** Whether the mobile off-canvas drawer is open. Ignored at md+ widths, where it's always visible. */
  open: boolean;
  onClose: () => void;
}) {
  const navigate = (v: ViewKey) => {
    setView(v);
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 md:w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col h-full transform transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-emerald-600 text-white p-1.5 rounded-md shrink-0">
              <Store size={18} />
            </div>
            <span className="text-white font-semibold text-sm truncate">e-pos(Ali&apos;s)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white md:hidden shrink-0" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((n) => perms[n.need]).map((n) => {
            const Icon = n.icon;
            const active = view === n.key;
            const label = n.key === "reports" && !perms.canViewAllSales ? "My sales" : n.label;
            return (
              <button
                key={n.key}
                onClick={() => navigate(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-300"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-800 text-xs shrink-0">
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
    </>
  );
}

export function TopBar({
  title, subtitle, locationName, right, onMenuClick,
}: {
  title: string;
  subtitle?: string;
  locationName?: string | null;
  right?: React.ReactNode;
  onMenuClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-slate-700 shrink-0 -ml-1 p-1"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h1>
          {subtitle && <p className="hidden sm:block text-sm text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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