import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Plus, Check, CreditCard } from "lucide-react";

export default function AccountsPayable() {
  const [payables, setPayables] = useState([]);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fetchPayables = () => {
    api.get("/debt/payables").then((r) => setPayables(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!supplierName.trim() || !invoiceNo.trim() || !amount) return;

    api.post("/debt/payables", {
      supplier_name: supplierName,
      invoice_no: invoiceNo,
      amount: parseInt(amount),
      paid_amount: 0,
      due_date: dueDate || new Date().toISOString().slice(0, 10),
      status: "Unpaid"
    }).then(() => {
      setSupplierName("");
      setInvoiceNo("");
      setAmount("");
      setDueDate("");
      fetchPayables();
      alert("Catatan Hutang Baru berhasil ditambahkan!");
    });
  };

  const handleSettle = (id, currentPaid, totalAmount) => {
    const pay = prompt(`Masukkan jumlah pelunasan / cicilan hutang ke supplier (Total: ${fmtIDR(totalAmount)}):`, totalAmount - currentPaid);
    if (pay === null || isNaN(pay) || parseInt(pay) <= 0) return;

    const newPaid = currentPaid + parseInt(pay);
    const status = newPaid >= totalAmount ? "Paid" : "Partial";

    api.post("/debt/payables", { id, paid_amount: newPaid, status }).then(() => {
      fetchPayables();
      alert("Pembayaran hutang berhasil dicatat!");
    });
  };

  return (
    <div className="p-8 space-y-6" data-testid="payables-page">
      <div>
        <span className="label-tiny">Hutang Piutang</span>
        <h1 className="font-display text-3xl font-bold mt-1">Accounts Payable (Hutang Dagang)</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Catat Hutang ke Supplier</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Supplier</label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Contoh: PT. Sumber Pangan"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">No Faktur / Invoice</label>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="Contoh: INV/SP/2026..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jumlah Hutang</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Rp"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jatuh Tempo</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            <Plus size={16} /> Catat Hutang
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="payables-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Tagihan Hutang Toko ke Supplier</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Supplier</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Faktur</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jumlah Hutang</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Terbayar</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Sisa Hutang</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {payables.map((p) => {
                  const remaining = p.amount - p.paid_amount;
                  const isPaid = p.status === "Paid";
                  return (
                    <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                      <td className="py-3 font-medium text-xs">
                        <div>{p.supplier_name}</div>
                        <div className="text-[10px] text-[hsl(var(--muted))]">Tempo: {p.due_date}</div>
                      </td>
                      <td className="py-3 font-mono text-xs">{p.invoice_no}</td>
                      <td className="py-3 font-mono text-xs">{fmtIDR(p.amount)}</td>
                      <td className="py-3 font-mono text-xs text-emerald-600">{fmtIDR(p.paid_amount)}</td>
                      <td className="py-3 font-mono text-xs font-bold text-red-500">{fmtIDR(remaining)}</td>
                      <td className="py-3 text-right">
                        {!isPaid ? (
                          <button onClick={() => handleSettle(p.id, p.paid_amount, p.amount)} className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 font-semibold ml-auto">
                            <CreditCard size={12} /> Bayar Tagihan
                          </button>
                        ) : (
                          <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5 justify-end">
                            <Check size={14} /> Terbayar Lunas
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payables.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada catatan hutang dagang.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
