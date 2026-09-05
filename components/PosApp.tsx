"use client";

import { useState } from "react";
import { useAppState } from "@/hooks/useAppState";
import { ROLES } from "@/lib/pos-constants";
import { LoginScreen } from "./pos/LoginScreen";
import { Sidebar, TopBar, type ViewKey } from "./pos/Shell";
import { POSView } from "./pos/POSView";
import { InventoryView } from "./pos/InventoryView";
import { PurchasesView } from "./pos/PurchasesView";
import { StockView } from "./pos/StockView";
import { ReportsView } from "./pos/ReportsView";
import { UsersView } from "./pos/UsersView";
import { SettingsView } from "./pos/SettingsView";
import { LowStockBell } from "./pos/LowStockBell";
import type { Session, UserAccount } from "@/types/pos";

const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  pos: { title: "Sell", subtitle: "Search a product or tap a tile to add it to the sale." },
  inventory: { title: "Inventory", subtitle: "Manage products, prices, and stock across locations." },
  purchases: { title: "Purchases", subtitle: "Record goods received from suppliers." },
  stock: { title: "Stock ops", subtitle: "Transfer stock between locations or adjust for damage and counts." },
  reports: { title: "Reports", subtitle: "Sales, stock, and purchase history." },
  users: { title: "Users", subtitle: "Manage staff accounts and roles." },
  settings: { title: "Settings", subtitle: "Locations and KRA eTIMS integration." },
};

export default function PosApp() {
  const { state, update, loading, saveError } = useAppState();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewKey>("pos");
  const [reportsInitialTab, setReportsInitialTab] = useState<"sales" | "stock" | "low" | "purchases">("sales");

  if (loading || !state) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading DukaBook POS...</div>;
  }

  if (!session) {
    return (
      <LoginScreen
        users={state.users}
        onLogin={(user: UserAccount) => {
          setSession({ userId: user.id, userName: user.name, role: user.role, locationId: user.locationId });
          const perms = ROLES[user.role];
          setView(perms.canPOS ? "pos" : perms.canViewInventory ? "inventory" : "reports");
        }}
      />
    );
  }

  const perms = ROLES[session.role];
  const locationName = state.locations.find((l) => l.id === session.locationId)?.name;
  const meta =
    view === "reports" && !perms.canViewAllSales
      ? { title: "My sales", subtitle: "Your own sales history and totals." }
      : VIEW_META[view];

  // Used by the sidebar for normal navigation, so Reports opens on "Sales" by default.
  // The low-stock bell sets reportsInitialTab itself and calls setView directly.
  const goToView = (v: ViewKey) => {
    setReportsInitialTab("sales");
    setView(v);
  };

  return (
    <div className="h-screen w-full flex bg-slate-50 text-slate-800 font-sans">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; top: 0; left: 0; }
        }
      `}</style>
      <Sidebar view={view} setView={goToView} perms={perms} session={session} saveError={saveError} onLogout={() => setSession(null)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          locationName={view !== "settings" && view !== "users" ? locationName : null}
          right={
            <LowStockBell
              appState={state}
              perms={perms}
              session={session}
              onViewReport={
                perms.canViewReports && perms.canViewAllSales
                  ? () => { setReportsInitialTab("low"); setView("reports"); }
                  : undefined
              }
            />
          }
        />
        {view === "pos" && perms.canPOS && <POSView appState={state} update={update} session={session} perms={perms} />}
        {view === "inventory" && perms.canViewInventory && <InventoryView appState={state} update={update} perms={perms} session={session} />}
        {view === "purchases" && perms.canPurchase && <PurchasesView appState={state} update={update} perms={perms} session={session} />}
        {view === "stock" && perms.canManageStock && <StockView appState={state} update={update} session={session} perms={perms} />}
        {view === "reports" && perms.canViewReports && (
          <ReportsView appState={state} session={session} perms={perms} initialTab={reportsInitialTab} />
        )}
        {view === "users" && perms.canManageUsers && <UsersView appState={state} update={update} session={session} perms={perms} />}
        {view === "settings" && perms.canManageLocations && <SettingsView appState={state} update={update} />}
      </div>
    </div>
  );
}
