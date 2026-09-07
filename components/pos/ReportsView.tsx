"use client";

import { useState } from "react";
import { Boxes, ClipboardList, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge, Field, StatCard, inputCls } from "./ui";
import { SaleDetailModal } from "./SaleDetailModal";
import { fmt, fmtQty, todayStr } from "@/lib/pos-constants";
import type { AppState, Location, Product, RolePermissions, Sale, Session } from "@/types/pos";

const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

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
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  const visibleLocations: Location[] = perms.multiLocation
    ? appState.locations
    : appState.locations.filter((l) => l.id === session.locationId);

  const inScope = (locationId: string) => perms.multiLocation || locationId === session.locationId;

  const salesInScope = appState.sales.filter((s) =>
    perms.canViewAllSales ? inScope(s.locationId) : s.cashierId === session.userId
  );

  const cashierOptions = Array.from(new Set(salesInScope.map((s) => s.cashierName))).sort();
  const paymentOptions = Array.from(new Set(salesInScope.flatMap((s) => s.payments.map((p) => p.method)))).sort();

  const salesInRange = salesInScope.filter((s) => {
    const d = new Date(s.timestamp).toISOString().slice(0, 10);
    const matchesInvoice = !invoiceQuery.trim() || String(s.number).includes(invoiceQuery.trim());
    const matchesCashier = cashierFilter === "all" || s.cashierName === cashierFilter;
    const matchesPayment = paymentFilter === "all" || s.payments.some((p) => p.method === paymentFilter);
    const pq = productQuery.trim().toLowerCase();
    const matchesProduct = !pq || s.items.some((it) => it.name.toLowerCase().includes(pq) || (it.code ?? "").toLowerCase().includes(pq));
    return d >= from && d <= to && matchesInvoice && matchesCashier && matchesPayment && matchesProduct;
  });
  // Net revenue per sale = total charged minus whatever's been refunded so far. A partial
  // return only reduces revenue by the refunded portion, not the whole invoice.
  const netOf = (s: (typeof salesInRange)[number]) => s.total - (s.refundedTotal || 0);
  const revenue = salesInRange.reduce((s, x) => s + netOf(x), 0);
  const byCashier: Record<string, number> = {};
  salesInRange.forEach((s) => { byCashier[s.cashierName] = (byCashier[s.cashierName] || 0) + netOf(s); });

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
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Products</th>
                  <th className="px-4 py-2.5 font-medium">Cashier</th>
                  {perms.multiLocation && <th className="px-4 py-2.5 font-medium">Location</th>}
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Discount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...salesInRange].reverse().map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setViewingSale(s)}
                        className="font-medium text-emerald-700 hover:underline"
                        title="View full invoice details"
                      >
                        #{s.number}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap" title={new Date(s.timestamp).toLocaleString()}>
                      {fmtDateTime(s.timestamp)}
                    </td>
                    <td
                      className="px-4 py-2.5 text-slate-500 max-w-[10rem] truncate"
                      title={s.items.map((i) => `${i.name} (${i.code ?? "-"})`).join(", ")}
                    >
                      {s.items.map((i) => i.code ?? i.name).join(", ")}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{s.cashierName}</td>
                    {perms.multiLocation && (
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {appState.locations.find((l) => l.id === s.locationId)?.name ?? "-"}
                      </td>
                    )}
                    <td
                      className="px-4 py-2.5 text-slate-500 whitespace-nowrap"
                      title={s.payments.map((p) => `${p.method}: ${fmt(p.amount)}`).join(", ")}
                    >
                      {s.payments.length > 1
                        ? s.payments.map((p) => p.method).join(" + ")
                        : (s.payments[0]?.method ?? "-")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500" title={s.discount?.reason ?? undefined}>
                      {s.discount ? (
                        <span>
                          -{fmt(s.discount.amount)}
                          {s.discount.type === "percent" ? ` (${s.discount.value}%)` : ""}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.status === "returned" && <Badge tone="rose">Returned</Badge>}
                      {s.status === "partially_returned" && <Badge tone="amber">Partial return</Badge>}
                      {s.status === "completed" && <Badge tone="emerald">Completed</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {fmt(netOf(s))}
                      {(s.refundedTotal || 0) > 0 && (
                        <div className="text-xs text-slate-400 font-normal">of {fmt(s.total)}</div>
                      )}
                    </td>
                  </tr>
                ))}
                {salesInRange.length === 0 && <tr><td colSpan={perms.multiLocation ? 9 : 8} className="px-4 py-8 text-center text-slate-400">No sales match your filters.</td></tr>}
              </tbody>
            </table>
            </div>
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
            <div className="overflow-x-auto">
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
          </div>
        </>
      )}

      {tab === "low" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
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
        </div>
      )}

      {tab === "purchases" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
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
        </div>
      )}
      {viewingSale && (
        <SaleDetailModal
          sale={viewingSale}
          locationName={appState.locations.find((l) => l.id === viewingSale.locationId)?.name ?? "-"}
          onClose={() => setViewingSale(null)}
        />
      )}
    </div>
  );
}