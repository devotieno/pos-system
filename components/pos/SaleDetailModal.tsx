"use client";

import { Modal, Badge } from "./ui";
import { fmt, fmtQty } from "@/lib/pos-constants";
import type { Sale } from "@/types/pos";

export function SaleDetailModal({
  sale, locationName, onClose,
}: {
  sale: Sale;
  locationName: string;
  onClose: () => void;
}) {
  return (
    <Modal title={`Invoice #${sale.number}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-4">
        <span>{new Date(sale.timestamp).toLocaleString()}</span>
        <span>&middot;</span>
        <span>{sale.cashierName}</span>
        <span>&middot;</span>
        <span>{locationName}</span>
        <span>&middot;</span>
        {sale.status === "returned" && <Badge tone="rose">Returned</Badge>}
        {sale.status === "partially_returned" && <Badge tone="amber">Partial return</Badge>}
        {sale.status === "completed" && <Badge tone="emerald">Completed</Badge>}
      </div>

      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-1.5 font-medium">Item</th>
            <th className="font-medium">Code</th>
            <th className="font-medium">Qty</th>
            <th className="font-medium">Price</th>
            <th className="font-medium text-right">Line total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.productId} className="border-b border-slate-100">
              <td className="py-1.5">{it.name}</td>
              <td className="text-slate-500">{it.code ?? "-"}</td>
              <td>
                {fmtQty(it.qty)} {it.unit}
                {(it.returnedQty || 0) > 0 && (
                  <span className="text-xs text-amber-600 block">{fmtQty(it.returnedQty || 0)} returned</span>
                )}
              </td>
              <td>{fmt(it.price)}</td>
              <td className="text-right">{fmt(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-4">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span><span>{fmt(sale.subtotal)}</span>
          </div>
          {sale.discount && (
            <div className="flex justify-between text-sm text-rose-600">
              <span>Discount{sale.discount.type === "percent" ? ` (${sale.discount.value}%)` : ""}</span>
              <span>-{fmt(sale.discount.amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-100">
            <span>Total</span><span>{fmt(sale.total)}</span>
          </div>
          {(sale.refundedTotal || 0) > 0 && (
            <div className="flex justify-between text-sm text-amber-600">
              <span>Refunded</span><span>-{fmt(sale.refundedTotal || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {sale.discount?.reason && (
        <p className="text-xs text-slate-400 mb-4">Discount reason: {sale.discount.reason}</p>
      )}

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-xs font-medium text-slate-500 mb-2">Payment</h3>
        <div className="space-y-1">
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-600">{p.method}</span>
              <span className="font-medium">{fmt(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}