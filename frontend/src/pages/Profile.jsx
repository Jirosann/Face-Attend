import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AnimatedSection from '../components/AnimatedSection';
import GlassCard from '../components/GlassCard';
import { User, Camera, Lock, Save } from 'lucide-react';

function staticUrl(path) {
  if (!path) return null;
  const base = api.defaults.baseURL || '';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setErr('');
    try {
      const r = await api.get('/api/users/me');
      setProfile(r.data);
      setName(r.data.name || '');
      if (r.data.avatar_url) updateProfile({ avatar_url: r.data.avatar_url });
    } catch (e) {
      setErr(e.response?.data?.detail || 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const body = { name: name.trim() };
      if (newPassword) {
        body.new_password = newPassword;
        body.current_password = currentPassword;
      }
      await api.put('/api/users/me', body);
      setMsg('Perubahan disimpan.');
      updateProfile({ name: name.trim() });
      setNewPassword('');
      setCurrentPassword('');
      await load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post('/api/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = r.data?.avatar_url;
      if (url) updateProfile({ avatar_url: url });
      setMsg('Foto profil diperbarui.');
      await load();
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Gagal unggah foto');
    }
    e.target.value = '';
  };

  const avatarSrc = staticUrl(profile?.avatar_url || user?.avatar_url);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.05}>
          <h1 className="page-title">Profil</h1>
          <p className="page-sub">Kelola nama, foto, dan kata sandi akun Anda</p>
        </AnimatedSection>

        {loading ? (
          <div className="empty-state py-20">Memuat…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <AnimatedSection delay={0.1}>
              <GlassCard className="p-6">
                <h2 className="card-title mb-4 flex items-center gap-2">
                  <User size={18} /> Informasi akun
                </h2>
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="relative shrink-0">
                    <div className="w-28 h-28 rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--surface2)] flex items-center justify-center text-3xl font-bold text-[var(--text-2)]">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (name || user?.name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <label className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--accent)] cursor-pointer hover:underline">
                      <Camera size={16} />
                      Unggah foto
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatar} />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2 text-sm">
                    <p>
                      <span className="text-[var(--text-3)]">Email</span>
                      <br />
                      <span className="font-medium text-[var(--text-1)]">{profile?.email}</span>
                    </p>
                    <p>
                      <span className="text-[var(--text-3)]">Peran</span>
                      <br />
                      <span className="font-medium capitalize">{profile?.role}</span>
                    </p>
                    {profile?.student && (
                      <p>
                        <span className="text-[var(--text-3)]">NIM</span>
                        <br />
                        <span className="font-medium">{profile.student.nim}</span>
                      </p>
                    )}
                  </div>
                </div>
              </GlassCard>
            </AnimatedSection>

            <AnimatedSection delay={0.15}>
              <GlassCard className="p-6">
                <h2 className="card-title mb-4 flex items-center gap-2">
                  <Lock size={18} /> Ubah nama & kata sandi
                </h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="input-label" htmlFor="p-name">Nama tampilan</label>
                    <input
                      id="p-name"
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--text-3)] mb-3">Isi hanya jika ingin ganti kata sandi</p>
                    <div className="space-y-3">
                      <div>
                        <label className="input-label" htmlFor="p-cur">Kata sandi saat ini</label>
                        <input
                          id="p-cur"
                          type="password"
                          className="input"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                      </div>
                      <div>
                        <label className="input-label" htmlFor="p-new">Kata sandi baru</label>
                        <input
                          id="p-new"
                          type="password"
                          className="input"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          minLength={6}
                        />
                      </div>
                    </div>
                  </div>
                  {err && <p className="text-sm text-[var(--red)]">{err}</p>}
                  {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
                  <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto">
                    <Save size={18} /> {saving ? 'Menyimpan…' : 'Simpan perubahan'}
                  </button>
                </form>
              </GlassCard>
            </AnimatedSection>
          </div>
        )}
      </div>
    </div>
  );
}
