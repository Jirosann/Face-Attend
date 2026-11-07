import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { ShieldCheck, UserCog, ShieldAlert, CheckCircle2, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    try { const r = await api.get('/api/users/all'); setUsers(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleResetPassword = async (userId, displayName) => {
    const pw = window.prompt(`Kata sandi baru untuk ${displayName} (min. 6 karakter):`);
    if (!pw || pw.length < 6) {
      if (pw != null) alert('Minimal 6 karakter');
      return;
    }
    try {
      await api.put(`/api/users/${userId}/password`, { new_password: pw });
      setSuccess('Kata sandi berhasil diatur ulang.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || 'Gagal reset password');
    }
  };

  const handleRoleChange = async (userId, currentRole, newRole) => {
    if (newRole === currentRole) return; // no change
    if (!confirm(`Konfirmasi permanen ubah otorisasi user ini menjadi ${newRole.toUpperCase()}?`)) return;
    try {
      await api.put(`/api/users/role/${userId}`, { role: newRole });
      setSuccess('Otorisasi Role berhasil diperbarui!');
      fetchUsers(); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { console.error(e); alert('Error saat update role'); }
  };

  const badgeProps = (role) => {
    if (role === 'admin') return { cls: 'badge-purple border-purple-500/30', label: 'Administrator', icon: ShieldAlert };
    if (role === 'dosen') return { cls: 'badge-blue border-blue-500/30', label: 'Dosen Pengajar', icon: UserCog };
    return { cls: 'badge-green border-green-500/30', label: 'Mahasiswa', icon: ShieldCheck };
  };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="mb-8">
          <h1 className="page-title">Sistem Otorisasi Role</h1>
          <p className="page-sub">Mutasi dan audit eskalasi hak akses pengguna platform</p>
        </AnimatedSection>

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 mb-6 rounded-xl bg-[var(--green-bg)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] flex items-center gap-2 font-medium">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatedSection delay={0.2}>
          <GlassCard className="p-0 overflow-hidden border-[var(--purple-bg)]">
            <div className="card-header border-b border-[var(--border)] px-6 py-4 flex items-center justify-between bg-[var(--surface2)]">
              <div className="flex items-center gap-2 text-[var(--text-1)] font-bold text-sm uppercase tracking-wider">
                <ShieldAlert size={16} className="text-[var(--text-3)]" /> DAFTAR OTORISASI USER
              </div>
              <span className="badge border border-[var(--border2)]">{users.length} Akun</span>
            </div>

            {loading ? <div className="empty-state py-20">Analisa matriks user...</div>
            : users.length === 0 ? <div className="empty-state py-20">Fatal Error: Database kosong</div>
            : (
              <div className="table-wrap border-none rounded-none w-full custom-scrollbar">
                <table className="data-table">
                  <thead><tr><th className="w-12 text-center">#</th><th>Crendentials SSO</th><th>Role Aktif Berjalan</th><th className="text-center">Password</th><th className="text-right">Mutasi Role</th></tr></thead>
                  <tbody>
                    {users.map((u, i) => {
                      const badge = badgeProps(u.role);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={u.id} className="hover:bg-[var(--surface2)] group transition-colors">
                          <td className="text-center font-medium text-[var(--text-3)]">{i + 1}</td>
                          <td>
                            <div className="font-bold text-[var(--text-1)] mb-1 text-[13px]">{u.name}</div>
                            <div className="text-xs font-mono text-[var(--text-3)] opacity-80">{u.email}</div>
                          </td>
                          <td>
                            <span className={`badge border ${badge.cls} flex items-center gap-1.5 w-max font-bold tracking-wider text-[10px] uppercase`}>
                              <BadgeIcon size={12} /> {badge.label}
                            </span>
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => handleResetPassword(u.id, u.name)}
                              className="btn btn-ghost btn-sm text-xs gap-1 mx-auto"
                              title="Reset kata sandi"
                            >
                              <KeyRound size={14} /> Reset
                            </button>
                          </td>
                          <td className="text-right">
                            <select
                              value={u.role}
                              onChange={e => handleRoleChange(u.id, u.role, e.target.value)}
                              className="select-field border-[var(--border)] bg-[var(--bg)] w-auto min-w-[140px] text-xs font-bold float-right py-2 cursor-pointer focus:border-[var(--purple)] focus:ring-[var(--purple)]"
                            >
                                <option value="admin">➔ Administrator</option>
                                <option value="dosen">➔ Dosen Pengajar</option>
                                <option value="mahasiswa">➔ Mahasiswa Sisfo</option>
                            </select>
                          </td>
                        </tr>
                    )})}
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
