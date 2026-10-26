import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Clock, RefreshCw, LogIn, LogOut } from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { canViewTeamAttendance } from "@/auth/permissions";
import { toast } from "@/components/ui/sonner";

const message = (error, fallback) => typeof error?.response?.data?.detail === "string" ? error.response.data.detail : fallback;
const intentKey = scope => `geraina:attendance:check-in:${scope}`;
function pendingIntent(scope) { try { return localStorage.getItem(intentKey(scope)); } catch { return null; } }
function clearIntent(scope) { try { localStorage.removeItem(intentKey(scope)); } catch {} }
function time(value, zone) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu catatan lama tidak valid";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: zone || "Asia/Jakarta" }).format(date);
}
function duration(row) {
  if (!row.clock_out) return "Berjalan";
  const minutes = Math.max(0, Math.floor((new Date(row.clock_out) - new Date(row.clock_in)) / 60000));
  return Number.isFinite(minutes) ? `${Math.floor(minutes / 60)} jam ${minutes % 60} menit` : "—";
}

export default function AttendanceWorkspace() {
  const { user } = useAuth(), location = useLocation();
  const scope = `${user?.id}:${user?.store_id}`, scopeRef = useRef(scope); scopeRef.current = scope;
  const teamAllowed = canViewTeamAttendance(user?.role);
  const [tab, setTab] = useState(location.pathname.includes("/staff/") && teamAllowed ? "team" : "self");
  const [own, setOwn] = useState(null), [team, setTeam] = useState(null);
  const [ownError, setOwnError] = useState(""), [teamError, setTeamError] = useState("");
  const [loading, setLoading] = useState(false), [teamLoading, setTeamLoading] = useState(false), [busy, setBusy] = useState(false);
  const ownSeq = useRef(0), teamSeq = useRef(0), operation = useRef(false);
  const loadOwn = async () => {
    const seq = ++ownSeq.current, current = scope;
    setLoading(true); setOwnError("");
    try {
      const { data } = await api.get("/attendance/me", { timeout: 12000 });
      if (seq !== ownSeq.current || current !== scopeRef.current) return;
      if (!Array.isArray(data.history)) throw new Error("Invalid attendance response");
      setOwn(data);
      const nonce = pendingIntent(current);
      if (nonce && data.history.some(row => row.check_in_request_id === nonce)) clearIntent(current);
    } catch (e) { if (seq === ownSeq.current && current === scopeRef.current) setOwnError(message(e, "Absensi Anda belum dapat dimuat. Periksa koneksi dan coba lagi.")); }
    finally { if (seq === ownSeq.current && current === scopeRef.current) setLoading(false); }
  };
  const loadTeam = async () => {
    if (!teamAllowed) return;
    const seq = ++teamSeq.current, current = scope;
    setTeamLoading(true); setTeamError("");
    try {
      const { data } = await api.get("/attendance", { timeout: 12000 });
      if (seq !== teamSeq.current || current !== scopeRef.current) return;
      if (!Array.isArray(data)) throw new Error("Invalid team response");
      setTeam(data);
    } catch (e) { if (seq === teamSeq.current && current === scopeRef.current) setTeamError(message(e, "Kehadiran tim belum dapat dimuat. Coba lagi.")); }
    finally { if (seq === teamSeq.current && current === scopeRef.current) setTeamLoading(false); }
  };
  useEffect(() => {
    setOwn(null); setTeam(null); setOwnError(""); setTeamError(""); loadOwn();
    return () => { ownSeq.current++; teamSeq.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  useEffect(() => { if (tab === "team" && teamAllowed) loadTeam(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, teamAllowed, scope]);
  useEffect(() => {
    const beforeSwitch = event => { if (operation.current) event.preventDefault(); };
    window.addEventListener("geraina-before-account-switch", beforeSwitch);
    return () => window.removeEventListener("geraina-before-account-switch", beforeSwitch);
  }, []);

  const clock = async action => {
    if (operation.current || !own || ownError) return;
    if (!navigator.onLine) { setOwnError("Absensi memerlukan internet agar waktu dan identitas dicatat oleh server. Penjualan tunai offline tetap tersedia di kasir."); return; }
    const current = scope;
    operation.current = true; ownSeq.current++; setBusy(true); setOwnError("");
    try {
      let body;
      if (action === "check-in") {
        const request_id = pendingIntent(current) || crypto.randomUUID();
        try { localStorage.setItem(intentKey(current), request_id); } catch {}
        body = { request_id };
      } else body = { attendance_id: own.open_shift.id };
      const { data: row } = await api.post(`/attendance/me/${action}`, body, { timeout: 12000 });
      if (current !== scopeRef.current) return;
      setOwn(previous => ({ ...previous,
        history: [row, ...(previous?.history || []).filter(item => item.id !== row.id)],
        open_shift: row.is_open ? row : previous?.open_shift?.id === row.id ? null : previous?.open_shift || null,
      }));
      if (action === "check-in") clearIntent(current);
      toast.success(action === "check-in" ? "Absen masuk dicatat untuk akun Anda." : "Shift Anda sudah ditutup.");
      await loadOwn();
      if (tab === "team") await loadTeam();
    } catch (e) { if (current === scopeRef.current) setOwnError(message(e, "Absensi belum dapat dipastikan. Segarkan status sebelum mencoba lagi; permintaan masuk yang sama akan digunakan kembali.")); }
    finally { operation.current = false; if (current === scopeRef.current) setBusy(false); }
  };
  const zone = own?.timezone || "Asia/Jakarta";
  return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="attendance-page">
    <div className="flex flex-wrap gap-3 items-end justify-between"><div><span className="label-tiny">Kehadiran</span><h1 className="font-display text-3xl font-bold mt-1">Absensi saya</h1><p className="text-sm text-[hsl(var(--muted))] mt-2" data-testid="attendance-identity">{user?.name || user?.email} · {user?.role}</p></div><button className="btn-outline" disabled={busy || loading || teamLoading} onClick={() => { loadOwn(); if (tab === "team") loadTeam(); }} data-testid="attendance-refresh"><RefreshCw size={15} /> Segarkan</button></div>
    {teamAllowed && <div className="flex gap-2"><button onClick={() => setTab("self")} className={tab === "self" ? "btn-primary" : "btn-outline"} data-testid="attendance-tab-self">Absensi saya</button><button onClick={() => setTab("team")} className={tab === "team" ? "btn-primary" : "btn-outline"} data-testid="attendance-tab-team">Kehadiran tim</button></div>}
    <div className="card-surface p-5 space-y-3" data-testid="attendance-own-status">
      <div className="flex flex-wrap justify-between gap-4"><div><p className="font-semibold flex items-center gap-2"><Clock size={18} /> {!own ? "Memeriksa status absensi" : own.open_shift ? "Shift Anda sedang berjalan" : "Tidak ada shift berjalan"}</p><p className="text-sm text-[hsl(var(--muted))] mt-2">Waktu toko: {zone}. Identitas dan waktu absensi ditetapkan oleh server.</p>{own?.open_shift && <p className="text-sm mt-2" data-testid="attendance-open-start">Masuk: {time(own.open_shift.clock_in, zone)}</p>}</div>
        <button className="btn-primary disabled:opacity-50" disabled={busy || loading || !own || Boolean(ownError)} onClick={() => clock(own?.open_shift ? "check-out" : "check-in")} data-testid={own?.open_shift ? "attendance-check-out" : "attendance-check-in"}>{own?.open_shift ? <LogOut size={16} /> : <LogIn size={16} />}{busy ? "Mencatat…" : own?.open_shift ? "Absen keluar" : "Absen masuk"}</button>
      </div>
      {loading && <p role="status" className="text-sm">Memuat status absensi…</p>}
      {ownError && <p role="alert" className="text-sm text-red-700" data-testid="attendance-error">{ownError}</p>}
      {!ownError && own && <p className="text-xs text-[hsl(var(--muted))]">Hanya kehadiran akun yang sedang masuk dapat dicatat. Ganti pengguna untuk staf berikutnya. Shift yang melewati tengah malam tetap dapat ditutup.</p>}
    </div>
    {tab === "self" && own && <section className="card-surface p-5 space-y-3"><h2 className="font-display font-bold text-lg">Riwayat saya</h2>{own.history.length === 0 ? <p className="text-sm text-[hsl(var(--muted))]" data-testid="attendance-own-empty">Belum ada absensi untuk akun ini.</p> : own.history.map(row => <div key={row.id} className="border-t py-3 flex flex-wrap justify-between gap-3 text-sm" data-testid={`attendance-own-${row.id}`}><div><p className="font-semibold">{time(row.clock_in, row.timezone || zone)}</p><p className="text-[hsl(var(--muted))] mt-1">Keluar: {time(row.clock_out, row.timezone || zone)}</p></div><div><span className={`pill ${row.clock_out ? "pill-muted" : "pill-success"}`}>{row.clock_out ? "Selesai" : "Berjalan"}</span><p className="mt-1 text-xs">{duration(row)}</p></div></div>)}</section>}
    {tab === "team" && teamAllowed && <section className="card-surface p-5 space-y-3" data-testid="attendance-team"><h2 className="font-display font-bold text-lg">Kehadiran tim</h2><p className="text-xs text-[hsl(var(--muted))]">Pemantauan untuk Owner dan Manager. Tombol absen di atas tetap hanya mencatat akun Anda.</p>{teamLoading && <p role="status">Memuat kehadiran tim…</p>}{teamError && <p role="alert" className="text-sm text-red-700">{teamError}</p>}{!teamError && !teamLoading && team?.length === 0 && <p>Belum ada catatan tim.</p>}{!teamError && team?.map(row => <div key={row.id} className="border-t py-3 grid gap-2 sm:grid-cols-3 text-sm" data-testid={`attendance-team-${row.id}`}><div><p className="font-semibold">{row.staff_name}</p>{row.legacy_unassigned && <p className="text-xs text-amber-800">Catatan lama · identitas belum ditautkan</p>}</div><div><p>Masuk: {time(row.clock_in, row.timezone || zone)}</p><p>Keluar: {time(row.clock_out, row.timezone || zone)}</p></div><p>{duration(row)}</p></div>)}</section>}
  </div>;
}
