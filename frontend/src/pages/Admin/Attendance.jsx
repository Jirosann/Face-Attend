import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { CheckCircle2, AlertCircle, RefreshCw, Filter, Trash2, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function AdminAttendance() {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  const fetchData = async () => {
    try {
      const r = await api.get('/api/attendance/all');
      setAttendances(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus log absensi ini? Status mahasiswa untuk sesi tersebut akan terhapus.')) return;
    setDeleting(id);
    try {
      await api.delete(`/api/attendance/${id}`);
      setAttendances(prev => prev.filter(a => a.id !== id));
      showToast('✓ Data absensi berhasil diekskusi dari sistem.');
    } catch (e) {
      showToast('⚠ Error: Gagal mengkomunikasikan ke database server.');
    } finally { setDeleting(null); }
  };

  const filtered = filterDate
    ? attendances.filter(a => {
        const checkIn = new Date(a.check_in_time);
        const filter = new Date(filterDate);
        return (
          checkIn.getFullYear() === filter.getFullYear() &&
          checkIn.getMonth() === filter.getMonth() &&
          checkIn.getDate() === filter.getDate()
        );
      })
    : attendances;

  const totalHadir = filtered.filter(a => a.status === 'hadir').length;
  const totalTerlambat = filtered.filter(a => a.status === 'terlambat').length;

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content relative">
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className={clsx("fixed top-4 right-8 z-50 px-5 py-3 rounded-xl border flex items-center gap-3 text-sm font-bold shadow-2xl backdrop-blur-md", toast.includes('Error') ? "bg-[rgba(239,68,68,0.95)] border-red-400 text-white" : "bg-[var(--surface)] border-[var(--green)] text-[var(--text-1)]")}
            >
              {toast.includes('Error') ? <AlertCircle size={18} /> : <CheckCircle2 size={18} className="text-[var(--green)]" />}
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatedSection delay={0.1} className="mb-8">
          <h1 className="page-title">Monitoring Absensi Global</h1>
          <p className="page-sub">Laporan dan penghapusan data log kehadiran mahasiswa</p>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--green)]">
              <div className="w-12 h-12 rounded-full bg-[var(--green-bg)] text-[var(--green)] flex items-center justify-center"><CheckCircle2 size={24} /></div>
              <div>
                <div className="text-[12px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Mhs Hadir</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{totalHadir}</div>
              </div>
            </GlassCard>
            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--amber)]">
              <div className="w-12 h-12 rounded-full bg-[var(--amber-bg)] text-[var(--amber)] flex items-center justify-center"><AlertCircle size={24} /></div>
              <div>
                <div className="text-[12px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Mhs Terlambat</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{totalTerlambat}</div>
              </div>
            </GlassCard>
            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--blue)]">
              <div className="w-12 h-12 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center"><ClipboardList size={24} /></div>
              <div>
                <div className="text-[12px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Total Absensi</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{filtered.length}</div>
              </div>
            </GlassCard>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <GlassCard className="mb-6 bg-[var(--surface2)] border-[var(--border2)] p-4 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end w-full sm:w-auto">
              <div>
                <label className="input-label flex items-center gap-2"><Filter size={14} /> Tanggal Filter Absensi</label>
                <input type="date" className="input bg-[var(--bg)] border-[var(--border)]" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              {filterDate && (
                <button className="btn btn-ghost h-[42px] border-[var(--border)] px-4 shrink-0 font-medium" onClick={() => setFilterDate('')}>
                  <RefreshCw size={14} /> Tampilkan Semua
                </button>
              )}
            </div>
            <div className="text-xs font-bold text-[var(--text-3)] text-right">
              {filterDate ? `Hanya Menampilkan ${filtered.length} riwayat` : `Menampilkan keseluruhan ${filtered.length} riwayat`}
            </div>
          </GlassCard>
        </AnimatedSection>

        <AnimatedSection delay={0.4}>
          <GlassCard className="p-0 overflow-hidden">
            {loading ? <div className="empty-state py-20">Memuat log dari database...</div>
            : filtered.length === 0 ? <div className="empty-state py-20 border-t border-[var(--border)]">Filter nihil. Tidak ada data absensi yang sesuai kriteria.</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead><tr><th className="w-12 text-center">#</th><th>NIM & Nama</th><th>Mata Kuliah / Waktu</th><th>Status Integrasi</th><th className="text-right">Tindakan Admin</th></tr></thead>
                  <tbody>
                    {filtered.map((a, i) => (
                      <tr key={a.id} className="group hover:bg-[var(--surface2)] transition-colors">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td>
                          <div className="font-bold text-[var(--text-1)] uppercase tracking-wider text-xs mb-1">{a.student_nim}</div>
                          <div className="font-medium text-[13px]">{a.student_name}</div>
                        </td>
                        <td>
                          <div className="font-bold text-[var(--text-1)] text-[13px] mb-1">{a.course_name || '—'}</div>
                          <div className="text-[11px] font-mono text-[var(--text-3)]">{new Date(a.check_in_time).toLocaleString('id-ID', { dateStyle:'full', timeStyle:'short' })}</div>
                        </td>
                        <td>
                          <span className={clsx("badge border text-[10px]", a.status === 'hadir' ? 'badge-green border-green-500/20' : 'badge-amber border-amber-500/20')}>
                            {a.status === 'hadir' ? 'Tepat Waktu' : 'Terlambat Masuk'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            className="btn btn-ghost py-1.5 px-3 border border-[var(--border)] text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                          >
                            {deleting === a.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />} 
                            <span className="hidden sm:inline-block ml-1">{deleting === a.id ? 'Loading' : 'Revert'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </AnimatedSection>
      </div>
    </div>
  );
}
