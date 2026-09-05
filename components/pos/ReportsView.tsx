"use client";

import { useState } from "react";
import { Boxes, ClipboardList, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge, Field, StatCard, inputCls } from "./ui";
import { fmt, fmtQty, todayStr } from "@/lib/pos-constants";
import type { AppState, Location, Product, RolePermissions, Session } from "@/types/pos";

type Tab = "sales" | "stock" | "low" | "purchases";

export function ReportsView({
  appState, session, perms, initialTab,
}: {
  appState: AppState;
  session: Session;
  perms: RolePermissions;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "sales");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const visibleLocations: Location[] = perms.multiLocation
    ? appState.locations
    : appState.locations.filter((l) => l.id === session.locationId);

  const inScope = (locationId: string) => perms.multiLocation || locationId === session.locationId;

  const salesInScope = appState.sales.filter((s) =>
    perms.canViewAllSales ? inScope(s.locationId) : s.cashierId === session.userId
  );

  const cashierOptions = Array.from(new Set(salesInScope.map((s) => s.cashierName))).sort();
  const paymentOptions = Array.from(new Set(salesInScope.map((s) => s.payment))).sort();

  const salesInRange = salesInScope.filter((s) => {
    const d = new Date(s.timestamp).toISOString().slice(0, 10);
    const matchesInvoice = !invoiceQuery.trim() || String(s.number).includes(invoiceQuery.trim());
    const matchesCashier = cashierFilter === "all" || s.cashierName === cashierFilter;
    const matchesPayment = paymentFilter === "all" || s.payment === paymentFilter;
    const pq = productQuery.trim().toLowerCase();
    const matchesProduct = !pq || s.items.some((it) => it.name.toLowerCase().includes(pq) || (it.code ?? "").toLowerCase().includes(pq));
    return d >= from && d <= to && s.status !== "returned" && matchesInvoice && matchesCashier && matchesPayment && matchesProduct;
  });
  const revenue = salesInRange.reduce((s, x) => s + x.total, 0);
  const byCashier: Record<string, number> = {};
  salesInRange.forEach((s) => { byCashier[s.cashierName] = (byCashier[s.cashierName] || 0) + s.total; });

  const lowStock: { p: Product; l: Location; qty: number }[] = appState.products.flatMap((p) =>
    visibleLocations
      .filter((l) => (p.stock[l.id] || 0) <= p.lowStockThreshold)
      .map((l) => ({ p, l, qty: p.stock[l.id] || 0 }))
  );

  const stockValue = appState.products.reduce(
    (s, p) => s + visibleLocations.reduce((a, l) => a + (p.stock[l.id] || 0), 0) * p.costPrice, 0
  );

  const visiblePurchases = appState.purchases.filter((p) => inScope(p.locationId));

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-md text-sm font-medium ${tab === key ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex gap-2 mb-4">
        {tabBtn("sales", perms.canViewAllSales ? "Sales" : "My sales")}
        {perms.canViewAllSales && tabBtn("stock", "Current stock")}
        {perms.canViewAllSales && tabBtn("low", "Low stock")}
        {perms.canViewAllSales && tabBtn("purchases", "Purchase history")}
      </div>

      {tab === "sales" && (
        <>
          <div className="flex items-end flex-wrap gap-3 mb-4">
            <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Invoice #">
              <input
                className={`${inputCls} w-32`}
                placeholder="e.g. 1001"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
              />
            </Field>
            <Field label="Product name or code">
              <input
                className={`${inputCls} w-48`}
                placeholder="e.g. Sugar or SUG-2KG"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </Field>
            {perms.canViewAllSales && (
              <Field label="Cashier">
                <select className={`${inputCls} w-40`} value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}>
                  <option value="all">All cashiers</option>
                  {cashierOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Payment type">
              <select className={`${inputCls} w-36`} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="all">All types</option>
                {paymentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Revenue" value={fmt(revenue)} icon={TrendingUp} />
            <StatCard label="Transactions" value={salesInRange.length} icon={ShoppingCart} tone="slate" />
            <StatCard label="Avg. sale" value={fmt(salesInRange.length ? revenue / salesInRange.length : 0)} icon={ClipboardList} tone="slate" />
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Products</th>
                  <th className="px-4 py-2.5 font-medium">Cashier</th><th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...salesInRange].reverse().map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">#{s.number}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(s.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate" title={s.items.map((i) => `${i.name} (${i.code ?? "-"})`).join(", ")}>
                      {s.items.map((i) => `${i.name} (${i.code ?? "-"})`).join(", ")}
                    </td>
                    <td className="px-4 py-2.5">{s.cashierName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.payment}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(s.total)}</td>
                  </tr>
                ))}
                {salesInRange.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No sales match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {perms.canViewAllSales && Object.keys(byCashier).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 max-w-md">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Revenue by cashier</h3>
              {Object.entries(byCashier).map(([name, amt]) => (
                <div key={name} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-600">{name}</span><span className="font-medium">{fmt(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "stock" && (
        <>
          <div className="mb-4"><StatCard label="Total stock value (at cost)" value={fmt(stockValue)} icon={Boxes} /></div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  {visibleLocations.map((l) => <th key={l.id} className="px-4 py-2.5 font-medium">{l.name}</th>)}
                  <th className="px-4 py-2.5 font-medium text-right">Value at cost</th>
                </tr>
              </thead>
              <tbody>
                {appState.products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.name} <span className="text-slate-400 font-normal">({p.unit})</span></td>
                    {visibleLocations.map((l) => <td key={l.id} className="px-4 py-2.5">{fmtQty(p.stock[l.id] || 0)}</td>)}
                    <td className="px-4 py-2.5 text-right">{fmt(visibleLocations.reduce((a, l) => a + (p.stock[l.id] || 0), 0) * p.costPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "low" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">In stock</th><th className="px-4 py-2.5 font-medium">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map(({ p, l, qty }, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.name}</td>
                  <td className="px-4 py-2.5"><Badge tone={qty <= 0 ? "rose" : "amber"}>{fmtQty(qty)} {p.unit}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtQty(p.lowStockThreshold)}</td>
                </tr>
              ))}
              {lowStock.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nothing is low on stock right now.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "purchases" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Supplier</th><th className="px-4 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...visiblePurchases].reverse().map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">{p.number}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.supplier}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(p.total)}</td>
                </tr>
              ))}
              {visiblePurchases.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No purchases recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
