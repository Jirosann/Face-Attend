import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Plus, Trash2, UserSquare2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDosen() {
  const [dosen, setDosen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', nip: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = async () => {
    try { const r = await api.get('/api/users/lecturers'); setDosen(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/api/users/lecturers', form);
      setSuccess('Dosen berhasil ditambahkan!');
      setShowModal(false); setForm({ name: '', nip: '', email: '', password: '' }); fetch();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.detail || 'Gagal menambahkan dosen'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus akun dosen ini? Perhatian: Menghapus dosen akan memutuskan relasi mata kuliah dan jadwal kelasnya.')) return;
    try { await api.delete(`/api/users/lecturers/${id}`); fetch(); } catch (e) { console.error(e); }
  };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">Data Dosen Pengajar</h1>
            <p className="page-sub">Kelola akun dan info dosen di sistem</p>
          </div>
          <button className="btn btn-primary shadow-lg shadow-[var(--accent)]/20 px-6" onClick={() => { setShowModal(true); setError(''); }}>
            <Plus size={18} /> Tambah Dosen
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
              <div className="flex items-center gap-2 text-[var(--text-1)] font-bold text-sm">
                <UserSquare2 size={16} className="text-[var(--text-3)]" /> DAFTAR DOSEN
              </div>
              <span className="badge border border-[var(--border2)]">{dosen.length} Total</span>
            </div>
            
            {loading ? <div className="empty-state py-20">Memuat data...</div>
            : dosen.length === 0 ? <div className="empty-state py-20">Belum ada data dosen</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead><tr><th className="w-12 text-center">#</th><th>Nama Lengkap & Gelar</th><th>NIP</th><th>Alamat Email</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {dosen.map((d, i) => (
                      <tr key={d.id} className="hover:bg-[var(--surface2)] group transition-colors">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td className="font-bold text-[var(--text-1)]">{d.name}</td>
                        <td className="text-xs font-mono text-[var(--text-2)]">{d.nip}</td>
                        <td className="text-xs text-[var(--text-2)] font-medium">{d.email}</td>
                        <td className="text-right">
                          <button className="btn btn-ghost text-red-500 hover:bg-red-500/10 hover:border-red-500/20 px-3 py-1.5 border-[var(--border)]" onClick={() => handleDelete(d.id)}>
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
                  <h2 className="text-xl font-bold text-[var(--text-1)] mb-6">Tambah Dosen Baru</h2>
                  {error && <div className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm"><AlertCircle size={16} className="mt-0.5" /> {error}</div>}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {[['name','Nama Lengkap & Gelar','text', 'Dr. Andi Hermawan, S.Kom., M.TI.'],['nip','NIP (Nomor Induk Pegawai)','text', '198501012010011001'],['email','Alamat Email Kerja','email', 'andi.hermawan@binus.ac.id'],['password','Password Default','password', '••••••••']].map(([k,l,t,p]) => (
                      <div key={k}>
                        <label className="input-label">{l}</label>
                        <input type={t} className="input bg-[var(--bg)]" value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} placeholder={p} required />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="btn btn-primary flex-1 justify-center py-2.5">Simpan Data</button>
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
