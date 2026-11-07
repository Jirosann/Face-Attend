import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Calendar, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ course_id: '', day: '', start_time: '', end_time: '', room: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [sr, cr] = await Promise.all([api.get('/api/schedules'), api.get('/api/courses')]);
      setSchedules(sr.data); setCourses(cr.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/api/schedules', form);
      setSuccess('Jadwal berhasil ditambahkan!');
      setShowModal(false); setForm({ course_id: '', day: '', start_time: '', end_time: '', room: '' }); fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.detail || 'Gagal menambahkan jadwal'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus jadwal ini?')) return;
    try { await api.delete(`/api/schedules/${id}`); fetchData(); } catch (e) { console.error(e); }
  };

  const dayColors = { Senin:'badge-blue', Selasa:'badge-purple', Rabu:'badge-green', Kamis:'badge-amber', Jumat:'badge-red' };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">Jadwal Kelas Reguler</h1>
            <p className="page-sub">Kelola alokasi waktu dan ruang kelas mata kuliah</p>
          </div>
          <button className="btn btn-primary shadow-lg shadow-[var(--accent)]/20 px-6" onClick={() => { setShowModal(true); setError(''); }}>
            <Plus size={18} /> Buat Jadwal
          </button>
        </AnimatedSection>

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 mb-6 rounded-xl bg-[var(--green-bg)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] flex items-center gap-2 font-medium">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatedSection delay={0.2}>
          <GlassCard className="p-0 overflow-hidden">
            <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center justify-between bg-[var(--surface2)]">
              <div className="flex items-center gap-2 text-[var(--text-1)] font-bold text-sm uppercase tracking-wider">
                <Calendar size={16} className="text-[var(--text-3)]" /> JADWAL AKTIF
              </div>
              <span className="badge border border-[var(--border2)]">{schedules.length} Sesi</span>
            </div>
            
            {loading ? <div className="empty-state py-20">Memuat data...</div>
            : schedules.length === 0 ? <div className="empty-state py-20">Belum ada jadwal</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead><tr><th className="w-12 text-center">#</th><th>Mata Kuliah / Dosen</th><th>Hari</th><th>Jam</th><th>Ruangan</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {schedules.map((s, i) => (
                      <tr key={s.id} className="hover:bg-[var(--surface2)] group transition-colors">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td className="font-bold text-[var(--text-1)] text-sm">{s.course_name}</td>
                        <td><span className={`badge ${dayColors[s.day] || 'badge-blue'} badge-md font-bold uppercase tracking-wider text-[10px]`}>{s.day}</span></td>
                        <td className="font-mono text-xs font-semibold text-[var(--text-2)]">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</td>
                        <td className="font-bold text-[var(--text-2)]">R. {s.room}</td>
                        <td className="text-right">
                          <button className="btn btn-ghost py-1.5 px-3 border border-[var(--border)] text-red-500 hover:bg-red-500/10 hover:border-red-500/20" onClick={() => handleDelete(s.id)}>
                            <Trash2 size={14} /> Hapus
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

        <AnimatePresence>
          {showModal && (
            <div className="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
              <AnimatedSection className="w-full max-w-md">
                <GlassCard className="p-8 border border-[var(--border2)]">
                  <h2 className="text-xl font-bold text-[var(--text-1)] mb-6">Tambah Jadwal Baru</h2>
                  {error && <div className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm"><AlertCircle size={16} className="mt-0.5" /> {error}</div>}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="input-label">Mata Kuliah Dasar</label>
                      <select className="select-field input bg-[var(--bg)]" value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})} required>
                        <option value="">-- Pilih Mata Kuliah --</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Hari Perkuliahan</label>
                      <select className="select-field input bg-[var(--bg)]" value={form.day} onChange={e => setForm({...form, day: e.target.value})} required>
                        <option value="">-- Pilih Hari --</option>
                        {['Senin','Selasa','Rabu','Kamis','Jumat'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">Jam Mulai</label>
                        <input type="time" className="input bg-[var(--bg)]" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} required />
                      </div>
                      <div>
                        <label className="input-label">Jam Selesai</label>
                        <input type="time" className="input bg-[var(--bg)]" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} required />
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Alokasi Ruangan</label>
                      <input type="text" className="input bg-[var(--bg)]" value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="Contoh: AD102" required />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="btn btn-primary flex-1 justify-center py-2.5">Simpan Jadwal</button>
                      <button type="button" className="btn btn-ghost px-6 border-[var(--border)]" onClick={() => setShowModal(false)}>Batal</button>
                    </div>
                  </form>
                </GlassCard>
              </AnimatedSection>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
