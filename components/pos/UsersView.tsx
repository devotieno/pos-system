"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge, Field, Modal, btnPrimary, btnSecondary, inputCls } from "./ui";
import { ROLES, genId } from "@/lib/pos-constants";
import { MANAGER_ASSIGNABLE_ROLES } from "@/types/pos";
import type { AppState, Location, Role, RolePermissions, Session, UpdateFn, UserAccount } from "@/types/pos";

type UserForm = Omit<UserAccount, "id">;

function UserModal({
  user, locations, assignableRoles, lockedLocationId, onSave, onClose,
}: {
  user: UserAccount | null;
  locations: Location[];
  assignableRoles: Role[];
  /** If set, the location field is fixed to this id (the manager's own store) and not editable. */
  lockedLocationId?: string;
  onSave: (form: UserForm | UserAccount) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UserForm>(
    user ?? {
      name: "", username: "", password: "",
      role: assignableRoles[0] ?? "cashier",
      locationId: lockedLocationId ?? locations[0]?.id ?? "",
      active: true,
    }
  );
  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={user ? "Edit user" : "Add user"} onClose={onClose}>
      <Field label="Full name"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Username"><input className={inputCls} value={form.username} onChange={(e) => set("username", e.target.value)} disabled={!!user} /></Field>
      <Field label={user ? "Reset password (leave blank to keep current)" : "Password"}>
        <input type="text" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={user ? "" : "Choose a password"} />
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
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button
          className={btnPrimary}
          onClick={() => {
            if (!form.name || !form.username) return;
            const toSave = { ...form, locationId: lockedLocationId ?? form.locationId };
            if (user && !form.password) delete (toSave as Partial<UserForm>).password;
            onSave(user ? { ...user, ...toSave } : toSave);
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

export function UsersView({
  appState, update, session, perms,
}: {
  appState: AppState;
  update: UpdateFn;
  session: Session;
  perms: RolePermissions;
}) {
  const [editing, setEditing] = useState<UserAccount | "new" | null>(null);

  const assignableRoles: Role[] = perms.canManageAllUsers
    ? (Object.keys(ROLES) as Role[])
    : MANAGER_ASSIGNABLE_ROLES;

  // Managers only see/manage the cashiers and storekeepers at their own store - not the
  // owner account, other managers, or staff at other branches.
  const visibleUsers = perms.canManageAllUsers
    ? appState.users
    : appState.users.filter((u) => u.locationId === session.locationId && MANAGER_ASSIGNABLE_ROLES.includes(u.role));

  const save = (form: UserForm | UserAccount) => {
    update((prev) => {
      // Defense in depth: even if the form somehow carried a disallowed role/location, clamp it
      // back to what this user is permitted to assign before writing it to state.
      const safeForm: UserForm | UserAccount = perms.canManageAllUsers
        ? form
        : {
            ...form,
            role: assignableRoles.includes(form.role) ? form.role : assignableRoles[0],
            locationId: session.locationId,
          };
      if (editing === "new") return { ...prev, users: [...prev.users, { ...(safeForm as UserForm), id: genId("usr") }] };
      return { ...prev, users: prev.users.map((u) => (u.id === (safeForm as UserAccount).id ? { ...u, ...safeForm } : u)) };
    });
    setEditing(null);
  };

  const toggleActive = (u: UserAccount) =>
    update((prev) => ({ ...prev, users: prev.users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)) }));

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
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Username</th>
              <th className="px-4 py-2.5 font-medium">Role</th><th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.username}</td>
                <td className="px-4 py-2.5"><Badge>{ROLES[u.role].label}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{appState.locations.find((l) => l.id === u.locationId)?.name ?? "-"}</td>
                <td className="px-4 py-2.5"><Badge tone={u.active !== false ? "emerald" : "rose"}>{u.active !== false ? "Active" : "Disabled"}</Badge></td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  <button onClick={() => setEditing(u)} className="text-slate-400 hover:text-emerald-600"><Pencil size={15} /></button>
                  {u.id !== session.userId && (
                    <button onClick={() => toggleActive(u)} className="text-xs text-slate-500 hover:text-rose-600">
                      {u.active !== false ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visibleUsers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No staff accounts here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          locations={appState.locations}
          assignableRoles={assignableRoles}
          lockedLocationId={perms.canManageAllUsers ? undefined : session.locationId}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
