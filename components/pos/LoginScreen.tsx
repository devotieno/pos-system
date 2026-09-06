"use client";

import { useState } from "react";
import { AlertTriangle, Store } from "lucide-react";
import { signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Field, btnPrimary, inputCls } from "./ui";

function friendlyAuthError(err: unknown): string {
  const code = (err as AuthError)?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your admin.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return "Couldn't sign in. Check your connection and try again.";
  }
}

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      // On success, onAuthStateChanged (via useAuth) picks this up and PosApp moves on.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
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
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full mt-2`}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
            No account yet? Ask your business owner or manager to add you from the Users screen.
          </div>
        </form>
      </div>
    </div>
  );
}
