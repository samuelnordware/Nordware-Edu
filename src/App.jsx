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

function RequireAdmin() {
  const { isAdmin, profile } = useAuth()
  if (!profile) return <Splash />
  if (!isAdmin) return <Navigate to="/" replace />
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
          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<AdminCourses />} />
            <Route path="treinamento/:courseId" element={<CourseEditor />} />
            <Route path="aula/:lessonId" element={<LessonEditor />} />
            <Route path="usuarios" element={<AdminUsers />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RecoveryDialog />
      <Toaster />
    </>
  )
}
