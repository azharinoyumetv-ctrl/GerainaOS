import useWorkspace from '@/hooks/useWorkspace';
import WorkspaceState from '@/components/WorkspaceState';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import useAction from '@/hooks/useAction';
import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function BranchManagement() {
  const query = useWorkspace(['/branches']);
  const action = useAction();
  const table = useTablePage(query.data['/branches'] || []);
  const branches = table.rows;
  const fetchBranches = query.retry;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = e => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name, address, phone };
    action.run(() => editingId ? api.put(`/branches/${editingId}`,payload) : api.post('/branches',payload), () => {
      setEditingId(null); clearForm(); fetchBranches();
    });
  };

  const clearForm = () => {
    setName("");
    setAddress("");
    setPhone("");
  };

  const handleEdit = (b) => {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address || "");
    setPhone(b.phone || "");
  };

  const handleDelete = id => {
    if (confirm('Hapus catatan ini?')) action.run(() => api.delete(`/branches/${id}`), fetchBranches);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="branches-page">
      <WorkspaceState query={query}>
      {action.busy && <p role="status">Menyimpan perubahan…</p>}
      {action.error && <p role="alert" className="text-red-800">{action.error}</p>}
      <div>
        <span className="label-tiny">Outlet Cabang</span>
        <h1 className="font-display text-3xl font-bold mt-1">Manajemen Multi-Cabang</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Cabang" : "Tambah Cabang Baru"}</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Cabang / Outlet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Outlet Bandung, Cabang Seminyak"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">No Telepon Outlet</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 021-..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Alamat Lengkap</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap outlet..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-24 resize-none text-sm"
            />
          </div>

          <button disabled={action.busy} type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Cabang</>}
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

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="branches-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Cabang Retail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Cabang</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kontak</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Alamat</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-semibold text-xs text-[hsl(var(--primary))]">{b.name}</td>
                    <td className="py-3 text-xs">{b.phone || "-"}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))] truncate max-w-[220px]">{b.address || "-"}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(b)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePage label="cabang" value={table} />
          </div>
        </div>
      </div>
      </WorkspaceState>
    </div>
  );
}
