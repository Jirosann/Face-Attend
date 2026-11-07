import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Users, UserSquare2, BookOpen, CheckCircle2, History } from 'lucide-react';
import { clsx } from 'clsx';

function StatCard({ label, value, icon: Icon, colorClass, bgClass, delay }) {
  return (
    <AnimatedSection delay={delay}>
      <GlassCard hover className={clsx("flex flex-col border-t-4", colorClass.replace('text-', 'border-'))}>
        <div className="flex items-center gap-4 mb-3">
          <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center", bgClass, colorClass)}>
            <Icon size={24} />
          </div>
          <div>
            <div className="stat-label mb-0 uppercase tracking-widest text-[10px] text-[var(--text-3)] font-bold">{label}</div>
            <div className="stat-value text-3xl font-bold text-[var(--text-1)]">{value}</div>
          </div>
        </div>
      </GlassCard>
    </AnimatedSection>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total_students: 0, total_lecturers: 0, total_courses: 0, today_attendance: 0 });
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/attendance/stats'), api.get('/api/attendance/all')])
      .then(([s, a]) => { setStats(s.data); setAttendances(a.data.slice(0, 10)); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h1 className="page-title">Dashboard Administrator</h1>
            <p className="page-sub">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </AnimatedSection>

        <div className="stat-grid mb-8">
          <StatCard delay={0.2} label="Total Mahasiswa" value={stats.total_students} icon={Users} colorClass="text-[var(--blue)]" bgClass="bg-[var(--blue-bg)]" />
          <StatCard delay={0.3} label="Total Dosen" value={stats.total_lecturers} icon={UserSquare2} colorClass="text-[var(--accent)]" bgClass="bg-[var(--accent-bg)]" />
          <StatCard delay={0.4} label="Mata Kuliah" value={stats.total_courses} icon={BookOpen} colorClass="text-[var(--amber)]" bgClass="bg-[var(--amber-bg)]" />
          <StatCard delay={0.5} label="Terabsen Hari Ini" value={stats.today_attendance} icon={CheckCircle2} colorClass="text-[var(--green)]" bgClass="bg-[var(--green-bg)]" />
        </div>

        <AnimatedSection delay={0.6}>
          <GlassCard className="p-0 border-[var(--border)] overflow-hidden">
            <div className="card-header border-b border-[var(--border)] px-6 py-4 flex justify-between items-center bg-[var(--surface2)]">
              <div className="flex items-center gap-2">
                <History className="text-[var(--text-3)]" size={18} />
                <span className="card-title font-bold text-[13px] tracking-wide uppercase">Absensi Skala Kampus Terbaru</span>
              </div>
              <span className="badge border border-[var(--border2)] text-[var(--text-2)]">{attendances.length} entri maping</span>
            </div>
            
            {loading ? (
              <div className="empty-state py-20">Memuat data log kampus...</div>
            ) : attendances.length === 0 ? (
              <div className="empty-state py-20">Belum ada aktivitas absensi tercatat hari ini</div>
            ) : (
              <div className="table-wrap custom-scrollbar w-full border-none rounded-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-32">NIM</th>
                      <th>Nama Lengkap</th>
                      <th>Mata Kuliah / Sesi</th>
                      <th className="w-48">Waktu Identifikasi</th>
                      <th className="w-32 text-center">Status Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((a) => (
                      <tr key={a.id} className="hover:bg-[var(--surface2)] transition-colors group">
                        <td className="font-bold text-[var(--text-1)] tracking-widest text-xs uppercase">{a.student_nim}</td>
                        <td className="font-medium">{a.student_name}</td>
                        <td className="text-xs font-semibold text-[var(--text-2)] max-w-[200px] truncate">{a.course_name || '—'}</td>
                        <td className="text-[11px] font-mono text-[var(--text-3)] font-medium tracking-wide">{new Date(a.check_in_time).toLocaleString('id-ID')}</td>
                        <td className="text-center">
                          <span className={clsx("badge capitalize border text-[10px]", a.status === 'hadir' ? 'badge-green border-[rgba(34,197,94,0.3)]' : 'badge-amber border-[rgba(245,158,11,0.3)]')}>
                            {a.status === 'hadir' ? 'Hadir' : 'Telat'}
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
