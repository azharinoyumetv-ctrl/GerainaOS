import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Plus, Check, HandCoins } from "lucide-react";

export default function AccountsReceivable() {
  const [receivables, setReceivables] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fetchReceivables = () => {
    api.get("/debt/receivables").then((r) => setReceivables(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !orderNo.trim() || !amount) return;

    api.post("/debt/receivables", {
      customer_name: customerName,
      order_no: orderNo,
      amount: parseInt(amount),
      paid_amount: 0,
      due_date: dueDate || new Date().toISOString().slice(0, 10),
      status: "Unpaid"
    }).then(() => {
      setCustomerName("");
      setOrderNo("");
      setAmount("");
      setDueDate("");
      fetchReceivables();
      alert("Catatan Piutang Baru berhasil ditambahkan!");
    });
  };

  const handleSettle = (id, currentPaid, totalAmount) => {
    const pay = prompt(`Masukkan jumlah cicilan / pelunasan (Total Tagihan: ${fmtIDR(totalAmount)}):`, totalAmount - currentPaid);
    if (pay === null || isNaN(pay) || parseInt(pay) <= 0) return;

    const newPaid = currentPaid + parseInt(pay);
    const status = newPaid >= totalAmount ? "Paid" : "Partial";

    // Call mock endpoint
    api.post("/debt/receivables", { id, paid_amount: newPaid, status }).then(() => {
      fetchReceivables();
      alert("Pembayaran piutang berhasil dicatat!");
    });
  };

  return (
    <div className="p-8 space-y-6" data-testid="receivables-page">
      <div>
        <span className="label-tiny">Hutang Piutang</span>
        <h1 className="font-display text-3xl font-bold mt-1">Accounts Receivable (Piutang Dagang)</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Catat Piutang Pelanggan</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Pelanggan</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Contoh: Budi Gunawan"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">No Referensi / Transaksi POS</label>
            <input
              type="text"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="Contoh: GR-2026..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jumlah Piutang</label>
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
            <Plus size={16} /> Catat Piutang
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="receivables-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Tagihan Piutang Pelanggan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Pelanggan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Referensi</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jumlah Tagihan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Terbayar</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Sisa Piutang</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {receivables.map((r) => {
                  const remaining = r.amount - r.paid_amount;
                  const isPaid = r.status === "Paid";
                  return (
                    <tr key={r.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                      <td className="py-3 font-medium text-xs">
                        <div>{r.customer_name}</div>
                        <div className="text-[10px] text-[hsl(var(--muted))]">Tempo: {r.due_date}</div>
                      </td>
                      <td className="py-3 font-mono text-xs">{r.order_no}</td>
                      <td className="py-3 font-mono text-xs">{fmtIDR(r.amount)}</td>
                      <td className="py-3 font-mono text-xs text-emerald-600">{fmtIDR(r.paid_amount)}</td>
                      <td className="py-3 font-mono text-xs font-bold text-red-500">{fmtIDR(remaining)}</td>
                      <td className="py-3 text-right">
                        {!isPaid ? (
                          <button onClick={() => handleSettle(r.id, r.paid_amount, r.amount)} className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 font-semibold ml-auto">
                            <HandCoins size={12} /> Terima Bayar
                          </button>
                        ) : (
                          <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5 justify-end">
                            <Check size={14} /> Lunas
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {receivables.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada catatan piutang dagang.</td>
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
