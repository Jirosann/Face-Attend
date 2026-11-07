import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle';
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();

  // Jika user sudah login dan mengakses /login, clear session lama
  // agar bisa login ulang dengan akun berbeda
  useEffect(() => {
    if (user) {
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/login', {
        email: email.trim(),
        password,
      });
      login(res.data);
      if (res.data.role === 'admin') navigate('/admin/dashboard');
      else if (res.data.role === 'dosen') navigate('/dosen/dashboard');
      else navigate('/mahasiswa/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Email atau kata sandi salah. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="min-h-[100dvh] w-full flex flex-col md:flex-row bg-gradient-to-br from-slate-100 via-[#eef1f6] to-slate-200 text-slate-900">
      {/* Kiri: kartu login */}
      <section className="relative flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 md:w-[46%] md:max-w-none lg:w-[42%] lg:px-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute -right-10 bottom-10 h-48 w-48 rounded-full bg-slate-400/15 blur-3xl" />
        </div>

        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle className="rounded-full border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg shadow-slate-900/25">
              F
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">FaceAttend</p>
              <p className="text-lg font-bold tracking-tight text-slate-900">Absensi cerdas</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.15)] ring-1 ring-slate-900/5 backdrop-blur-md sm:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Masuk</h1>
                <p className="mt-1.5 text-sm text-slate-500">Gunakan akun institusi Anda untuk melanjutkan.</p>
              </div>
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:flex">
                <Sparkles className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              method="post"
              action="#"
              autoComplete="on"
            >
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <input
                    id="login-email"
                    name="username"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@kampus.ac.id"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
                  Kata sandi
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <input
                    id="login-password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`${inputClass} pr-11 tracking-wide`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2.5 select-none">
                  <input
                    type="checkbox"
                    id="remember"
                    name="remember"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-600">Ingat saya</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
                >
                  Lupa kata sandi?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-black disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? 'Memproses…' : 'Masuk'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Belum punya akun?{' '}
              <span className="font-semibold text-slate-800">Hubungi administrator</span>
            </p>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span className="bg-white/90 px-3">atau lanjutkan dengan</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              {[
                { label: 'Google', el: <GoogleIcon /> },
                { label: 'GitHub', el: <GithubIcon /> },
                { label: 'Facebook', el: <FacebookIcon /> },
              ].map(({ label, el }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  {el}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            Dengan masuk, Anda menyetujui kebijakan privasi institusi.
          </p>
        </div>
      </section>

      {/* Kanan: hero */}
      <section className="relative hidden min-h-[100dvh] flex-1 md:flex md:p-5 lg:p-7">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl ring-1 ring-white/10">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.35),transparent)]" />
            <div className="absolute -right-1/4 top-0 h-[120%] w-[120%] rotate-[-18deg] border-t border-white/[0.07]" />
            <div className="absolute bottom-[15%] left-[-10%] h-px w-[70%] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            <div className="absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-white/20 blur-[1px]" />
          </div>

          <div className="relative z-10 flex flex-1 flex-col px-10 pb-12 pt-14 lg:px-16 lg:pb-16 lg:pt-20">
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <div className="relative mb-2">
                <div className="absolute inset-0 scale-110 rounded-[2rem] bg-emerald-500/20 blur-3xl" />
                <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] bg-gradient-to-br from-slate-700 to-slate-900 shadow-2xl ring-1 ring-white/10 lg:h-44 lg:w-44">
                  <span className="text-6xl font-black text-white/95 lg:text-7xl">F</span>
                </div>
              </div>
              <p className="mt-6 text-sm font-semibold tracking-wide text-emerald-400/90">FaceAttend</p>
              <h2 className="mt-2 max-w-lg text-center text-3xl font-bold tracking-tight text-white lg:text-4xl">
                Absensi kelas, tanpa antre
              </h2>
              <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-slate-400 lg:text-base">
                Satu kamera untuk seluruh kelas. Pengenalan wajah terintegrasi dengan jadwal dan riwayat kehadiran.
              </p>
            </div>

            <div className="relative mt-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <p className="text-lg font-semibold leading-snug text-white">
                Fokus mengajar — sistem yang mencatat kehadiran.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Dashboard untuk admin, dosen, dan mahasiswa dalam satu alur yang rapi.
              </p>
              <div className="mt-6 flex -space-x-2">
                {['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-slate-600'].map((bg, i) => (
                  <div
                    key={i}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-950 text-[10px] font-bold text-white ${bg}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-700 text-[10px] font-bold text-white">
                  +2k
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
