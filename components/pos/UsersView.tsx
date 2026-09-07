"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Badge, Field, Modal, btnPrimary, btnSecondary, inputCls } from "./ui";
import { ROLES } from "@/lib/pos-constants";
import { MANAGER_ASSIGNABLE_ROLES } from "@/types/pos";
import { useStaffDirectory } from "@/hooks/useStaffDirectory";
import { getFirebaseAuth } from "@/lib/firebase";
import type { AppState, Location, Role, RolePermissions, Session, StaffRecord } from "@/types/pos";

async function callStaffApi(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<void> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("You're not signed in.");
  const res = await fetch("/api/staff", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong.");
  }
}

interface StaffFormValues {
  name: string;
  email: string;
  password: string;
  role: Role;
  locationId: string;
}

function StaffModal({
  staff, locations, assignableRoles, lockedLocationId, onSaved, onClose,
}: {
  staff: StaffRecord | null;
  locations: Location[];
  assignableRoles: Role[];
  /** If set, the location field is fixed to this id (the manager's own store) and not editable. */
  lockedLocationId?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<StaffFormValues>(
    staff
      ? { name: staff.name, email: staff.email, password: "", role: staff.role, locationId: staff.locationId }
      : { name: "", email: "", password: "", role: assignableRoles[0] ?? "cashier", locationId: lockedLocationId ?? locations[0]?.id ?? "" }
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StaffFormValues>(k: K, v: StaffFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Enter a name and email address."); return; }
    if (!staff && form.password.trim().length < 6) { setError("Choose a password with at least 6 characters."); return; }
    setSaving(true);
    try {
      const locationId = lockedLocationId ?? form.locationId;
      if (staff) {
        await callStaffApi("PATCH", {
          uid: staff.uid,
          name: form.name.trim(),
          role: form.role,
          locationId,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
      } else {
        await callStaffApi("POST", {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          role: form.role,
          locationId,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={staff ? "Edit user" : "Add user"} onClose={onClose}>
      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <Field label="Full name">
        <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Email">
        <input
          type="email"
          className={inputCls}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={!!staff}
        />
      </Field>
      <Field label={staff ? "Reset password (leave blank to keep current)" : "Password"}>
        <input
          type="text"
          className={inputCls}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder={staff ? "" : "At least 6 characters"}
        />
      </Field>
      <Field label="Role">
        <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
          {assignableRoles.map((k) => (
            <option key={k} value={k}>{ROLES[k].label}</option>
          ))}
        </select>
      </Field>
      <Field label="Location / branch">
        {lockedLocationId ? (
          <input className={`${inputCls} bg-slate-50`} value={locations.find((l) => l.id === lockedLocationId)?.name ?? ""} disabled />
        ) : (
          <select className={inputCls} value={form.locationId} onChange={(e) => set("locationId", e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
        <button className={btnPrimary} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export function UsersView({
  appState, session, perms,
}: {
  appState: AppState;
  session: Session;
  perms: RolePermissions;
}) {
  const { staff, loading } = useStaffDirectory(true);
  const [editing, setEditing] = useState<StaffRecord | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  const assignableRoles: Role[] = perms.canManageAllUsers ? (Object.keys(ROLES) as Role[]) : MANAGER_ASSIGNABLE_ROLES;

  // Managers only see/manage the cashiers and storekeepers at their own store - not the
  // owner account, other managers, or staff at other branches.
  const visibleStaff = perms.canManageAllUsers
    ? staff
    : staff.filter((u) => u.locationId === session.locationId && MANAGER_ASSIGNABLE_ROLES.includes(u.role));

  const toggleActive = async (u: StaffRecord) => {
    setActionError("");
    try {
      await callStaffApi("PATCH", { uid: u.uid, active: !(u.active !== false) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't update that user.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-800">Staff accounts</h2>
          {!perms.canManageAllUsers && (
            <p className="text-xs text-slate-400 mt-0.5">
              You can add or edit cashiers and storekeepers at your own store. Owner and manager accounts are managed by the business owner.
            </p>
          )}
        </div>
        <button onClick={() => setEditing("new")} className={`${btnPrimary} flex items-center gap-1.5 shrink-0`}>
          <Plus size={15} /> Add user
        </button>
      </div>
      {actionError && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={13} /> {actionError}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th><th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((u) => (
              <tr key={u.uid} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                <td className="px-4 py-2.5"><Badge>{ROLES[u.role].label}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{appState.locations.find((l) => l.id === u.locationId)?.name ?? "-"}</td>
                <td className="px-4 py-2.5"><Badge tone={u.active !== false ? "emerald" : "rose"}>{u.active !== false ? "Active" : "Disabled"}</Badge></td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  <button onClick={() => setEditing(u)} className="text-slate-400 hover:text-emerald-600"><Pencil size={15} /></button>
                  {u.uid !== session.userId && (
                    <button onClick={() => toggleActive(u)} className="text-xs text-slate-500 hover:text-rose-600">
                      {u.active !== false ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && visibleStaff.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No staff accounts here yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading staff...</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      {editing && (
        <StaffModal
          staff={editing === "new" ? null : editing}
          locations={appState.locations}
          assignableRoles={assignableRoles}
          lockedLocationId={perms.canManageAllUsers ? undefined : session.locationId}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}