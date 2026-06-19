import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { CreditCard, Check } from "lucide-react";

export default function SupplierInvoice() {
  const [invoices, setInvoices] = useState([]);

  const fetchInvoices = () => {
    api.get("/purchase/invoices").then((r) => setInvoices(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePay = (id) => {
    if (confirm("Konfirmasi pembayaran faktur supplier ini?")) {
      // In mockDb, we can adjust the invoice record to paid
      // Let's call mock API
      api.post("/purchase/invoices", { id, status: "Paid" }).then(() => {
        fetchInvoices();
        alert("Faktur berhasil ditandai Lunas!");
      });
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="supplier-invoice-page">
      <div>
        <span className="label-tiny">Purchase</span>
        <h1 className="font-display text-3xl font-bold mt-1">Supplier Invoice</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Tagihan & Faktur Supplier</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Invoice</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Referensi PO</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jumlah Tagihan</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jatuh Tempo</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Status</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {invoices.map((inv) => {
                const isPaid = inv.status === "Paid";
                const isOverdue = new Date(inv.due_date) < new Date() && !isPaid;
                return (
                  <tr key={inv.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-mono font-bold text-xs">{inv.invoice_no}</td>
                    <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">{inv.po_no}</td>
                    <td className="py-3 font-mono font-semibold">{fmtIDR(inv.amount)}</td>
                    <td className={`py-3 text-xs ${isOverdue ? "text-red-500 font-bold" : "text-[hsl(var(--muted))]"}`}>
                      {inv.due_date} {isOverdue && "(Overdue)"}
                    </td>
                    <td className="py-3">
                      <span className={`pill ${isPaid ? "pill-success" : "pill-warning"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {!isPaid && (
                        <button onClick={() => handlePay(inv.id)} className="btn-primary py-1 px-3 text-xs flex items-center gap-1 font-semibold ml-auto">
                          <CreditCard size={12} /> Tandai Lunas
                        </button>
                      )}
                      {isPaid && (
                        <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5 justify-end">
                          <Check size={14} /> Terbayar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada faktur supplier.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
