import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Calendar, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/mahasiswa', icon: LayoutDashboard },
    { name: 'Jadwal Saya', path: '/mahasiswa/schedule', icon: Calendar },
    { name: 'Riwayat Absensi', path: '/mahasiswa/absensi', icon: Clock },
  ];

  return (
    <motion.nav 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 bg-white border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-12">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">C</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-black">Courselo.</span>
            </div>
            
            <div className="hidden md:flex space-x-8">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-center gap-2 group relative py-2"
                  >
                    <span className={`text-[15px] font-medium transition-colors ${isActive ? 'text-black' : 'text-gray-500 hover:text-black'}`}>
                      {link.name}
                    </span>
                    {isActive && (
                      <motion.div 
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-black">{user?.name}</div>
              <div className="text-xs text-gray-500">{user?.nim || 'Mahasiswa'}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-transparent text-black border border-black hover:bg-black hover:text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300"
            >
              Sign Out
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
