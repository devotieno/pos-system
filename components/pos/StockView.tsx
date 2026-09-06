"use client";

import { useState } from "react";
import { Badge, Field, btnPrimary, inputCls } from "./ui";
import { fmtQty, genId } from "@/lib/pos-constants";
import type { AppState, RolePermissions, Session, UpdateFn } from "@/types/pos";

type Tab = "transfer" | "adjust" | "log";

export function StockView({
  appState, update, session, perms,
}: {
  appState: AppState;
  update: UpdateFn;
  session: Session;
  perms: RolePermissions;
}) {
  const [tab, setTab] = useState<Tab>(perms.multiLocation ? "transfer" : "adjust");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [tProduct, setTProduct] = useState("");
  const [tFrom, setTFrom] = useState(session.locationId);
  const [tTo, setTTo] = useState(appState.locations.find((l) => l.id !== session.locationId)?.id ?? "");
  const [tQty, setTQty] = useState("");

  const [aProduct, setAProduct] = useState("");
  const aLoc = session.locationId;
  const [aDelta, setADelta] = useState("");
  const [aReason, setAReason] = useState("Stock count correction");

  const doTransfer = () => {
    setError(""); setOk("");
    const qty = parseFloat(tQty);
    const p = appState.products.find((x) => x.id === tProduct);
    if (!p || !qty || qty <= 0) { setError("Choose a product and a quantity greater than zero."); return; }
    if (tFrom === tTo) { setError("Source and destination locations must differ."); return; }
    if ((p.stock[tFrom] || 0) < qty) { setError(`Not enough stock at source: only ${fmtQty(p.stock[tFrom] || 0)} ${p.unit} available.`); return; }
    update((prev) => {
      const products = prev.products.map((x) =>
        x.id !== p.id ? x : { ...x, stock: { ...x.stock, [tFrom]: (x.stock[tFrom] || 0) - qty, [tTo]: (x.stock[tTo] || 0) + qty } }
      );
      const mv = {
        id: genId("mv"), timestamp: Date.now(), type: "transfer" as const, productId: p.id, productName: p.name,
        locationId: tFrom, toLocationId: tTo, qty, reason: "Stock transfer", user: session.userName,
      };
      return { ...prev, products, stockMovements: [...prev.stockMovements, mv] };
    });
    setOk(`Transferred ${fmtQty(qty)} ${p.unit} of ${p.name}.`);
    setTQty("");
  };

  const doAdjust = () => {
    setError(""); setOk("");
    const delta = parseFloat(aDelta);
    const p = appState.products.find((x) => x.id === aProduct);
    if (!p || !delta) { setError("Choose a product and a non-zero adjustment amount."); return; }
    if ((p.stock[aLoc] || 0) + delta < 0) { setError("This adjustment would make stock negative."); return; }
    update((prev) => {
      const products = prev.products.map((x) => (x.id !== p.id ? x : { ...x, stock: { ...x.stock, [aLoc]: (x.stock[aLoc] || 0) + delta } }));
      const mv = { id: genId("mv"), timestamp: Date.now(), type: "adjustment" as const, productId: p.id, productName: p.name, locationId: aLoc, qty: delta, reason: aReason, user: session.userName };
      return { ...prev, products, stockMovements: [...prev.stockMovements, mv] };
    });
    setOk(`Adjusted ${p.name} by ${delta > 0 ? "+" : ""}${fmtQty(delta)} ${p.unit}.`);
    setADelta("");
  };

  const visibleMovements = perms.multiLocation
    ? appState.stockMovements
    : appState.stockMovements.filter((m) => m.locationId === session.locationId || m.toLocationId === session.locationId);

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => { setTab(key); setError(""); setOk(""); }}
      className={`px-4 py-2 rounded-md text-sm font-medium ${tab === key ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex gap-2 mb-4">
        {perms.multiLocation && tabBtn("transfer", "Transfer stock")}
        {tabBtn("adjust", "Adjustment")}
        {tabBtn("log", "Movement log")}
      </div>

      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3 max-w-lg">{error}</div>}
      {ok && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-md px-3 py-2 mb-3 max-w-lg">{ok}</div>}

      {tab === "transfer" && perms.multiLocation && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-lg">
          <Field label="Product">
            <select className={inputCls} value={tProduct} onChange={(e) => setTProduct(e.target.value)}>
              <option value="">Select product...</option>
              {appState.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From location">
              <select className={inputCls} value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
                {appState.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="To location">
              <select className={inputCls} value={tTo} onChange={(e) => setTTo(e.target.value)}>
                {appState.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Quantity">
            <input type="number" step="any" className={inputCls} value={tQty} onChange={(e) => setTQty(e.target.value)} />
          </Field>
          <button onClick={doTransfer} className={`${btnPrimary} w-full mt-1`}>Transfer</button>
        </div>
      )}

      {tab === "adjust" && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-lg">
          <Field label="Product">
            <select className={inputCls} value={aProduct} onChange={(e) => setAProduct(e.target.value)}>
              <option value="">Select product...</option>
              {appState.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </Field>
          <Field label="Location">
            <input className={`${inputCls} bg-slate-50`} value={appState.locations.find((l) => l.id === aLoc)?.name ?? ""} disabled />
          </Field>
          <Field label="Adjustment (use negative for damage/loss, positive for opening stock/correction)">
            <input type="number" step="any" className={inputCls} value={aDelta} onChange={(e) => setADelta(e.target.value)} />
          </Field>
          <Field label="Reason">
            <select className={inputCls} value={aReason} onChange={(e) => setAReason(e.target.value)}>
              <option>Stock count correction</option>
              <option>Damage / breakage</option>
              <option>Opening stock</option>
              <option>Theft / shrinkage</option>
              <option>Expired / spoiled</option>
              <option>Other</option>
            </select>
          </Field>
          <button onClick={doAdjust} className={`${btnPrimary} w-full mt-1`}>Apply adjustment</button>
        </div>
      )}

      {tab === "log" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Qty</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {[...visibleMovements].reverse().slice(0, 200).map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-500">{new Date(m.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2.5"><Badge tone={m.qty < 0 ? "rose" : m.qty > 0 ? "emerald" : "slate"}>{m.type}</Badge></td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{m.productName}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {appState.locations.find((l) => l.id === m.locationId)?.name}
                    {m.toLocationId ? ` -> ${appState.locations.find((l) => l.id === m.toLocationId)?.name}` : ""}
                  </td>
                  <td className="px-4 py-2.5">{m.qty > 0 ? "+" : ""}{fmtQty(m.qty)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.reason}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.user}</td>
                </tr>
              ))}
              {visibleMovements.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No stock movements yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}