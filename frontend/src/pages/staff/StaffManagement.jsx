import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Cashier");
  const [status, setStatus] = useState("Aktif");
  const [editingId, setEditingId] = useState(null);

  const fetchStaff = () => {
    api.get("/staff").then((r) => setStaffList(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const payload = { name, email, phone, role, status };

    if (editingId) {
      api.put(`/staff/${editingId}`, payload).then(() => {
        setEditingId(null);
        clearForm();
        fetchStaff();
      });
    } else {
      api.post("/staff", payload).then(() => {
        clearForm();
        fetchStaff();
      });
    }
  };

  const clearForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRole("Cashier");
    setStatus("Aktif");
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone || "");
    setRole(s.role || "Cashier");
    setStatus(s.status || "Aktif");
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menonaktifkan staff ini?")) {
      api.delete(`/staff/${id}`).then(() => fetchStaff());
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="staff-page">
      <div>
        <span className="label-tiny">Staff</span>
        <h1 className="font-display text-3xl font-bold mt-1">Staff Management</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Karyawan" : "Tambah Karyawan"}</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Dewi Lestari"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Email Login</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="karyawan@geraina.com"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">No Handphone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jabatan / Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              >
                <option value="Owner">Owner</option>
                <option value="Manager">Manager</option>
                <option value="Cashier">Cashier</option>
                <option value="Warehouse">Warehouse</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              >
                <option value="Aktif">Aktif</option>
                <option value="Non-Aktif">Non-Aktif</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Karyawan</>}
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

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="staff-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Karyawan Toko</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Email & HP</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jabatan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Status</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium text-xs">{s.name}</td>
                    <td className="py-3 text-xs">
                      <div>{s.email}</div>
                      <div className="text-[hsl(var(--muted))]">{s.phone || "-"}</div>
                    </td>
                    <td className="py-3 text-xs">
                      <span className="font-semibold px-2 py-0.5 rounded bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      <span className={`pill ${s.status === "Aktif" ? "pill-success" : "pill-danger"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
