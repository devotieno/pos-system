"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { AlertTriangle, LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useStaffProfile } from "@/hooks/useStaffProfile";
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
import type { Session } from "@/types/pos";

const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  pos: { title: "Sell", subtitle: "Search a product or tap a tile to add it to the sale." },
  inventory: { title: "Inventory", subtitle: "Manage products, prices, and stock across locations." },
  purchases: { title: "Purchases", subtitle: "Record goods received from suppliers." },
  stock: { title: "Stock ops", subtitle: "Transfer stock between locations or adjust for damage and counts." },
  reports: { title: "Reports", subtitle: "Sales, stock, and purchase history." },
  users: { title: "Users", subtitle: "Manage staff accounts and roles." },
  settings: { title: "Settings", subtitle: "Locations and KRA eTIMS integration." },
};

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm px-4 text-center">{children}</div>;
}

function NoAccessScreen({ email, reason }: { email: string | null; reason: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center">
        <AlertTriangle className="mx-auto text-amber-500 mb-3" size={28} />
        <h1 className="text-lg font-semibold text-slate-800 mb-1">No access</h1>
        <p className="text-sm text-slate-500 mb-1">
          {email ? <>Signed in as <span className="font-medium">{email}</span>.</> : null}
        </p>
        <p className="text-sm text-slate-500 mb-5">{reason}</p>
        <button
          onClick={() => signOut(getFirebaseAuth())}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function PosApp() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, notFound } = useStaffProfile(user?.uid ?? null);

  const staffReady = !!profile && profile.active !== false;
  const { state, update, loading: stateLoading, saveError } = useAppState(staffReady);

  const [view, setView] = useState<ViewKey | null>(null);
  const [reportsInitialTab, setReportsInitialTab] = useState<"sales" | "stock" | "low" | "purchases">("sales");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Once we know the signed-in user's role, land them on the first screen they're allowed to see.
  useEffect(() => {
    if (staffReady && profile && view === null) {
      const perms = ROLES[profile.role];
      setView(perms.canPOS ? "pos" : perms.canViewInventory ? "inventory" : "reports");
    }
    if (!user) {
      // Signed out (or a different session): reset so the next login recomputes the landing view.
      setView(null);
    }
  }, [staffReady, profile, user, view]);

  if (authLoading) return <FullScreenMessage>Loading e-pos(Ali's)...</FullScreenMessage>;
  if (!user) return <LoginScreen />;
  if (profileLoading) return <FullScreenMessage>Loading your account...</FullScreenMessage>;
  if (notFound || !profile) {
    return (
      <NoAccessScreen
        email={user.email}
        reason="There's no staff profile for this account yet. Ask your business owner or manager to add you from the Users screen."
      />
    );
  }
  if (profile.active === false) {
    return <NoAccessScreen email={user.email} reason="Your account has been disabled. Contact your admin." />;
  }
  if (stateLoading || !state || view === null) {
    return <FullScreenMessage>Loading e-pos(Ali's)...</FullScreenMessage>;
  }

  const session: Session = { userId: user.uid, userName: profile.name, role: profile.role, locationId: profile.locationId };
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
      <Sidebar
        view={view}
        setView={goToView}
        perms={perms}
        session={session}
        saveError={saveError}
        onLogout={() => signOut(getFirebaseAuth())}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          locationName={view !== "settings" && view !== "users" ? locationName : null}
          onMenuClick={() => setSidebarOpen(true)}
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
        {view === "users" && perms.canManageUsers && <UsersView appState={state} session={session} perms={perms} />}
        {view === "settings" && perms.canManageLocations && <SettingsView appState={state} update={update} />}
      </div>
    </div>
  );
}