import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { BookOpen, CheckCircle2, TrendingUp, Clock, AlertTriangle, CalendarDays, BellRing } from 'lucide-react';
import { clsx } from 'clsx';

export default function MahasiswaDashboard() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [openSessions, setOpenSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/attendance/my'), api.get('/api/schedules/student/my')])
      .then(([attendanceRes, scheduleRes]) => {
        setAttendances(attendanceRes.data || []);
        setSchedules(scheduleRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchOpen = () => {
      api
        .get('/api/attendance/live/open-for-me')
        .then((r) => setOpenSessions(r.data || []))
        .catch(() => setOpenSessions([]));
    };
    fetchOpen();
    const t = setInterval(fetchOpen, 25000);
    return () => clearInterval(t);
  }, []);

  const totalHadir = attendances.filter(a => a.status === 'hadir').length;
  const totalTerlambat = attendances.filter(a => a.status === 'terlambat').length;
  const courses = [...new Set(schedules.map(s => s.course_name).filter(Boolean))];

  const courseStats = courses.map(course => {
    const ca = attendances.filter(a => a.course_name === course);
    const hadir = ca.filter(a => a.status === 'hadir').length;
    const pct = ca.length > 0 ? Math.round((hadir / ca.length) * 100) : 0;
    return { course, total: ca.length, hadir, pct };
  });

  const avg = courseStats.length > 0
    ? Math.round(courseStats.reduce((acc, c) => acc + c.pct, 0) / courseStats.length) : 0;

  const getBadge = (pct) => pct >= 80 ? { cls: 'badge-green', label: 'Aman' }
    : pct >= 60 ? { cls: 'badge-amber', label: 'Perhatian' }
    : { cls: 'badge-red', label: 'Bahaya' };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h1 className="page-title">Halo, {user?.name} 👋</h1>
            <p className="page-sub">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </AnimatedSection>

        {openSessions.length > 0 && (
          <AnimatedSection delay={0.12}>
            <div className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-bg)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm">
                <BellRing size={20} className="shrink-0" />
                Sesi absensi sedang dibuka
              </div>
              <ul className="text-sm text-[var(--text-2)] flex flex-wrap gap-x-4 gap-y-1">
                {openSessions.map((s) => (
                  <li key={s.session_id}>
                    <span className="font-medium text-[var(--text-1)]">{s.course_name || s.course_code}</span>
                    {s.schedule_label ? ` · ${s.schedule_label}` : ''}
                    {s.room ? ` · ${s.room}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.2}>
          <div className="stat-grid">
            <GlassCard hover className="flex flex-col border-[var(--blue-bg)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div>
                  <div className="stat-label mb-0">Mata Kuliah</div>
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
                  <div className="stat-label mb-0">Total Kehadiran</div>
                  <div className="stat-value text-3xl">{totalHadir + totalTerlambat}</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard hover className="flex flex-col border-[var(--accent-bg)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-label mb-0">Rata-rata Kehadiran</div>
                  <div className="stat-value text-3xl">{avg}%</div>
                </div>
              </div>
            </GlassCard>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Takes 2/3 space */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatedSection delay={0.3}>
              <GlassCard className="p-0">
                <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center gap-3">
                  <Clock className="text-[var(--text-3)]" size={18} />
                  <span className="card-title">Absensi Terbaru</span>
                </div>
                <div className="p-6">
                  {loading ? <div className="empty-state py-8">Memuat data...</div>
                  : attendances.length === 0 ? <div className="empty-state py-8">Belum ada data absensi</div>
                  : (
                    <div className="table-wrap overflow-hidden custom-scrollbar">
                      <table className="data-table">
                        <thead><tr><th>Mata Kuliah</th><th>Jadwal</th><th>Waktu</th><th>Status</th></tr></thead>
                        <tbody>
                          {attendances.slice(0, 5).map(a => (
                            <tr key={a.id}>
                              <td className="font-semibold text-[var(--text-1)]">{a.course_name || '—'}</td>
                              <td>{a.schedule || '—'}</td>
                              <td>{new Date(a.check_in_time).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
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
              <GlassCard className="p-0">
                <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center gap-3">
                  <CalendarDays className="text-[var(--text-3)]" size={18} />
                  <span className="card-title">Jadwal Kelas yang Akan Datang</span>
                </div>
                <div className="p-6">
                  {loading ? <div className="empty-state py-8">Memuat data...</div>
                  : schedules.length === 0 ? <div className="empty-state py-8">Belum ada jadwal yang diassign</div>
                  : (
                    <div className="table-wrap overflow-hidden custom-scrollbar">
                      <table className="data-table">
                        <thead><tr><th>Mata Kuliah</th><th>Jadwal Reguler</th><th>Tanggal Terdekat</th><th>Status</th></tr></thead>
                        <tbody>
                          {schedules.slice(0, 5).map(s => (
                            <tr key={s.id}>
                              <td className="font-semibold text-[var(--text-1)]">{s.course_name || '—'}</td>
                              <td>{s.day} {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)} • {s.room}</td>
                              <td>{new Date(s.upcoming_regular_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</td>
                              <td>
                                {s.overrides?.length ? (
                                  <span className="badge badge-amber flex items-center gap-1 w-max">
                                    <AlertTriangle size={12} /> Diganti
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-3)] text-xs font-semibold uppercase tracking-wider">Reguler</span>
                                )}
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
          </div>

          {/* Right Column - Takes 1/3 space */}
          <div className="lg:col-span-1 space-y-6">
            {courseStats.length > 0 && (
              <AnimatedSection delay={0.5}>
                <GlassCard className="p-0">
                  <div className="card-header border-b border-[var(--border)] px-6 py-4">
                    <span className="card-title">Kehadiran per Mata Kuliah</span>
                  </div>
                  <div className="p-6 flex flex-col gap-6">
                    {courseStats.map((c, i) => {
                      const badge = getBadge(c.pct);
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[13px] font-semibold text-[var(--text-1)] truncate pr-2">{c.course}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-[var(--text-3)] font-medium">{c.hadir}/{c.total}</span>
                              <span className={`badge ${badge.cls} py-0.5 px-2`}>{badge.label}</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--surface2)] rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={clsx(
                                "h-full rounded-full transition-all duration-1000",
                                c.pct >= 80 ? "bg-[var(--green)]" : c.pct >= 60 ? "bg-[var(--amber)]" : "bg-[var(--red)]"
                              )} 
                              style={{ width: `${c.pct}%` }} 
                            />
                          </div>
                          <div className="text-[11px] text-[var(--text-3)] mt-2 font-bold text-right">{c.pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              </AnimatedSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
