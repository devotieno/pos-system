"use client";

import { useState } from "react";
import { AlertTriangle, Check, Pencil, Trash2, X } from "lucide-react";
import { Badge, Field, btnPrimary, btnSecondary, inputCls } from "./ui";
import { genId } from "@/lib/pos-constants";
import { useStaffDirectory } from "@/hooks/useStaffDirectory";
import type { AppState, Location, UpdateFn } from "@/types/pos";

function LocationRow({
  location, staffCount, stockQty, canDelete, onRename, onDelete,
}: {
  location: Location;
  staffCount: number;
  stockQty: number;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(location.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");

  const save = () => {
    if (!name.trim()) return;
    onRename(name.trim());
    setEditing(false);
  };

  const attemptDelete = () => {
    if (!canDelete) {
      setBlockedReason("This is the only location - add another one before deleting this.");
      return;
    }
    if (staffCount > 0) {
      setBlockedReason(`${staffCount} staff member${staffCount === 1 ? " is" : "s are"} still assigned here. Reassign them first.`);
      return;
    }
    if (stockQty > 0) {
      setBlockedReason("This location still has stock. Transfer it out first (Stock ops - owner only, since transfers cross locations).");
      return;
    }
    setBlockedReason("");
    setConfirmingDelete(true);
  };

  return (
    <div className="py-2 border-b border-slate-100 last:border-0 text-sm">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className={`${inputCls} py-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(location.name); } }}
            />
            <button onClick={save} className="text-emerald-600 hover:text-emerald-700"><Check size={16} /></button>
            <button onClick={() => { setEditing(false); setName(location.name); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
        ) : (
          <>
            <span className="text-slate-700">{location.name}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-emerald-600"><Pencil size={14} /></button>
              <button onClick={attemptDelete} className="text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
          </>
        )}
      </div>
      {blockedReason && (
        <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
          <AlertTriangle size={12} className="shrink-0" /> {blockedReason}
        </p>
      )}
      {confirmingDelete && (
        <div className="mt-1.5 text-xs bg-rose-50 text-rose-700 rounded-md px-2.5 py-2">
          <p className="mb-1.5">Delete &quot;{location.name}&quot;? This can&apos;t be undone. Past sales/purchases recorded here will just show a blank location.</p>
          <div className="flex gap-2">
            <button onClick={() => { onDelete(); setConfirmingDelete(false); }} className="font-medium underline">Yes, delete it</button>
            <button onClick={() => setConfirmingDelete(false)} className="text-rose-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ appState, update }: { appState: AppState; update: UpdateFn }) {
  const [newLoc, setNewLoc] = useState("");
  const { staff } = useStaffDirectory(true);

  const addLocation = () => {
    if (!newLoc.trim()) return;
    update((prev) => ({ ...prev, locations: [...prev.locations, { id: genId("loc"), name: newLoc.trim() }] }));
    setNewLoc("");
  };

  const renameLocation = (id: string, name: string) => {
    update((prev) => ({ ...prev, locations: prev.locations.map((l) => (l.id === id ? { ...l, name } : l)) }));
  };

  const deleteLocation = (id: string) => {
    update((prev) => ({ ...prev, locations: prev.locations.filter((l) => l.id !== id) }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-xl">
        <h2 className="font-semibold text-slate-800 mb-1">Locations</h2>
        <p className="text-sm text-slate-500 mb-3">Branches or stores that share this product catalogue but track stock separately.</p>
        {appState.locations.map((l) => (
          <LocationRow
            key={l.id}
            location={l}
            staffCount={staff.filter((u) => u.locationId === l.id).length}
            stockQty={appState.products.reduce((sum, p) => sum + (p.stock[l.id] || 0), 0)}
            canDelete={appState.locations.length > 1}
            onRename={(name) => renameLocation(l.id, name)}
            onDelete={() => deleteLocation(l.id)}
          />
        ))}
        <div className="flex gap-2 mt-3">
          <input className={inputCls} placeholder="New location name" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
          <button onClick={addLocation} className={btnPrimary}>Add</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-slate-800">KRA eTIMS integration</h2>
          <Badge tone="amber">Not connected</Badge>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Connect this till to KRA&apos;s Electronic Tax Invoice Management System to auto-generate tax-compliant
          invoices with a QR code and transmit sales to KRA in real time. This needs credentials issued by KRA
          (a registered OSCU/VSCU device or approved API access) - once you have them, they&apos;re entered here.
        </p>
        <Field label="KRA PIN">
          <input
            className={inputCls}
            placeholder="P0XXXXXXXXA"
            value={appState.etims.kraPin}
            onChange={(e) => update((prev) => ({ ...prev, etims: { ...prev.etims, kraPin: e.target.value } }))}
          />
        </Field>
        <Field label="Device / branch ID (from KRA)">
          <input
            className={inputCls}
            placeholder="Provided by KRA on registration"
            value={appState.etims.deviceId}
            onChange={(e) => update((prev) => ({ ...prev, etims: { ...prev.etims, deviceId: e.target.value } }))}
          />
        </Field>
        <button className={`${btnSecondary} opacity-60 cursor-not-allowed`} disabled>
          Connect (requires KRA credentials)
        </button>
        <p className="text-xs text-slate-400 mt-3">
          Until this is connected, receipts print with a placeholder notice instead of a KRA QR code, and sales
          are not transmitted to KRA. Nothing else in the system is affected.
        </p>
      </div>
    </div>
  );
}