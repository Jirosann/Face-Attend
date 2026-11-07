import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function MahasiswaAbsensi() {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/attendance/my')
      .then((res) => setAttendances(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 28 }}>
          <p className="page-title">Riwayat Absensi</p>
          <p className="page-sub">Log kehadiran kelas yang direkam oleh sistem pengenalan wajah</p>
        </div>

        {loading ? (
          <div className="empty-state">Memuat riwayat absensi...</div>
        ) : attendances.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <Clock size={40} style={{ color: 'var(--text-3)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>Belum Ada Riwayat</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>Anda belum tercatat mengikuti sesi kelas manapun pada semester ini.</div>
          </div>
        ) : (
          <div style={{ position: 'relative', maxWidth: 800 }}>
            {/* Timeline Line */}
            <div style={{ position: 'absolute', left: 24, top: 20, bottom: 20, width: 2, background: 'var(--border2)' }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {attendances.map((item, index) => {
                const isHadir = item.status === 'hadir';
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    viewport={{ once: true }}
                    key={item.id} 
                    style={{ display: 'flex', gap: 24, position: 'relative' }}
                  >
                    {/* Icon indicator */}
                    <div style={{ position: 'relative', zIndex: 10, width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ 
                        width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isHadir ? 'var(--green-bg)' : 'var(--amber-bg)', color: isHadir ? 'var(--green)' : 'var(--amber)',
                        border: '4px solid var(--bg)'
                      }}>
                        {isHadir ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="card" style={{ flex: 1, padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>{item.course_name || 'Tidak diketahui'}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{item.schedule || 'Jadwal reguler'}</div>
                        </div>
                        <div className={`badge ${isHadir ? 'badge-green' : 'badge-amber'}`}>
                          {item.status.toUpperCase()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                          <CalendarIcon size={14} /> {format(new Date(item.check_in_time), 'dd MMM yyyy')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                          <Clock size={14} /> {format(new Date(item.check_in_time), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
