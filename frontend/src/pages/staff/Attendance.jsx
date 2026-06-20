import { useEffect, useState } from "react";
import api from "@/api/client";
import { Clock } from "lucide-react";

export default function Attendance() {
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    api.get("/attendance").then((r) => setAttendance(r.data)).catch(() => {});
  }, []);

  const handleClockIn = () => {
    const payload = {
      staff_name: "Azhar Owner",
      clock_in: new Date().toISOString(),
      clock_out: null,
      status: "Hadir"
    };
    api.post("/attendance", payload).then(() => {
      api.get("/attendance").then((r) => setAttendance(r.data)).catch(() => {});
      alert("Absen Masuk (Clock In) berhasil dicatat!");
    });
  };

  const handleClockOut = (id) => {
    const payload = {
      id,
      clock_out: new Date().toISOString()
    };
    api.post("/attendance", payload).then(() => {
      api.get("/attendance").then((r) => setAttendance(r.data)).catch(() => {});
      alert("Absen Keluar (Clock Out) berhasil dicatat!");
    });
  };

  return (
    <div className="p-8 space-y-6" data-testid="attendance-page">
      <div className="flex items-center justify-between">
        <div>
          <span className="label-tiny">Karyawan</span>
          <h1 className="font-display text-3xl font-bold mt-1">Absensi & Shift Karyawan</h1>
        </div>
        <button onClick={handleClockIn} className="btn-primary py-2 px-4 flex items-center gap-2 text-xs font-semibold">
          <Clock size={14} /> Absen Masuk Sekarang
        </button>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Log Kehadiran Karyawan Hari Ini</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Karyawan</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jam Masuk (Clock In)</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jam Pulang (Clock Out)</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Status Absensi</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {attendance.map((att) => (
                <tr key={att.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                  <td className="py-3 font-medium text-xs">{att.staff_name}</td>
                  <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">
                    {new Date(att.clock_in).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">
                    {att.clock_out ? new Date(att.clock_out).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="py-3">
                    <span className="pill pill-success">
                      {att.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {!att.clock_out && (
                      <button onClick={() => handleClockOut(att.id)} className="btn-outline py-1 px-3 text-xs ml-auto">
                        Absen Keluar
                      </button>
                    )}
                    {att.clock_out && <span className="text-xs text-[hsl(var(--muted))]">Shift Selesai</span>}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada data kehadiran hari ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
