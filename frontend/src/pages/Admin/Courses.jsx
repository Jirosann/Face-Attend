import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Plus, Trash2, BookOpen, AlertCircle, CheckCircle2, Users2, UserMinus, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEnrollment, setLoadingEnrollment] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [enrollmentSuccess, setEnrollmentSuccess] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);

  const [form, setForm] = useState({ code: '', name: '', lecturer_id: '', credits: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [cr, lr, sr] = await Promise.all([api.get('/api/courses'), api.get('/api/users/lecturers'), api.get('/api/users/students')]);
      setCourses(cr.data); setLecturers(lr.data); setStudents(sr.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/api/courses', form);
      setSuccess('Mata kuliah berhasil ditambahkan!');
      setShowModal(false); setForm({ code: '', name: '', lecturer_id: '', credits: '' }); fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.detail || 'Gagal menambahkan mata kuliah'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus mata kuliah ini? Segala rekaman absensi dan jadwal akan terhapus.')) return;
    try { await api.delete(`/api/courses/${id}`); fetchData(); } catch (e) { console.error(e); }
  };

  const openEnrollmentModal = async (course) => {
    setSelectedCourse(course);
    setSelectedStudentIds([]);
    setShowEnrollmentModal(true);
    setLoadingEnrollment(true);
    setEnrollmentError('');
    setEnrollmentSuccess('');

    try {
      // 🔧 FIX: Refresh students list setiap buka modal untuk data terbaru
      const studentsRes = await api.get('/api/users/students');
      setStudents(studentsRes.data);

      // Fetch enrolled students for this course
      const enrolledRes = await api.get(`/api/courses/${course.id}/students`);
      setEnrolledStudents(enrolledRes.data || []);
      
      // 🎉 Toast notification: Data refreshed
      setEnrollmentSuccess(`✓ Data mahasiswa diperbarui (${studentsRes.data.length} mahasiswa terdaftar)`);
      setTimeout(() => setEnrollmentSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      setEnrolledStudents([]);
      // 🔴 Error handling: Show error message
      setEnrollmentError('Gagal memuat data mahasiswa. Silakan coba lagi.');
    } finally {
      setLoadingEnrollment(false);
    }
  };

  // 🔄 Manual retry function
  const retryFetchStudents = async () => {
    if (!selectedCourse) return;
    setLoadingEnrollment(true);
    setEnrollmentError('');
    
    try {
      const studentsRes = await api.get('/api/users/students');
      setStudents(studentsRes.data);
      
      const enrolledRes = await api.get(`/api/courses/${selectedCourse.id}/students`);
      setEnrolledStudents(enrolledRes.data || []);
      
      setEnrollmentSuccess(`✓ Data berhasil dimuat ulang (${studentsRes.data.length} mahasiswa)`);
      setTimeout(() => setEnrollmentSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      setEnrollmentError('Masih gagal memuat data. Periksa koneksi internet Anda.');
    } finally {
      setLoadingEnrollment(false);
    }
  };

  const handleAssignStudents = async () => {
    if (!selectedCourse || selectedStudentIds.length === 0) return;
    try {
      await api.post(`/api/courses/${selectedCourse.id}/enrollments`, { student_ids: selectedStudentIds });
      const res = await api.get(`/api/courses/${selectedCourse.id}/students`);
      setEnrolledStudents(res.data || []);
      setSelectedStudentIds([]);
      fetchData();
      setSuccess('Mahasiswa berhasil diassign.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.detail || 'Gagal assign mahasiswa');
    }
  };

  const handleRemoveEnrollment = async (studentId) => {
    if (!selectedCourse) return;
    if (!confirm('Keluarkan mahasiswa dari mata kuliah ini? Semua absensinya di mata kuliah ini juga mungkin terpengaruh.')) return;
    try {
      await api.delete(`/api/courses/${selectedCourse.id}/enrollments/${studentId}`);
      const res = await api.get(`/api/courses/${selectedCourse.id}/students`);
      setEnrolledStudents(res.data || []);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const enrolledIds = new Set(enrolledStudents.map((s) => s.student_id));
  const availableStudents = students.filter((s) => !enrolledIds.has(s.id));

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">Mata Kuliah</h1>
            <p className="page-sub">Kelola mata kuliah, Dosen Pengampu, dan KRS Mahasiswa</p>
          </div>
          <button className="btn btn-primary shadow-lg shadow-[var(--accent)]/20 px-6" onClick={() => { setShowModal(true); setError(''); }}>
            <Plus size={18} /> Tambah Matkul
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
                <BookOpen size={16} className="text-[var(--text-3)]" /> DAFTAR MATA KULIAH
              </div>
              <span className="badge border border-[var(--border2)]">{courses.length} Terdaftar</span>
            </div>
            
            {loading ? <div className="empty-state py-20">Memuat data...</div>
            : courses.length === 0 ? <div className="empty-state py-20">Belum ada data mata kuliah</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead><tr><th className="w-12 text-center">#</th><th>Kode</th><th>Nama Mata Kuliah</th><th>Dosen Pengampu</th><th>SKS</th><th className="text-center">Peserta</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {courses.map((c, i) => (
                      <tr key={c.id} className="hover:bg-[var(--surface2)] group transition-colors">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td className="font-bold text-[var(--blue)]"><span className="badge bg-[var(--blue-bg)] border-none text-[var(--blue)]">{c.code}</span></td>
                        <td className="font-bold text-[var(--text-1)] text-[13px]">{c.name}</td>
                        <td className="text-[13px] font-medium">{c.lecturer_name}</td>
                        <td className="text-[12px] font-semibold text-[var(--text-2)]">{c.credits} SKS</td>
                        <td className="text-center">
                          <span className="badge border border-[var(--border2)] bg-[var(--surface)] text-[var(--text-2)]">{c.student_count || 0} orang</span>
                        </td>
                        <td className="text-right flex gap-2 justify-end">
                          <button className="btn btn-ghost py-1.5 px-3 border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]" onClick={() => openEnrollmentModal(c)}>
                            <Users2 size={14} /> Peserta
                          </button>
                          <button className="btn btn-ghost py-1.5 px-3 text-red-500 hover:bg-red-500/10 border border-[var(--border)] hover:border-red-500/20" onClick={() => handleDelete(c.id)}>
                            <Trash2 size={14} />
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

        {/* Modal Tambah Matkul */}
        <AnimatePresence>
          {showModal && (
            <div className="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
              <AnimatedSection className="w-full max-w-md">
                <GlassCard className="p-8 border border-[var(--border2)]">
                  <h2 className="text-xl font-bold text-[var(--text-1)] mb-6">Tambah Mata Kuliah</h2>
                  {error && <div className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm"><AlertCircle size={16} className="mt-0.5" /> {error}</div>}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="input-label">Kode Mata Kuliah</label>
                      <input type="text" className="input bg-[var(--bg)] font-mono uppercase" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="COMP101" required />
                    </div>
                    <div>
                      <label className="input-label">Nama Mata Kuliah</label>
                      <input type="text" className="input bg-[var(--bg)]" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Algoritma dan Pemrograman" required />
                    </div>
                    <div>
                      <label className="input-label">Dosen Pengampu</label>
                      <select className="select-field input bg-[var(--bg)]" value={form.lecturer_id} onChange={e => setForm({...form, lecturer_id: e.target.value})} required>
                        <option value="">-- Pilih Dosen --</option>
                        {lecturers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Bobot SKS</label>
                      <input type="number" className="input bg-[var(--bg)]" value={form.credits} onChange={e => setForm({...form, credits: e.target.value})} placeholder="3" min="1" max="6" required />
                    </div>
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

        {/* Modal Kelola Peserta */}
        <AnimatePresence>
          {showEnrollmentModal && selectedCourse && (
            <div className="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowEnrollmentModal(false)}>
              <AnimatedSection className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
                <GlassCard className="p-8 border border-[var(--border2)] flex-1">
                  <div className="mb-6 flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text-1)]">KRS Kelas: {selectedCourse.name}</h2>
                      <p className="text-sm text-[var(--text-3)] font-mono">{selectedCourse.code} • Dosen: {selectedCourse.lecturer_name}</p>
                    </div>
                  </div>

                  {/* Toast Notifications for Enrollment Modal */}
                  <AnimatePresence>
                    {enrollmentSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }} 
                        className="p-3 mb-4 rounded-lg bg-[var(--green-bg)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] flex items-center gap-2 text-sm font-medium"
                      >
                        <CheckCircle2 size={16} /> {enrollmentSuccess}
                      </motion.div>
                    )}
                    {enrollmentError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }} 
                        className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm"
                      >
                        <AlertCircle size={16} className="mt-0.5" /> 
                        <div className="flex-1">
                          {enrollmentError}
                          <button 
                            onClick={retryFetchStudents} 
                            className="ml-3 underline hover:text-[var(--amber)] font-bold"
                            disabled={loadingEnrollment}
                          >
                            Coba Lagi
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && <div className="p-3 mb-4 rounded-lg bg-[var(--amber-bg)] text-[var(--amber)] border border-[rgba(245,158,11,0.3)] flex items-start gap-2 text-sm"><AlertCircle size={16} className="mt-0.5" /> {error}</div>}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* ENROLL FORM LAYER */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                      <div className="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border2)] flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                          <label className="input-label font-bold text-[var(--text-1)]">Tugaskan Mahasiswa</label>
                          {/* Manual Refresh Button */}
                          {!loadingEnrollment && (
                            <button 
                              onClick={retryFetchStudents}
                              className="btn btn-ghost btn-sm px-2 py-1 text-xs flex items-center gap-1 border border-[var(--border)]"
                              title="Refresh data mahasiswa"
                            >
                              <RefreshCw size={12} /> Refresh
                            </button>
                          )}
                        </div>
                        
                        {loadingEnrollment ? (
                          <div className="flex items-center justify-center h-[280px] text-[var(--text-3)]">
                            <div className="text-center">
                              <div className="animate-spin text-3xl mb-2">⏳</div>
                              <div className="text-sm font-medium">Memuat data mahasiswa...</div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <select
                              className="select-field input bg-[var(--bg)] border border-[var(--border)] custom-scrollbar text-sm font-medium h-[280px]"
                              multiple
                              value={selectedStudentIds.map(String)}
                              onChange={(e) => setSelectedStudentIds(Array.from(e.target.selectedOptions).map((opt) => Number(opt.value)))}
                            >
                              {availableStudents.length === 0 ? (
                                <option disabled className="p-2 text-[var(--text-3)] text-center">Semua mahasiswa telah masuk kelas ini</option>
                              ) : (
                                availableStudents.map((s) => (
                                  <option key={s.id} value={s.id} className="p-2 border-b border-[var(--border)] border-opacity-50 hover:bg-[var(--surface2)]">
                                    {s.nim} - {s.name}
                                  </option>
                                ))
                              )}
                            </select>
                            <div className="text-[10px] text-[var(--text-3)] font-medium uppercase tracking-wider py-2 italic text-center">Tahan CTRL / CMD untuk pilih lebih dari 1</div>
                          </>
                        )}

                        <button className="btn btn-primary w-full mt-auto py-2.5 shadow-lg shadow-[var(--accent)]/20" type="button" onClick={handleAssignStudents} disabled={selectedStudentIds.length === 0 || loadingEnrollment}>
                          + Tambah {selectedStudentIds.length > 0 ? selectedStudentIds.length : ''} ke Kelas
                        </button>
                      </div>
                    </div>

                    {/* ENROLLED TABLE */}
                    <div className="lg:col-span-7 flex flex-col h-full">
                      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden flex-1 flex flex-col">
                        <div className="px-4 py-3 bg-[var(--surface2)] border-b border-[var(--border)] font-bold text-sm flex justify-between items-center text-[var(--text-1)]">
                          <span>Daftar Peserta</span>
                          <span className="badge text-[10px] bg-[var(--green-bg)] text-[var(--green)] border-none">{enrolledStudents.length} Mahasiswa</span>
                        </div>
                        
                        <div className="overflow-y-auto custom-scrollbar flex-1 h-[256px]">
                          {enrolledStudents.length === 0 ? (
                            <div className="empty-state h-full flex items-center justify-center">Belum ada peserta</div>
                          ) : (
                            <table className="data-table">
                              <thead><tr><th>NIM & Nama</th><th className="text-right">Aksi</th></tr></thead>
                              <tbody>
                                {enrolledStudents.map((student) => (
                                  <tr key={student.student_id} className="hover:bg-[var(--surface2)]">
                                    <td>
                                      <div className="font-bold text-[var(--text-1)] text-sm">{student.nim}</div>
                                      <div className="text-xs font-medium text-[var(--text-2)]">{student.name}</div>
                                    </td>
                                    <td className="text-right">
                                      <button className="btn btn-ghost py-1 px-2 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleRemoveEnrollment(student.student_id)}>
                                        <UserMinus size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 mt-4 border-t border-[var(--border)]">
                    <button type="button" className="btn btn-ghost px-8 bg-[var(--surface2)] hover:bg-[var(--surface)] border-[var(--border)]" onClick={() => setShowEnrollmentModal(false)}>Selesai</button>
                  </div>
                </GlassCard>
              </AnimatedSection>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
