import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Auth/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminMahasiswa from './pages/Admin/Mahasiswa';
import AdminDosen from './pages/Admin/Dosen';
import AdminCourses from './pages/Admin/Courses';
import AdminSchedules from './pages/Admin/Schedules';
import AdminAttendance from './pages/Admin/Attendance';
import AdminUsers from './pages/Admin/Users';
import DosenDashboard from './pages/Dosen/Dashboard';
import DosenAttendance from './pages/Dosen/Attendance';
import MahasiswaDashboard from './pages/Mahasiswa/Dashboard';
import MahasiswaSchedule from './pages/Mahasiswa/Schedule';
import MahasiswaAttendance from './pages/Mahasiswa/Attendance';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/mahasiswa" element={<PrivateRoute roles={['admin']}><AdminMahasiswa /></PrivateRoute>} />
          <Route path="/admin/dosen" element={<PrivateRoute roles={['admin']}><AdminDosen /></PrivateRoute>} />
          <Route path="/admin/courses" element={<PrivateRoute roles={['admin']}><AdminCourses /></PrivateRoute>} />
          <Route path="/admin/schedules" element={<PrivateRoute roles={['admin']}><AdminSchedules /></PrivateRoute>} />
          <Route path="/admin/attendance" element={<PrivateRoute roles={['admin']}><AdminAttendance /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AdminUsers /></PrivateRoute>} />

          {/* Dosen */}
          <Route path="/dosen/dashboard" element={<PrivateRoute roles={['dosen', 'admin']}><DosenDashboard /></PrivateRoute>} />
          <Route path="/dosen/attendance" element={<PrivateRoute roles={['dosen', 'admin']}><DosenAttendance /></PrivateRoute>} />

          {/* Mahasiswa */}
          <Route path="/mahasiswa/dashboard" element={<PrivateRoute roles={['mahasiswa']}><MahasiswaDashboard /></PrivateRoute>} />
          <Route path="/mahasiswa/schedule" element={<PrivateRoute roles={['mahasiswa']}><MahasiswaSchedule /></PrivateRoute>} />
          <Route path="/mahasiswa/attendance" element={<PrivateRoute roles={['mahasiswa']}><MahasiswaAttendance /></PrivateRoute>} />

          <Route path="/unauthorized" element={
            <div className="flex items-center justify-center h-screen flex-col">
              <h1 className="text-3xl font-bold text-red-500">403</h1>
              <p className="text-gray-500 mt-2">Anda tidak memiliki akses ke halaman ini</p>
              <a href="/login" className="mt-4 text-primary underline">Kembali ke Login</a>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;