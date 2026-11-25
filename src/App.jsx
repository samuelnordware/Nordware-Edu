import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import TopBar from './components/TopBar'
import AdminLayout from './components/AdminLayout'
import CommandPalette from './components/CommandPalette'
import Toaster from './components/Toaster'
import RecoveryDialog from './components/RecoveryDialog'
import Login from './pages/Login'
import Browse from './pages/Browse'
import MyCourses from './pages/MyCourses'
import SavedLessons from './pages/SavedLessons'
import Notes from './pages/Notes'
import CoursePage from './pages/CoursePage'
import LessonPage from './pages/LessonPage'
import Profile from './pages/Profile'
import AdminHome from './pages/admin/AdminHome'
import AdminCourses from './pages/admin/AdminCourses'
import AdminComments from './pages/admin/AdminComments'
import CourseEditor from './pages/admin/CourseEditor'
import LessonEditor from './pages/admin/LessonEditor'
import AdminUsers from './pages/admin/AdminUsers'
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
      <Outlet />
      <CommandPalette />
    </>
  )
}

function StudentLayout() {
  return (
    <>
      <TopBar />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}

function Require({ allow }) {
  const auth = useAuth()
  if (!auth.profile) return <Splash />
  if (!auth[allow]) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<StudentLayout />}>
            <Route index element={<Browse />} />
            <Route path="cursos" element={<MyCourses />} />
            <Route path="salvas" element={<SavedLessons />} />
            <Route path="anotacoes" element={<Notes />} />
            <Route path="treinamento/:courseId" element={<CoursePage />} />
            <Route path="aula/:lessonId" element={<LessonPage />} />
            <Route path="perfil" element={<Profile />} />
          </Route>
          <Route path="admin" element={<Require allow="isStaff" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="cursos" element={<AdminCourses />} />
              <Route path="comentarios" element={<AdminComments />} />
              <Route path="treinamento/:courseId" element={<CourseEditor />} />
              <Route path="aula/:lessonId" element={<LessonEditor />} />
              <Route element={<Require allow="isManager" />}>
                <Route path="usuarios" element={<AdminUsers />} />
              </Route>
              <Route element={<Require allow="isMaster" />}>
                <Route path="personalizar" element={<SiteSettings />} />
              </Route>
            </Route>
          </Route>
          <Route path="personalizar" element={<Navigate to="/admin/personalizar" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RecoveryDialog />
      <Toaster />
    </>
  )
}
