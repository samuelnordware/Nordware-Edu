import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import NavBar from './components/NavBar'
import Toaster from './components/Toaster'
import RecoveryDialog from './components/RecoveryDialog'
import Login from './pages/Login'
import Browse from './pages/Browse'
import CoursePage from './pages/CoursePage'
import LessonPage from './pages/LessonPage'
import AdminCourses from './pages/admin/AdminCourses'
import CourseEditor from './pages/admin/CourseEditor'
import LessonEditor from './pages/admin/LessonEditor'
import AdminUsers from './pages/admin/AdminUsers'
import Profile from './pages/Profile'
import SiteSettings from './pages/admin/SiteSettings'

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Carregando">
      <img src={import.meta.env.BASE_URL + 'brand/nordware-arrow.png'} alt="" />
    </div>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return (
    <>
      <NavBar />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}

function RequireStaff() {
  const { isStaff, profile } = useAuth()
  if (!profile) return <Splash />
  if (!isStaff) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireMaster() {
  const { isMaster, profile } = useAuth()
  if (!profile) return <Splash />
  if (!isMaster) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireManager() {
  const { isManager, profile } = useAuth()
  if (!profile) return <Splash />
  if (!isManager) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Browse />} />
          <Route path="treinamento/:courseId" element={<CoursePage />} />
          <Route path="aula/:lessonId" element={<LessonPage />} />
          <Route path="perfil" element={<Profile />} />
          <Route element={<RequireMaster />}>
            <Route path="personalizar" element={<SiteSettings />} />
          </Route>
          <Route path="admin" element={<RequireStaff />}>
            <Route index element={<AdminCourses />} />
            <Route path="treinamento/:courseId" element={<CourseEditor />} />
            <Route path="aula/:lessonId" element={<LessonEditor />} />
            <Route element={<RequireManager />}>
              <Route path="usuarios" element={<AdminUsers />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RecoveryDialog />
      <Toaster />
    </>
  )
}
