"use client";

import { useState } from "react";
import { AlertTriangle, Store } from "lucide-react";
import { Field, btnPrimary, inputCls } from "./ui";
import type { UserAccount } from "@/types/pos";

export function LoginScreen({
  users, onLogin,
}: {
  users: UserAccount[];
  onLogin: (user: UserAccount) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.active !== false
    );
    if (!user || user.password !== password) {
      setError("Incorrect username or password.");
      return;
    }
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="bg-emerald-600 text-white p-2 rounded-lg">
            <Store size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-800">DukaBook POS</span>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-800 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-5">Use your staff account to open the till.</p>
          {error && (
            <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-4 flex items-center gap-2">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <Field label="Username">
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </Field>
          <Field label="Password">
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button type="submit" className={`${btnPrimary} w-full mt-2`}>Sign in</button>
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
            Demo accounts: owner/owner123, manager/manager123, storekeeper/store123, cashier/cashier123.
            Change these before real use.
          </div>
        </form>
      </div>
    </div>
  );
}
