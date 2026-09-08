"use client";

import { useState } from "react";
import { AlertTriangle, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Field, Modal, btnDanger, btnPrimary, btnSecondary, inputCls } from "./ui";
import { UNITS, fmt, fmtQty, genId } from "@/lib/pos-constants";
import type { AppState, Location, Product, RolePermissions, Session, UpdateFn } from "@/types/pos";

type ProductForm = Omit<Product, "id">;

function ProductModal({
  product, locations, existingProducts, perms, onSave, onMerge, onClose,
}: {
  product: Product | null;
  locations: Location[];
  /** Every OTHER product, used to detect a code collision and offer to merge into it. */
  existingProducts: Product[];
  perms: RolePermissions;
  onSave: (form: ProductForm) => void;
  onMerge: (target: Product, draftForm: ProductForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(
    product ?? {
      code: "", name: "", unit: "piece", sellPrice: 0, costPrice: 0, lowStockThreshold: 5,
      category: "General", stock: Object.fromEntries(locations.map((l) => [l.id, 0])),
    }
  );
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Product | null>(null);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setStock = (locId: string, v: number) => setForm((f) => ({ ...f, stock: { ...f.stock, [locId]: v } }));

  const submit = () => {
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code || !name) {
      setError("Enter a product code and name.");
      return;
    }
    const match = existingProducts.find((p) => p.code.toLowerCase() === code.toLowerCase());
    if (match) {
      setError("");
      setConflict(match);
      return;
    }
    onSave({ ...form, code, name });
  };

  return (
    <Modal title={product ? "Edit product" : "Add product"} onClose={onClose} wide>
      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={12} className="shrink-0" /> {error}
        </p>
      )}
      {conflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-3 mb-3 text-sm">
          <p className="text-amber-800 mb-2">
            <span className="font-medium">{conflict.code}</span> already belongs to a product carried elsewhere:
          </p>
          <div className="bg-white rounded-md p-2 mb-2 text-slate-700">
            <div className="font-medium">{conflict.name}</div>
            <div className="text-xs text-slate-500">{fmt(conflict.sellPrice)} / {conflict.unit} &middot; cost {fmt(conflict.costPrice)}</div>
          </div>
          <p className="text-xs text-amber-700 mb-2">
            If this is the same item, you can start carrying it at your store using its existing details -
            instead of creating a second record with a duplicate code.
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" className={btnSecondary} onClick={() => setConflict(null)}>Use a different code</button>
            <button type="button" className={btnPrimary} onClick={() => onMerge(conflict, form)}>Carry this product at my store</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Product code">
          <input
            className={inputCls}
            value={form.code}
            onChange={(e) => { set("code", e.target.value); setError(""); setConflict(null); }}
            disabled={!perms.canEditInventory}
          />
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
          <button className={btnPrimary} onClick={submit}>
            {product ? "Save changes" : "Add product"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function DeleteProductModal({
  product, perms, session, locationName, onConfirm, onClose,
}: {
  product: Product;
  perms: RolePermissions;
  session: Session;
  locationName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const myStock = product.stock[session.locationId] || 0;
  const canDelete = myStock <= 0;

  if (perms.multiLocation) {
    // Owner: this is a real, permanent catalog deletion, so it must be zero everywhere first.
    const totalStock = Object.values(product.stock).reduce((a, b) => a + b, 0);
    const ownerCanDelete = totalStock <= 0;
    return (
      <Modal title="Delete product" onClose={onClose}>
        <p className="text-sm text-slate-600 mb-3">
          Delete <span className="font-medium">{product.name}</span> ({product.code})? This can&apos;t be undone.
        </p>
        {!ownerCanDelete ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            This product still has {fmtQty(totalStock)} {product.unit} in stock across locations. Zero it out via
            Stock ops first.
          </p>
        ) : (
          <p className="text-xs text-slate-400 mb-4">
            Past sales and purchases already recorded won&apos;t be affected - they keep their own copy of this
            product&apos;s details.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnDanger} onClick={onConfirm} disabled={!ownerCanDelete}>Delete</button>
        </div>
      </Modal>
    );
  }

  // Manager/etc: this only removes the product from THEIR store. It keeps existing for every
  // other location until the last one's stock hits zero too.
  const remainingElsewhere = Object.entries(product.stock)
    .filter(([locId]) => locId !== session.locationId)
    .reduce((s, [, qty]) => s + qty, 0);
  const isLastLocation = remainingElsewhere <= 0;

  return (
    <Modal title="Remove product from your store" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-3">
        Remove <span className="font-medium">{product.name}</span> ({product.code}) from {locationName}?
      </p>
      {!canDelete ? (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={13} className="shrink-0" />
          This product still has {fmtQty(myStock)} {product.unit} in stock at {locationName}. Zero it out via
          Stock ops first.
        </p>
      ) : isLastLocation ? (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={13} className="shrink-0" />
          No other location carries this product anymore - it will be removed from the catalog entirely.
        </p>
      ) : (
        <p className="text-xs text-slate-400 mb-4">
          It stays available for other locations - this only affects {locationName}. Past sales and purchases
          already recorded won&apos;t be affected either way.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnDanger} onClick={onConfirm} disabled={!canDelete}>Remove</button>
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
  const [deleting, setDeleting] = useState<Product | null>(null);

  const visibleLocations = perms.multiLocation
    ? appState.locations
    : appState.locations.filter((l) => l.id === session.locationId);

  // A manager only sees products their own store actually carries a stock record for.
  // The owner sees the whole shared catalog regardless of which stores stock what.
  const carriesAtMyStore = (p: Product) =>
    perms.multiLocation || Object.prototype.hasOwnProperty.call(p.stock, session.locationId);

  const filtered = appState.products.filter(
    (p) =>
      (p.name.toLowerCase().includes(query.toLowerCase()) || p.code.toLowerCase().includes(query.toLowerCase())) &&
      carriesAtMyStore(p)
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

  // Instead of creating (or renaming into) a product that duplicates an existing code, fold
  // this store's stock into the existing record and drop the local duplicate, if any.
  const mergeProduct = (target: Product, draftForm: ProductForm) => {
    update((prev) => {
      const isNew = editing === "new";
      const localProduct = isNew ? null : prev.products.find((p) => p.id === (editing as Product).id) ?? null;
      const qtyToTransfer = isNew ? (draftForm.stock[session.locationId] || 0) : (localProduct?.stock[session.locationId] || 0);

      let products = prev.products.map((p) =>
        p.id === target.id
          ? { ...p, stock: { ...p.stock, [session.locationId]: (p.stock[session.locationId] || 0) + qtyToTransfer } }
          : p
      );
      if (localProduct) {
        products = products.filter((p) => p.id !== localProduct.id);
      }

      const movement = {
        id: genId("mv"), timestamp: Date.now(), type: "adjustment" as const, productId: target.id,
        productName: target.name, locationId: session.locationId, qty: qtyToTransfer,
        reason: localProduct
          ? `Merged duplicate "${localProduct.code}" into this product`
          : "Started carrying an existing catalog product",
        user: session.userName,
      };

      return { ...prev, products, stockMovements: [...prev.stockMovements, movement] };
    });
    setEditing(null);
  };

  const deleteProduct = () => {
    if (!deleting) return;
    const targetId = deleting.id;

    update((prev) => {
      if (perms.multiLocation) {
        // Owner: a real, permanent catalog deletion (the modal already required zero stock everywhere).
        return { ...prev, products: prev.products.filter((p) => p.id !== targetId) };
      }

      // Manager/etc: only remove this store's stock record for the product. If that was the
      // last location carrying any stock of it at all, it disappears from the catalog entirely.
      const target = prev.products.find((p) => p.id === targetId);
      if (!target) return prev;

      const { [session.locationId]: _removed, ...remainingStock } = target.stock;
      const remainingTotal = Object.values(remainingStock).reduce((a, b) => a + b, 0);
      const fullyRemoved = remainingTotal <= 0;

      const products = fullyRemoved
        ? prev.products.filter((p) => p.id !== targetId)
        : prev.products.map((p) => (p.id === targetId ? { ...p, stock: remainingStock } : p));

      const movement = {
        id: genId("mv"), timestamp: Date.now(), type: "adjustment" as const, productId: targetId,
        productName: target.name, locationId: session.locationId, qty: 0,
        reason: fullyRemoved
          ? "Removed from catalog - last location carrying it"
          : "Removed from catalog at this location",
        user: session.userName,
      };

      return { ...prev, products, stockMovements: [...prev.stockMovements, movement] };
    });

    setDeleting(null);
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
        <div className="overflow-x-auto">
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
                <td className="px-4 py-2.5 text-right space-x-2">
                  <button onClick={() => setEditing(p)} className="text-slate-400 hover:text-emerald-600">
                    <Pencil size={15} />
                  </button>
                  {perms.canEditInventory && (
                    <button onClick={() => setDeleting(p)} className="text-slate-400 hover:text-rose-500">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No products match your search.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          locations={visibleLocations}
          existingProducts={appState.products.filter((p) => editing === "new" || p.id !== editing.id)}
          perms={perms}
          onSave={saveProduct}
          onMerge={mergeProduct}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteProductModal
          product={deleting}
          perms={perms}
          session={session}
          locationName={appState.locations.find((l) => l.id === session.locationId)?.name ?? "your store"}
          onConfirm={deleteProduct}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}