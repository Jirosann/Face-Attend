import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { BookOpen, CheckCircle2, Clock, Users, CalendarDays } from 'lucide-react';
import { clsx } from 'clsx';

export default function DosenDashboard() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/attendance/dosen'), api.get('/api/schedules/my')])
      .then(([attendanceRes, scheduleRes]) => {
        setAttendances(attendanceRes.data || []);
        setSchedules(scheduleRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalHadir = attendances.filter(a => a.status === 'hadir').length;
  const totalTerlambat = attendances.filter(a => a.status === 'terlambat').length;
  const courses = [...new Set(schedules.map(s => s.course_name).filter(Boolean))];

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h1 className="page-title">Selamat datang, {user?.name}</h1>
            <p className="page-sub">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="stat-grid">
            <GlassCard hover className="flex flex-col border-[var(--blue-bg)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div>
                  <div className="stat-label mb-0">Mata Kuliah Diajar</div>
                  <div className="stat-value text-3xl">{courses.length}</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard hover className="flex flex-col border-[var(--green-bg)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--green-bg)] text-[var(--green)] flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div className="stat-label mb-0">Mahasiswa Hadir</div>
                  <div className="stat-value text-3xl">{totalHadir}</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard hover className="flex flex-col border-[var(--amber-bg)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--amber-bg)] text-[var(--amber)] flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="stat-label mb-0">Mahasiswa Terlambat</div>
                  <div className="stat-value text-3xl">{totalTerlambat}</div>
                </div>
              </div>
            </GlassCard>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatedSection delay={0.3}>
            <GlassCard className="p-0 h-full flex flex-col">
              <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center gap-3">
                <Users className="text-[var(--text-3)]" size={18} />
                <span className="card-title">Absensi Mahasiswa Terbaru</span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                {loading ? <div className="empty-state py-8 my-auto">Memuat data...</div>
                : attendances.length === 0 ? <div className="empty-state py-8 my-auto">Belum ada data absensi</div>
                : (
                  <div className="table-wrap overflow-hidden custom-scrollbar">
                    <table className="data-table">
                      <thead><tr><th>NIM</th><th>Nama</th><th>Mata Kuliah</th><th>Waktu</th><th>Status</th></tr></thead>
                      <tbody>
                        {attendances.slice(0, 8).map(a => (
                          <tr key={a.id}>
                            <td className="font-semibold text-[var(--text-1)]">{a.student_nim}</td>
                            <td className="max-w-[150px] truncate">{a.student_name}</td>
                            <td className="max-w-[120px] truncate">{a.course_name || '—'}</td>
                            <td className="text-[11px] whitespace-nowrap text-[var(--text-2)]">{new Date(a.check_in_time).toLocaleString('id-ID')}</td>
                            <td>
                              <span className={clsx("badge", a.status === 'hadir' ? 'badge-green' : 'badge-amber')}>
                                {a.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </GlassCard>
          </AnimatedSection>

          <AnimatedSection delay={0.4}>
            <GlassCard className="p-0 h-full flex flex-col">
              <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center gap-3">
                <CalendarDays className="text-[var(--text-3)]" size={18} />
                <span className="card-title">Jadwal Mengajar Anda</span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                {loading ? <div className="empty-state py-8 my-auto">Memuat data...</div>
                : schedules.length === 0 ? <div className="empty-state py-8 my-auto">Belum ada jadwal terhubung ke Anda</div>
                : (
                  <div className="table-wrap overflow-hidden custom-scrollbar">
                    <table className="data-table">
                      <thead><tr><th>Mata Kuliah</th><th>Hari</th><th>Jam</th><th>Ruangan</th></tr></thead>
                      <tbody>
                        {schedules.slice(0, 8).map(s => (
                          <tr key={s.id}>
                            <td className="font-semibold text-[var(--text-1)]">{s.course_name || '—'}</td>
                            <td>{s.day}</td>
                            <td className="text-[13px] font-medium text-[var(--text-2)] whitespace-nowrap">{s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}</td>
                            <td><span className="badge bg-[var(--surface2)] text-[var(--text-1)] border border-[var(--border2)]">{s.room}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </GlassCard>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
