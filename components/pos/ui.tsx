"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const inputCls =
  "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
export const btnPrimary =
  "bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed";
export const btnSecondary =
  "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-md transition";
export const btnDanger =
  "bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-md transition disabled:opacity-40";

type Tone = "slate" | "emerald" | "amber" | "rose";

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({
  title, onClose, children, wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function StatCard({
  label, value, icon: Icon, tone = "emerald",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "emerald" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    slate: "text-slate-600 bg-slate-100",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-md ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}
