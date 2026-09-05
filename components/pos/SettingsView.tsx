"use client";

import { useState } from "react";
import { Badge, Field, btnSecondary, inputCls } from "./ui";
import { genId } from "@/lib/pos-constants";
import type { AppState, UpdateFn } from "@/types/pos";

export function SettingsView({ appState, update }: { appState: AppState; update: UpdateFn }) {
  const [newLoc, setNewLoc] = useState("");

  const addLocation = () => {
    if (!newLoc.trim()) return;
    update((prev) => ({ ...prev, locations: [...prev.locations, { id: genId("loc"), name: newLoc.trim() }] }));
    setNewLoc("");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-xl">
        <h2 className="font-semibold text-slate-800 mb-1">Locations</h2>
        <p className="text-sm text-slate-500 mb-3">Branches or stores that share this product catalogue but track stock separately.</p>
        {appState.locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
            <span className="text-slate-700">{l.name}</span>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <input className={inputCls} placeholder="New location name" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
          <button onClick={addLocation} className={btnSecondary}>Add</button>
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
