import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { LogOut, LayoutDashboard, Users, UserCog, BookOpen, Calendar, ClipboardCheck, Settings, CheckCircle2, UserCircle } from 'lucide-react';
import api from '../utils/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const adminMenus = [
  { label: 'Profil',       path: '/profile',           icon: UserCircle },
  { label: 'Dashboard',   path: '/admin/dashboard',  icon: LayoutDashboard },
  { label: 'Mahasiswa',   path: '/admin/mahasiswa',   icon: Users },
  { label: 'Dosen',       path: '/admin/dosen',       icon: UserCog },
  { label: 'Mata Kuliah', path: '/admin/courses',     icon: BookOpen },
  { label: 'Jadwal',      path: '/admin/schedules',   icon: Calendar },
  { label: 'Sesi Kelas',  path: '/dosen/attendance',  icon: CheckCircle2 },
  { label: 'Absensi',     path: '/admin/attendance',  icon: ClipboardCheck },
  { label: 'Users & Role',path: '/admin/users',       icon: Settings },
];
const dosenMenus = [
  { label: 'Profil',       path: '/profile',           icon: UserCircle },
  { label: 'Dashboard',   path: '/dosen/dashboard',   icon: LayoutDashboard },
  { label: 'Absensi',     path: '/dosen/attendance',  icon: ClipboardCheck },
  
];
const mahasiswaMenus = [
  { label: 'Profil',         path: '/profile',             icon: UserCircle },
  { label: 'Dashboard',      path: '/mahasiswa/dashboard', icon: LayoutDashboard },
  { label: 'Jadwal Saya',    path: '/mahasiswa/schedule',  icon: Calendar },
  { label: 'Riwayat Absensi',path: '/mahasiswa/attendance',icon: ClipboardCheck },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menus = user?.role === 'admin' ? adminMenus
    : user?.role === 'dosen' ? dosenMenus
    : mahasiswaMenus;

  const roleLabel = user?.role === 'admin' ? 'Administrator'
    : user?.role === 'dosen' ? 'Dosen' : 'Mahasiswa';

  return (
    <div className="w-[260px] min-h-screen shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-colors duration-300 relative z-10">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center text-[var(--accent)] border border-[var(--border2)]">
            ◈
          </div>
          <div>
            <div className="text-base font-bold text-[var(--text-1)] tracking-tight">FaceAttend</div>
            <div className="text-xs text-[var(--text-3)] font-medium">Binus University</div>
          </div>
        </div>
        <ThemeToggle className="scale-90" />
      </div>
      
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border2)] to-transparent mx-6 mb-4 opacity-50" />
      
      <nav className="flex-1 px-4 flex flex-col gap-1 overflow-y-auto">
        <div className="text-[11px] font-bold text-[var(--text-3)] tracking-wider uppercase px-4 pb-2 pt-4">Menu Utama</div>
        
        {menus.map((menu) => {
          const active = location.pathname === menu.path;
          const Icon = menu.icon;
          return (
            <button
              key={menu.path}
              onClick={() => navigate(menu.path)}
              className={twMerge(
                clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none w-full text-left",
                  active 
                    ? "bg-[var(--accent-bg)] text-[var(--accent)] shadow-[0_2px_10px_rgba(0,0,0,0.02)]" 
                    : "text-[var(--text-2)] hover:bg-[var(--surface2)] hover:text-[var(--text-1)]"
                )
              )}
            >
              <Icon size={18} className={clsx("shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-3)]")} />
              <span>{menu.label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
            </button>
          );
        })}
      </nav>

      <div className="p-5">
        <div className="bg-[var(--surface2)] rounded-xl p-3 border border-[var(--border2)] mb-3 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--text-1)] flex items-center justify-center text-sm font-bold border border-[var(--border2)] overflow-hidden shrink-0">
            {user?.avatar_url ? (
              <img
                src={`${api.defaults.baseURL?.replace(/\/$/, '') || ''}${user.avatar_url}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--text-1)] truncate">{user?.name}</div>
            <div className="text-xs text-[var(--text-3)] truncate">{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-semibold text-red-500 bg-[var(--red-bg)] hover:bg-red-500/20 transition-colors border border-red-500/10 outline-none"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </div>
  );
}
