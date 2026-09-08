"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { fmtQty } from "@/lib/pos-constants";
import type { AppState, RolePermissions, Session } from "@/types/pos";

export function LowStockBell({
  appState, perms, session, onViewReport,
}: {
  appState: AppState;
  perms: RolePermissions;
  session: Session;
  onViewReport?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const visibleLocations = perms.multiLocation
    ? appState.locations
    : appState.locations.filter((l) => l.id === session.locationId);

  const lowStockItems = useMemo(
    () =>
      appState.products.flatMap((p) =>
        visibleLocations
          .filter((l) => (p.stock[l.id] || 0) <= p.lowStockThreshold)
          .map((l) => ({ product: p, location: l, qty: p.stock[l.id] || 0 }))
      ),
    [appState.products, visibleLocations]
  );

  const count = lowStockItems.length;
  const showReportLink = !!onViewReport && perms.canViewReports && perms.canViewAllSales;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
        aria-label="Low stock alerts"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-semibold leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-sm font-semibold text-slate-800">Low stock alerts</h3>
              <span className="text-xs text-slate-400">{count} item{count === 1 ? "" : "s"}</span>
            </div>
            {count === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 px-4">Nothing is low on stock right now.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStockItems.map(({ product, location, qty }, i) => (
                  <li key={i} className="px-4 py-2.5 flex items-start gap-2">
                    <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${qty <= 0 ? "text-rose-500" : "text-amber-500"}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{product.name}</div>
                      <div className="text-xs text-slate-400">
                        {location.name} &middot; {fmtQty(qty)} {product.unit} left (threshold {fmtQty(product.lowStockThreshold)})
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {showReportLink && (
              <button
                onClick={() => { setOpen(false); onViewReport?.(); }}
                className="w-full text-center text-sm text-emerald-700 hover:bg-emerald-50 py-2.5 border-t border-slate-100"
              >
                View full low stock report
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}