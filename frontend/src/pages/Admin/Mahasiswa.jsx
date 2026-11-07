import { useEffect, useRef, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Plus, Trash2, Users, AlertCircle, CheckCircle2, Camera, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function AdminMahasiswa() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nim: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Face upload state
  const [uploadingFaceId, setUploadingFaceId] = useState(null);
  const [faceUploadError, setFaceUploadError] = useState('');
  const faceInputRef = useRef(null);

  const fetchStudents = async () => {
    try {
      const r = await api.get('/api/users/students');
      setStudents(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/users/students', form);
      setSuccess('Mahasiswa berhasil ditambahkan!');
      setShowModal(false);
      setForm({ nim: '', name: '', email: '', password: '' });
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.detail || 'Gagal menambahkan mahasiswa');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus mahasiswa ini? Semua data terkait (absensi, dsb) akan terhapus.')) return;
    try {
      await api.delete(`/api/users/students/${id}`);
      fetchStudents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFaceUpload = async (studentId, file) => {
    if (!file) return;
    setUploadingFaceId(studentId);
    setFaceUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/api/users/students/${studentId}/face`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Foto wajah berhasil diupload!');
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setFaceUploadError(e.response?.data?.detail || 'Gagal upload foto wajah');
    } finally {
      setUploadingFaceId(null);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">Data Mahasiswa</h1>
            <p className="page-sub">Kelola akun, info, dan data wajah mahasiswa terdaftar</p>
          </div>
          <button
            className="btn btn-primary shadow-lg shadow-[var(--accent)]/20 px-6"
            onClick={() => { setShowModal(true); setError(''); }}
          >
            <Plus size={18} /> Tambah Mahasiswa
          </button>
        </AnimatedSection>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-4 mb-6 rounded-xl bg-[var(--green-bg)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] flex items-center gap-2 font-medium"
            >
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
          {faceUploadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-4 mb-6 rounded-xl bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-center gap-2 font-medium"
            >
              <AlertCircle size={18} /> {faceUploadError}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatedSection delay={0.2}>
          <GlassCard className="p-0 overflow-hidden">
            <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center justify-between bg-[var(--surface2)]">
              <div className="flex items-center gap-2 text-[var(--text-1)] font-bold text-sm">
                <Users size={16} className="text-[var(--text-3)]" /> DAFTAR MAHASISWA
              </div>
              <span className="badge border border-[var(--border2)]">{students.length} Total</span>
            </div>

            {loading ? (
              <div className="empty-state py-20">Memuat data...</div>
            ) : students.length === 0 ? (
              <div className="empty-state py-20">Belum ada data mahasiswa</div>
            ) : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>NIM</th>
                      <th>Nama Lengkap</th>
                      <th>Alamat Email</th>
                      <th className="text-center">Data Wajah</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-[var(--surface2)] group transition-colors">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td className="font-bold text-[var(--text-1)] tracking-wider">{s.nim}</td>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-xs text-[var(--text-2)]">{s.email}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {s.has_embedding ? (
                              <span className="badge badge-green flex items-center gap-1">
                                <CheckCircle2 size={11} /> Terdaftar
                              </span>
                            ) : (
                              <span className="badge badge-amber flex items-center gap-1">
                                <AlertCircle size={11} /> Belum ada
                              </span>
                            )}
                            {/* Upload foto wajah */}
                            <label
                              className={clsx(
                                "btn btn-ghost btn-sm border border-[var(--border)] cursor-pointer flex items-center gap-1 text-xs",
                                uploadingFaceId === s.id && "opacity-50 pointer-events-none"
                              )}
                              title="Upload foto wajah"
                            >
                              {uploadingFaceId === s.id ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                <Camera size={13} />
                              )}
                              {s.has_embedding ? 'Ganti' : 'Upload'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFaceUpload(s.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </td>
                        <td className="text-right">
                          <button
                            className="btn btn-ghost text-red-500 hover:bg-red-500/10 hover:border-red-500/20 px-3 py-1.5 border-[var(--border)]"
                            onClick={() => handleDelete(s.id)}
                          >
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

        {/* Info box */}
        <AnimatedSection delay={0.3}>
          <div className="mt-4 p-4 rounded-xl bg-[var(--blue-bg)] border border-[var(--blue)]/20 text-sm text-[var(--text-2)] flex items-start gap-3">
            <Camera size={18} className="text-[var(--blue)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--text-1)]">Cara daftarkan wajah mahasiswa:</span>
              <span className="ml-1">Klik tombol <b>Upload</b> di kolom "Data Wajah", pilih 1 foto wajah yang jelas (menghadap kamera, pencahayaan cukup). Sistem akan otomatis mengekstrak data biometrik.</span>
            </div>
          </div>
        </AnimatedSection>

        {/* Modal Tambah Mahasiswa */}
        <AnimatePresence>
          {showModal && (
            <div
              className="modal-backdrop bg-black/80 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
            >
              <AnimatedSection className="w-full max-w-md">
                <GlassCard className="p-8 border border-[var(--border2)]">
                  <h2 className="text-xl font-bold text-[var(--text-1)] mb-6">Tambah Mahasiswa Baru</h2>
                  {error && (
                    <div className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm">
                      <AlertCircle size={16} className="mt-0.5" /> {error}
                    </div>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {[
                      ['nim', 'Nomor Induk Mahasiswa (NIM)', 'text', '12345678'],
                      ['name', 'Nama Lengkap', 'text', 'Budi Santoso'],
                      ['email', 'Alamat Email', 'email', 'budi@binus.ac.id'],
                      ['password', 'Password Default', 'password', '••••••••'],
                    ].map(([k, l, t, p]) => (
                      <div key={k}>
                        <label className="input-label">{l}</label>
                        <input
                          type={t}
                          className="input bg-[var(--bg)]"
                          value={form[k]}
                          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                          placeholder={p}
                          required
                        />
                      </div>
                    ))}
                    <p className="text-xs text-[var(--text-3)] bg-[var(--surface2)] p-3 rounded-lg">
                      💡 Setelah mahasiswa ditambahkan, upload foto wajah dari tabel untuk mendaftarkan data biometrik.
                    </p>
                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="btn btn-primary flex-1 justify-center py-2.5">
                        Simpan Data
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost px-6 border-[var(--border)]"
                        onClick={() => setShowModal(false)}
                      >
                        Batal
                      </button>
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
