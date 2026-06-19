import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [memberships, setMemberships] = useState([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("Bronze");
  const [points, setPoints] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const fetchData = () => {
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get("/customers/memberships").then((r) => setMemberships(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name,
      phone,
      email,
      membership_tier: tier,
      loyalty_points: parseInt(points) || 0,
      created_at: new Date().toISOString()
    };

    if (editingId) {
      api.put(`/customers/${editingId}`, payload).then(() => {
        setEditingId(null);
        clearForm();
        fetchData();
      });
    } else {
      api.post("/customers", payload).then(() => {
        clearForm();
        fetchData();
      });
    }
  };

  const clearForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setTier("Bronze");
    setPoints(0);
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setTier(c.membership_tier || "Bronze");
    setPoints(c.loyalty_points || 0);
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) {
      api.delete(`/customers/${id}`).then(() => fetchData());
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="customers-page">
      <div>
        <span className="label-tiny">Pelanggan</span>
        <h1 className="font-display text-3xl font-bold mt-1">Customer List</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="customer-form">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Gunawan"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">No Telepon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="budi@email.com"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Membership</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              >
                {memberships.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Loyalty Points</label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="Poin"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="customer-submit">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Pelanggan</>}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); clearForm(); }}
              className="btn-outline w-full py-2 mt-2 text-xs"
            >
              Batal
            </button>
          )}
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="customers-list">
          <h2 className="font-display font-bold text-lg mb-4">Database Pelanggan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Pelanggan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kontak</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Membership</th>
                  <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Poin</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium text-xs">{c.name}</td>
                    <td className="py-3 text-xs">
                      <div>{c.phone || "-"}</div>
                      <div className="text-[hsl(var(--muted))]">{c.email || "-"}</div>
                    </td>
                    <td className="py-3 text-xs">
                      <span className={`pill ${
                        c.membership_tier === "Platinum" ? "pill-accent" :
                        c.membership_tier === "Gold" ? "pill-success" : "pill-warning"
                      }`}>
                        {c.membership_tier}
                      </span>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-xs">{c.loyalty_points}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada pelanggan terdaftar.</td>
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
