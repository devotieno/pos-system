"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { Badge, Field, Modal, btnPrimary, btnSecondary, inputCls } from "./ui";
import { fmt, fmtQty, genId } from "@/lib/pos-constants";
import type {
  AppState, DiscountType, PaymentLine, Product, ReturnReason, RolePermissions, Sale, SaleItem, Session, UpdateFn,
} from "@/types/pos";

const PAYMENT_METHODS = ["Cash", "M-Pesa", "Card", "Bank transfer"];

function ReceiptPrintable({ sale, locationName }: { sale: Sale | null; locationName: string }) {
  if (!sale) return <div id="receipt-print-area" className="hidden print:block" />;
  return (
    <div id="receipt-print-area" className="hidden print:block font-mono text-xs p-4 w-[300px]">
      <div className="text-center mb-2">
        <div className="font-bold text-sm">E-POS (ALI'S)</div>
        <div>{locationName}</div>
        <div>Invoice #{sale.number}</div>
        <div>{new Date(sale.timestamp).toLocaleString()}</div>
      </div>
      <div className="border-t border-b border-dashed border-black py-1 my-1">
        {sale.items.map((it, i) => (
          <div key={i} className="mb-1">
            <div>{it.name}</div>
            <div className="flex justify-between">
              <span>{fmtQty(it.qty)} {it.unit} x {fmt(it.price)}</span>
              <span>{fmt(it.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
      {sale.discount && (
        <div className="flex justify-between">
          <span>Discount{sale.discount.type === "percent" ? ` (${sale.discount.value}%)` : ""}</span>
          <span>-{fmt(sale.discount.amount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>{fmt(sale.total)}</span></div>
      {sale.payments.map((p, i) => (
        <div key={i} className="flex justify-between"><span>{p.method}</span><span>{fmt(p.amount)}</span></div>
      ))}
      <div className="mt-2 text-center border border-black p-2">
        eTIMS: awaiting KRA connection.<br />No tax-compliant QR yet - see Settings.
      </div>
      <div className="text-center mt-2">Served by {sale.cashierName}</div>
      <div className="text-center mt-1">Thank you for your business</div>
    </div>
  );
}

export function POSView({
  appState, update, session, perms,
}: {
  appState: AppState;
  update: UpdateFn;
  session: Session;
  perms: RolePermissions;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showReturn, setShowReturn] = useState(false);

  // Discount (optional, applies to the whole sale)
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Payment - either one method for the full amount, or a split across several
  const [splitPayment, setSplitPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [splitLines, setSplitLines] = useState<PaymentLine[]>([
    { method: "Cash", amount: 0 },
    { method: "M-Pesa", amount: 0 },
  ]);

  const locId = session.locationId;
  const locationName = appState.locations.find((l) => l.id === locId)?.name ?? "";

  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const rawDiscount = discountEnabled ? (parseFloat(discountValue) || 0) : 0;
  const discountAmount = Math.min(
    Math.max(discountType === "percent" ? subtotal * (rawDiscount / 100) : rawDiscount, 0),
    subtotal
  );
  const totalDue = subtotal - discountAmount;

  const splitTotal = splitLines.reduce((s, l) => s + (l.amount || 0), 0);
  const splitRemaining = totalDue - splitTotal;

  const setSplitLine = (i: number, patch: Partial<PaymentLine>) =>
    setSplitLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addSplitLine = () => setSplitLines((lines) => [...lines, { method: "Cash", amount: 0 }]);
  const removeSplitLine = (i: number) => setSplitLines((lines) => lines.filter((_, idx) => idx !== i));

  const resetCheckoutExtras = () => {
    setDiscountEnabled(false);
    setDiscountType("amount");
    setDiscountValue("");
    setDiscountReason("");
    setSplitPayment(false);
    setPaymentMethod("Cash");
    setSplitLines([{ method: "Cash", amount: 0 }, { method: "M-Pesa", amount: 0 }]);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Product[];
    return appState.products
      .filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, appState.products]);

  const stockOf = (p: Product) => p.stock[locId] || 0;

  const addToCart = (p: Product) => {
    setError("");
    if (stockOf(p) <= 0) {
      setError(`${p.name} is out of stock at ${locationName}.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        return prev.map((c) => (c.productId === p.id ? { ...c, qty: c.qty + 1, lineTotal: (c.qty + 1) * c.price } : c));
      }
      return [...prev, { productId: p.id, code: p.code, name: p.name, unit: p.unit, qty: 1, price: p.sellPrice, lineTotal: p.sellPrice }];
    });
    setQuery("");
  };

  const setQty = (productId: string, qty: number) => {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, qty: Math.max(0, qty), lineTotal: Math.max(0, qty) * c.price } : c)));
  };
  const removeLine = (productId: string) => setCart((prev) => prev.filter((c) => c.productId !== productId));

  const checkout = () => {
    setError("");
    if (cart.length === 0) return;
    for (const c of cart) {
      const p = appState.products.find((x) => x.id === c.productId);
      if (!p || stockOf(p) < c.qty) {
        setError(`Not enough stock for ${c.name}. Available: ${fmtQty(p ? stockOf(p) : 0)} ${c.unit}.`);
        return;
      }
      if (c.qty <= 0) {
        setError(`Quantity for ${c.name} must be greater than zero.`);
        return;
      }
    }

    let payments: PaymentLine[];
    if (splitPayment) {
      payments = splitLines.filter((l) => l.amount > 0);
      if (payments.length === 0) {
        setError("Enter at least one payment amount.");
        return;
      }
      if (Math.abs(splitRemaining) > 0.01) {
        setError(
          splitRemaining > 0
            ? `Payments are short by ${fmt(splitRemaining)}. They must add up to ${fmt(totalDue)}.`
            : `Payments are ${fmt(-splitRemaining)} over. They must add up to ${fmt(totalDue)}.`
        );
        return;
      }
    } else {
      payments = [{ method: paymentMethod, amount: totalDue }];
    }

    let createdSale: Sale | null = null;
    update((prev) => {
      const invoiceNo = prev.nextInvoiceNo;
      const products = prev.products.map((p) => {
        const line = cart.find((c) => c.productId === p.id);
        if (!line) return p;
        return { ...p, stock: { ...p.stock, [locId]: (p.stock[locId] || 0) - line.qty } };
      });
      const sale: Sale = {
        id: genId("sale"),
        number: invoiceNo,
        timestamp: Date.now(),
        cashierId: session.userId,
        cashierName: session.userName,
        locationId: locId,
        items: cart.map((c) => ({ ...c, lineTotal: c.qty * c.price })),
        subtotal,
        discount: discountEnabled && discountAmount > 0
          ? { type: discountType, value: rawDiscount, amount: discountAmount, reason: discountReason.trim() || undefined }
          : null,
        total: totalDue,
        payments,
        status: "completed",
        refundedTotal: 0,
      };
      const movements = cart.map((c) => ({
        id: genId("mv"), timestamp: Date.now(), type: "sale" as const, productId: c.productId,
        productName: c.name, locationId: locId, qty: -c.qty, reason: `Sale #${invoiceNo}`, user: session.userName,
      }));
      createdSale = sale;
      return {
        ...prev,
        products,
        sales: [...prev.sales, sale],
        stockMovements: [...prev.stockMovements, ...movements],
        nextInvoiceNo: invoiceNo + 1,
      };
    });
    if (createdSale) setLastSale(createdSale);
    setCart([]);
    resetCheckoutExtras();
  };

  const printReceipt = () => window.print();

  return (
    <div className="flex-1 flex overflow-hidden">
      <ReceiptPrintable sale={lastSale} locationName={locationName} />
      <div className="flex-1 flex justify-center overflow-hidden print:hidden p-6">
        <div className="w-full max-w-5xl flex flex-col min-h-0">
          <div className="relative mb-4 shrink-0">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search by product code or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50 text-left border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.code} &middot; {fmt(p.sellPrice)} / {p.unit}</div>
                    </div>
                    <Badge tone={stockOf(p) <= p.lowStockThreshold ? "amber" : "slate"}>
                      {fmtQty(stockOf(p))} {p.unit}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 shrink-0">
              <h2 className="font-semibold text-slate-800">Current sale</h2>
              <p className="text-xs text-slate-400">{locationName}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
              {cart.length === 0 && (
                <p className="text-sm text-slate-400 mt-6 text-center">Cart is empty. Search for a product above to add it.</p>
              )}
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center gap-2 py-2 border-b border-slate-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400">{fmt(c.price)} / {c.unit}</div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={c.qty}
                    onChange={(e) => setQty(c.productId, parseFloat(e.target.value) || 0)}
                    className="w-16 border border-slate-300 rounded px-1.5 py-1 text-sm text-right"
                  />
                  <div className="w-20 text-right text-sm font-medium">{fmt(c.qty * c.price)}</div>
                  <button onClick={() => removeLine(c.productId)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-5 py-4 shrink-0">
              {error && (
                <div className="bg-rose-50 text-rose-700 text-xs rounded-md px-3 py-2 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {error}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  {!discountEnabled ? (
                    <button onClick={() => setDiscountEnabled(true)} className="text-xs text-emerald-700 hover:underline mb-3">
                      + Add discount
                    </button>
                  ) : (
                    <div className="mb-3 bg-slate-50 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600">Discount</span>
                        <button
                          onClick={() => { setDiscountEnabled(false); setDiscountValue(""); setDiscountReason(""); }}
                          className="text-xs text-slate-400 hover:text-rose-500"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <select
                          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                        >
                          <option value="amount">KES</option>
                          <option value="percent">%</option>
                        </select>
                        <input
                          type="number" step="any" min="0"
                          placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
                          className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Reason (optional) - e.g. loyal customer, bulk buy"
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Subtotal</span><span>{fmt(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-rose-600">
                        <span>Discount{discountType === "percent" ? ` (${discountValue}%)` : ""}</span>
                        <span>-{fmt(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500 text-sm">Total due</span>
                      <span className="text-2xl font-semibold text-slate-800">{fmt(totalDue)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-600">Payment</span>
                    <button onClick={() => setSplitPayment((s) => !s)} className="text-xs text-emerald-700 hover:underline">
                      {splitPayment ? "Use one method" : "Split payment"}
                    </button>
                  </div>

                  {!splitPayment ? (
                    <select className={`${inputCls} mb-2`} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {splitLines.map((l, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select
                            className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                            value={l.method}
                            onChange={(e) => setSplitLine(i, { method: e.target.value })}
                          >
                            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                          <input
                            type="number" step="any" min="0" placeholder="Amount"
                            className="w-24 border border-slate-300 rounded-md px-2 py-1.5 text-sm text-right"
                            value={l.amount || ""}
                            onChange={(e) => setSplitLine(i, { amount: parseFloat(e.target.value) || 0 })}
                          />
                          <button onClick={() => removeSplitLine(i)} className="text-slate-300 hover:text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button onClick={addSplitLine} className="text-xs text-emerald-700 flex items-center gap-1">
                        <Plus size={12} /> Add payment method
                      </button>
                      <div className={`text-xs ${Math.abs(splitRemaining) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
                        {Math.abs(splitRemaining) < 0.01
                          ? "Fully covered."
                          : splitRemaining > 0
                            ? `${fmt(splitRemaining)} remaining.`
                            : `${fmt(-splitRemaining)} over - reduce an amount.`}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={checkout}
                    disabled={cart.length === 0}
                    className={`${btnPrimary} w-full`}
                  >
                    Charge {fmt(totalDue)}
                  </button>
                  {lastSale && (
                    <button onClick={printReceipt} className={`${btnSecondary} w-full mt-2 flex items-center justify-center gap-1.5`}>
                      <Printer size={14} /> Print last receipt (#{lastSale.number})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {perms.canReturn && (
            <button onClick={() => setShowReturn(true)} className={`${btnSecondary} mt-4 self-start shrink-0 flex items-center gap-1.5`}>
              <RotateCcw size={14} /> Process a return / refund
            </button>
          )}
        </div>
      </div>

      {showReturn && (
        <ReturnModal appState={appState} update={update} session={session} onClose={() => setShowReturn(false)} />
      )}
    </div>
  );
}

function ReturnModal({
  appState, update, session, onClose,
}: {
  appState: AppState;
  update: UpdateFn;
  session: Session;
  onClose: () => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("Customer return");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Damaged/faulty goods still get refunded to the customer, but aren't put back into
  // sellable stock - a wrong-item-sold or plain customer return goes right back on the shelf.
  const restocks = reason !== "Damaged / faulty";

  const remainingOf = (it: SaleItem) => it.qty - (it.returnedQty || 0);

  const find = () => {
    const s = appState.sales.find((x) => String(x.number) === invoiceNo.trim());
    if (!s) {
      setError("No sale found with that invoice number.");
      setSale(null);
      return;
    }
    if (s.items.every((it) => remainingOf(it) <= 0)) {
      setError(`Sale #${s.number} has already been fully returned.`);
      setSale(null);
      return;
    }
    setError("");
    setSale(s);
    setQtys(Object.fromEntries(s.items.map((it) => [it.productId, 0])));
  };

  const confirmReturn = () => {
    if (!sale) return;
    const returningItems = sale.items.filter((it) => (qtys[it.productId] || 0) > 0);
    if (returningItems.length === 0) {
      setError("Enter a quantity to return for at least one item.");
      return;
    }
    for (const it of returningItems) {
      if (qtys[it.productId] > remainingOf(it)) {
        setError(`Cannot return more than the ${fmtQty(remainingOf(it))} ${it.unit} still returnable for ${it.name}.`);
        return;
      }
    }
    const refundAmount = returningItems.reduce((s, it) => s + qtys[it.productId] * it.price, 0);

    update((prev) => {
      const products = prev.products.map((p) => {
        const ret = returningItems.find((it) => it.productId === p.id);
        if (!ret || !restocks) return p; // damaged/faulty: item is written off, not resellable
        return { ...p, stock: { ...p.stock, [sale.locationId]: (p.stock[sale.locationId] || 0) + qtys[p.id] } };
      });

      const movements = returningItems.map((it) => ({
        id: genId("mv"), timestamp: Date.now(),
        type: restocks ? ("return" as const) : ("adjustment" as const),
        productId: it.productId, productName: it.name, locationId: sale.locationId,
        qty: restocks ? qtys[it.productId] : 0,
        reason: restocks
          ? `${reason} (Sale #${sale.number})`
          : `Damaged/faulty return - refunded but written off, not restocked (Sale #${sale.number})`,
        user: session.userName,
      }));

      const sales = prev.sales.map((s) => {
        if (s.id !== sale.id) return s;
        const items = s.items.map((it) => {
          const ret = returningItems.find((r) => r.productId === it.productId);
          return ret ? { ...it, returnedQty: (it.returnedQty || 0) + qtys[it.productId] } : it;
        });
        const refundedTotal = (s.refundedTotal || 0) + refundAmount;
        const fullyReturned = items.every((it) => remainingOf(it) <= 0);
        return { ...s, items, refundedTotal, status: fullyReturned ? ("returned" as const) : ("partially_returned" as const) };
      });

      return { ...prev, products, sales, stockMovements: [...prev.stockMovements, ...movements] };
    });
    setDone(true);
  };

  return (
    <Modal title="Process a return" onClose={onClose} wide>
      {done ? (
        <div className="text-center py-4">
          <Check className="mx-auto text-emerald-600 mb-2" size={32} />
          <p className="text-slate-700">Return processed and stock updated.</p>
          <button onClick={onClose} className={`${btnPrimary} mt-4`}>Close</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <input className={inputCls} placeholder="Invoice number, e.g. 1001" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            <button onClick={find} className={btnSecondary}>Find</button>
          </div>
          {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-md px-3 py-2 mb-3">{error}</div>}
          {sale && (
            <>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-1.5">Item</th><th>Sold</th><th>Already returned</th><th>Return qty</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => {
                    const remaining = remainingOf(it);
                    return (
                      <tr key={it.productId} className="border-b border-slate-100">
                        <td className="py-1.5">{it.name}</td>
                        <td>{fmtQty(it.qty)} {it.unit}</td>
                        <td className="text-slate-400">{fmtQty(it.returnedQty || 0)} {it.unit}</td>
                        <td>
                          <input
                            type="number" step="any" min="0" max={remaining}
                            disabled={remaining <= 0}
                            className="w-20 border border-slate-300 rounded px-1.5 py-1 text-right disabled:bg-slate-50 disabled:text-slate-300"
                            value={qtys[it.productId] || 0}
                            onChange={(e) => setQtys((q) => ({ ...q, [it.productId]: parseFloat(e.target.value) || 0 }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Field label="Reason">
                <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
                  <option>Customer return</option>
                  <option>Wrong item sold</option>
                  <option>Damaged / faulty</option>
                  <option>Other</option>
                </select>
              </Field>
              <p className="text-xs rounded-md px-3 py-2 mb-1 bg-slate-50 text-slate-500">
                {restocks
                  ? "The returned quantity goes back into sellable stock at this location."
                  : "The customer is still refunded, but this quantity will NOT be added back to sellable stock - it's recorded as written off."}
              </p>
              <button onClick={confirmReturn} className={`${btnPrimary} w-full mt-2`}>Confirm return</button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}