"use client";

import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Field, Modal, btnPrimary, btnSecondary, inputCls } from "./ui";
import { UNITS, fmt, fmtQty, genId } from "@/lib/pos-constants";
import type { AppState, Product, Purchase, PurchaseItem, RolePermissions, Session, UpdateFn } from "@/types/pos";

interface Line { productId: string; qty: number; cost: number; }

const NEW_PRODUCT_VALUE = "__new__";

function NewProductModal({
  appState, onCreate, onClose,
}: {
  appState: AppState;
  onCreate: (product: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    code: "", name: "", unit: "piece" as Product["unit"], category: "General",
    sellPrice: 0, costPrice: 0, lowStockThreshold: 5,
  });
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError("Enter a product code and name.");
      return;
    }
    if (appState.products.some((p) => p.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setError("A product with that code already exists.");
      return;
    }
    const product: Product = {
      id: genId("prod"),
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit,
      category: form.category.trim() || "General",
      sellPrice: form.sellPrice,
      costPrice: form.costPrice,
      lowStockThreshold: form.lowStockThreshold,
      stock: Object.fromEntries(appState.locations.map((l) => [l.id, 0])),
    };
    onCreate(product);
  };

  return (
    <Modal title="Add new product" onClose={onClose} wide>
      <p className="text-xs text-slate-500 mb-4">
        This item isn&apos;t in the catalogue yet. Add it here, then it&apos;ll be selected on this purchase line
        automatically - the quantity and unit cost you enter for the line will set its opening stock and cost price.
      </p>
      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3">{error}</div>}
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Product code"><input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
        <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Selling unit">
          <select className={inputCls} value={form.unit} onChange={(e) => set("unit", e.target.value as Product["unit"])}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Category"><input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="Selling price (per unit)">
          <input type="number" step="any" className={inputCls} value={form.sellPrice} onChange={(e) => set("sellPrice", parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label="Low stock alert threshold">
          <input type="number" step="any" className={inputCls} value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", parseFloat(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={create}>Add product</button>
      </div>
    </Modal>
  );
}

export function PurchasesView({
  appState, update, perms, session,
}: {
  appState: AppState;
  update: UpdateFn;
  perms: RolePermissions;
  session: Session;
}) {
  const [supplier, setSupplier] = useState("");
  const [locationId, setLocationId] = useState(session.locationId);
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 0, cost: 0 }]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newProductLine, setNewProductLine] = useState<number | null>(null);
  const [justCreatedIds, setJustCreatedIds] = useState<Set<string>>(new Set());

  const addLine = () => setLines((l) => [...l, { productId: "", qty: 0, cost: 0 }]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));

  const total = lines.reduce((s, l) => s + (l.qty || 0) * (l.cost || 0), 0);

  const handleProductSelect = (i: number, value: string) => {
    if (value === NEW_PRODUCT_VALUE) {
      setNewProductLine(i);
      return;
    }
    setLine(i, { productId: value });
  };

  const handleNewProductCreated = (product: Product) => {
    update((prev) => ({ ...prev, products: [...prev.products, product] }));
    setJustCreatedIds((prev) => new Set(prev).add(product.id));
    if (newProductLine !== null) setLine(newProductLine, { productId: product.id });
    setNewProductLine(null);
  };

  const submit = () => {
    setError("");
    const valid = lines.filter((l) => l.productId && l.qty > 0);
    if (!supplier.trim()) {
      setError("Enter a supplier name.");
      return;
    }
    if (valid.length === 0) {
      setError("Add at least one product line with a quantity.");
      return;
    }
    update((prev) => {
      const products = prev.products.map((p) => {
        const line = valid.find((l) => l.productId === p.id);
        if (!line) return p;
        // A product just created via "Add new product" always gets its cost set from this
        // purchase line (it has no prior cost to protect). Otherwise, respect canEditCost.
        const shouldSetCost = (perms.canEditCost || justCreatedIds.has(p.id)) && line.cost > 0;
        return {
          ...p,
          costPrice: shouldSetCost ? line.cost : p.costPrice,
          stock: { ...p.stock, [locationId]: (p.stock[locationId] || 0) + line.qty },
        };
      });
      const items: PurchaseItem[] = valid.map((l) => {
        const p = prev.products.find((x) => x.id === l.productId)!;
        return { productId: l.productId, name: p.name, unit: p.unit, qty: l.qty, cost: l.cost || p.costPrice };
      });
      const purchase: Purchase = {
        id: genId("pur"),
        number: prev.purchases.length + 1,
        timestamp: Date.now(),
        supplier: supplier.trim(),
        locationId,
        recordedBy: session.userName,
        items,
        total: items.reduce((s, it) => s + it.qty * it.cost, 0),
      };
      const movements = valid.map((l) => {
        const p = prev.products.find((x) => x.id === l.productId)!;
        return {
          id: genId("mv"), timestamp: Date.now(), type: "purchase" as const, productId: l.productId,
          productName: p.name, locationId, qty: l.qty, reason: `Purchase from ${supplier}`, user: session.userName,
        };
      });
      return { ...prev, products, purchases: [...prev.purchases, purchase], stockMovements: [...prev.stockMovements, ...movements] };
    });
    setSupplier("");
    setLines([{ productId: "", qty: 0, cost: 0 }]);
    setJustCreatedIds(new Set());
    setShowForm(false);
  };

  const visiblePurchases = perms.multiLocation
    ? appState.purchases
    : appState.purchases.filter((p) => p.locationId === session.locationId);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Purchase history</h2>
        <button onClick={() => setShowForm(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
          <Plus size={15} /> Record goods received
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Supplier</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Items</th>
              <th className="px-4 py-2.5 font-medium">Recorded by</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...visiblePurchases].reverse().map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-500">{p.number}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.supplier}</td>
                <td className="px-4 py-2.5">{appState.locations.find((l) => l.id === p.locationId)?.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.items.map((i) => `${fmtQty(i.qty)} ${i.unit} ${i.name}`).join(", ")}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.recordedBy}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmt(p.total)}</td>
              </tr>
            ))}
            {visiblePurchases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No purchases recorded yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showForm && (
        <Modal title="Record goods received" onClose={() => setShowForm(false)} wide>
          {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3">{error}</div>}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <Field label="Supplier">
              <input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </Field>
            <Field label="Receiving location">
              {perms.multiLocation ? (
                <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  {appState.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <input className={`${inputCls} bg-slate-50`} value={appState.locations.find((l) => l.id === locationId)?.name ?? ""} disabled />
              )}
            </Field>
          </div>
          <div className="space-y-2 mb-3">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className={`${inputCls} flex-1`} value={l.productId} onChange={(e) => handleProductSelect(i, e.target.value)}>
                  <option value="">Select product...</option>
                  <option value={NEW_PRODUCT_VALUE}>+ Add new product...</option>
                  {appState.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <input type="number" step="any" placeholder="Qty" className="w-24 border border-slate-300 rounded-md px-2 py-2 text-sm"
                  value={l.qty || ""} onChange={(e) => setLine(i, { qty: parseFloat(e.target.value) || 0 })} />
                <input type="number" step="any" placeholder="Unit cost" disabled={!perms.canEditCost}
                  className="w-28 border border-slate-300 rounded-md px-2 py-2 text-sm disabled:bg-slate-50"
                  value={l.cost || ""} onChange={(e) => setLine(i, { cost: parseFloat(e.target.value) || 0 })} />
                <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
            ))}
            <button onClick={addLine} className="text-sm text-emerald-700 flex items-center gap-1"><Plus size={13} /> Add line</button>
          </div>
          {!perms.canEditCost && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
              <Lock size={12} /> Your role can receive stock but cannot change cost prices on existing products - an
              admin or manager can update pricing. A brand new product you add here will still take its starting cost from this purchase.
            </p>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-500">Total value: <span className="font-semibold text-slate-800">{fmt(total)}</span></span>
            <div className="flex gap-2">
              <button className={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={btnPrimary} onClick={submit}>Save purchase</button>
            </div>
          </div>
        </Modal>
      )}

      {newProductLine !== null && (
        <NewProductModal
          appState={appState}
          onCreate={handleNewProductCreated}
          onClose={() => setNewProductLine(null)}
        />
      )}
    </div>
  );
}