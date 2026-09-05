"use client";

import { useState } from "react";
import { Lock, Pencil, Plus, Search } from "lucide-react";
import { Badge, Field, Modal, btnPrimary, btnSecondary, inputCls } from "./ui";
import { UNITS, fmt, fmtQty, genId } from "@/lib/pos-constants";
import type { AppState, Location, Product, RolePermissions, Session, UpdateFn } from "@/types/pos";

type ProductForm = Omit<Product, "id">;

function ProductModal({
  product, locations, perms, onSave, onClose,
}: {
  product: Product | null;
  locations: Location[];
  perms: RolePermissions;
  onSave: (form: ProductForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(
    product ?? {
      code: "", name: "", unit: "piece", sellPrice: 0, costPrice: 0, lowStockThreshold: 5,
      category: "General", stock: Object.fromEntries(locations.map((l) => [l.id, 0])),
    }
  );
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setStock = (locId: string, v: number) => setForm((f) => ({ ...f, stock: { ...f.stock, [locId]: v } }));

  return (
    <Modal title={product ? "Edit product" : "Add product"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Product code">
          <input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} disabled={!!product} />
        </Field>
        <Field label="Name">
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!perms.canEditInventory} />
        </Field>
        <Field label="Selling unit">
          <select className={inputCls} value={form.unit} onChange={(e) => set("unit", e.target.value as Product["unit"])} disabled={!perms.canEditInventory}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} disabled={!perms.canEditInventory} />
        </Field>
        <Field label="Selling price (per unit)">
          <input type="number" step="any" className={inputCls} value={form.sellPrice}
            onChange={(e) => set("sellPrice", parseFloat(e.target.value) || 0)} disabled={!perms.canEditInventory} />
        </Field>
        <Field label="Cost price (per unit)">
          <input type="number" step="any" className={inputCls} value={form.costPrice}
            onChange={(e) => set("costPrice", parseFloat(e.target.value) || 0)} disabled={!perms.canEditCost} />
        </Field>
        <Field label="Low stock alert threshold">
          <input type="number" step="any" className={inputCls} value={form.lowStockThreshold}
            onChange={(e) => set("lowStockThreshold", parseFloat(e.target.value) || 0)} disabled={!perms.canEditInventory} />
        </Field>
      </div>
      <div className="mt-2 mb-4">
        <span className="block text-sm text-slate-600 mb-2">Opening stock by location</span>
        <div className="grid grid-cols-2 gap-3">
          {locations.map((l) => (
            <Field key={l.id} label={l.name}>
              <input type="number" step="any" className={inputCls} value={form.stock[l.id] || 0}
                onChange={(e) => setStock(l.id, parseFloat(e.target.value) || 0)} disabled={!!product} />
            </Field>
          ))}
        </div>
        {product && <p className="text-xs text-slate-400">Use Purchases or Stock ops to change quantities after creation.</p>}
      </div>
      {!perms.canEditInventory && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <Lock size={12} /> Your role can view but not edit product details.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        {perms.canEditInventory && (
          <button className={btnPrimary} onClick={() => { if (!form.code || !form.name) return; onSave(form); }}>
            {product ? "Save changes" : "Add product"}
          </button>
        )}
      </div>
    </Modal>
  );
}

export function InventoryView({
  appState, update, perms, session,
}: {
  appState: AppState;
  update: UpdateFn;
  perms: RolePermissions;
  session: Session;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const visibleLocations = perms.multiLocation
    ? appState.locations
    : appState.locations.filter((l) => l.id === session.locationId);

  const filtered = appState.products.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.code.toLowerCase().includes(query.toLowerCase())
  );

  const totalStockValue = filtered.reduce(
    (s, p) => s + visibleLocations.reduce((a, l) => a + (p.stock[l.id] || 0), 0) * p.costPrice, 0
  );

  const saveProduct = (form: ProductForm) => {
    update((prev) => {
      if (editing === "new") {
        if (prev.products.some((p) => p.code.toLowerCase() === form.code.toLowerCase())) return prev;
        return { ...prev, products: [...prev.products, { ...form, id: genId("prod") }] };
      }
      if (!editing) return prev;
      return { ...prev, products: prev.products.map((p) => (p.id === editing.id ? { ...p, ...form, stock: p.stock } : p)) };
    });
    setEditing(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-9`} placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            Stock value (visible): <span className="font-semibold text-slate-800">{fmt(totalStockValue)}</span>
          </span>
          {perms.canEditInventory && (
            <button onClick={() => setEditing("new")} className={`${btnPrimary} flex items-center gap-1.5`}>
              <Plus size={15} /> Add product
            </button>
          )}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 font-medium">Price</th>
              {perms.canEditCost && <th className="px-4 py-2.5 font-medium">Cost</th>}
              {visibleLocations.map((l) => (
                <th key={l.id} className="px-4 py-2.5 font-medium">{l.name}</th>
              ))}
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-500">{p.code}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.unit}</td>
                <td className="px-4 py-2.5">{fmt(p.sellPrice)}</td>
                {perms.canEditCost && <td className="px-4 py-2.5 text-slate-500">{fmt(p.costPrice)}</td>}
                {visibleLocations.map((l) => {
                  const qty = p.stock[l.id] || 0;
                  const low = qty <= p.lowStockThreshold;
                  return (
                    <td key={l.id} className="px-4 py-2.5">
                      <Badge tone={low ? (qty <= 0 ? "rose" : "amber") : "slate"}>{fmtQty(qty)}</Badge>
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(p)} className="text-slate-400 hover:text-emerald-600">
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No products match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          locations={visibleLocations}
          perms={perms}
          onSave={saveProduct}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
