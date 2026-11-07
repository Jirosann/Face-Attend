import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Filter, RefreshCw, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { clsx } from 'clsx';

export default function MahasiswaAttendance() {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  useEffect(() => {
    api.get('/api/attendance/my')
      .then(r => setAttendances(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const courses = [...new Set(attendances.map(a => a.course_name).filter(Boolean))];
  const filtered = attendances.filter(a => {
    const matchDate = filterDate
      ? (() => {
          const checkIn = new Date(a.check_in_time);
          const filter = new Date(filterDate);
          return (
            checkIn.getFullYear() === filter.getFullYear() &&
            checkIn.getMonth() === filter.getMonth() &&
            checkIn.getDate() === filter.getDate()
          );
        })()
      : true;
    return matchDate && (filterCourse ? a.course_name === filterCourse : true);
  });
  const totalHadir = filtered.filter(a => a.status === 'hadir').length;
  const totalTerlambat = filtered.filter(a => a.status === 'terlambat').length;

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Riwayat Absensi</h1>
            <p className="page-sub">Pantau catatan kehadiran Anda untuk semua instansi kelolosan</p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--green)]">
              <div className="w-12 h-12 rounded-full bg-[var(--green-bg)] text-[var(--green)] flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Total Hadir</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{totalHadir}</div>
              </div>
            </GlassCard>

            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--amber)]">
              <div className="w-12 h-12 rounded-full bg-[var(--amber-bg)] text-[var(--amber)] flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Terlambat</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{totalTerlambat}</div>
              </div>
            </GlassCard>

            <GlassCard hover className="flex items-center gap-5 p-5 border-l-4 border-l-[var(--blue)]">
              <div className="w-12 h-12 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center">
                <Search size={24} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Total Entri</div>
                <div className="text-3xl font-bold text-[var(--text-1)]">{filtered.length}</div>
              </div>
            </GlassCard>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <GlassCard className="mb-6 bg-[var(--surface2)] border-[var(--border2)] p-5">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="w-full md:flex-1">
                <label className="input-label flex items-center gap-2"><Filter size={14} /> Filter Mata Kuliah</label>
                <select className="select-field" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
                  <option value="">Semua Mata Kuliah</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-full md:flex-1">
                <label className="input-label">Filter Tanggal</label>
                <input type="date" className="input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              {(filterDate || filterCourse) && (
                <button 
                  className="btn btn-ghost shrink-0 h-[46px] w-full md:w-auto" 
                  onClick={() => { setFilterDate(''); setFilterCourse(''); }}
                >
                  <RefreshCw size={16} /> Reset Filter
                </button>
              )}
            </div>
          </GlassCard>
        </AnimatedSection>

        <AnimatedSection delay={0.4}>
          <GlassCard className="p-0 overflow-hidden">
            {loading ? <div className="empty-state py-20">Memuat data absensi...</div>
            : filtered.length === 0 ? <div className="empty-state py-20 border-t border-[var(--border)]">Tidak ada log absensi ditemukan pada filter ini</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>Mata Kuliah</th>
                      <th>Jadwal</th>
                      <th>Waktu Tap-In</th>
                      <th>Status Absensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a, i) => (
                      <tr key={a.id} className="group transition-colors hover:bg-[var(--surface2)]">
                        <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                        <td className="font-bold text-[var(--text-1)]">{a.course_name || '—'}</td>
                        <td className="text-[13px] font-medium text-[var(--text-2)]">{a.schedule || '—'}</td>
                        <td className="text-[13px] font-medium text-[var(--text-2)]">
                          {new Date(a.check_in_time).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                        </td>
                        <td>
                          <span className={clsx("badge", a.status === 'hadir' ? 'badge-green' : 'badge-amber')}>
                            {a.status === 'hadir' ? 'Hadir Tepat Waktu' : 'Terlambat'}
                          </span>
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
