import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadCourse } from '../lib/catalog'
import { asset, supabase } from '../lib/supabase'
import { formatMinutes } from '../lib/video'
import { canEditCourse } from '../lib/roles'
import { toastError } from '../lib/toast'
import ProgressBar from '../components/ProgressBar'
import ModuleOutline from '../components/ModuleOutline'

export default function CoursePage() {
  const { courseId } = useParams()
  const { user, profile } = useAuth()
  const [course, setCourse] = useState(undefined)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('courses')
      .select('created_by')
      .eq('id', courseId)
      .maybeSingle()
      .then(({ data }) => loadCourse(courseId, user.id, canEditCourse(profile, data)))
      .then(setCourse)
      .catch((e) => {
        toastError(e)
        setCourse(null)
      })
  }, [courseId, user.id, profile])

  if (course === undefined) return <div className="page-loading" aria-busy="true" />
  if (course === null)
    return (
      <div className="empty-state">
        <h1>Treinamento não encontrado</h1>
        <p>Ele pode ter sido removido ou ainda não foi publicado.</p>
        <Link className="btn btn--primary" to="/cursos">Ver meus cursos</Link>
      </div>
    )

  const { stats } = course
  return (
    <div className="course">
      <section className="course__banner">
        <div className="hero__media" aria-hidden="true">
          {course.cover_url && <img src={asset(course.cover_url)} alt="" />}
        </div>
        <div className="course__intro">
          <Link to="/cursos" className="back">Meus cursos</Link>
          <h1>{course.title}</h1>
          {course.subtitle && <p className="hero__sub">{course.subtitle}</p>}
          {course.description && <p className="hero__desc">{course.description}</p>}
          <p className="hero__facts mono">
            {stats.moduleCount} {stats.moduleCount === 1 ? 'módulo' : 'módulos'}, {stats.lessonCount}{' '}
            {stats.lessonCount === 1 ? 'aula' : 'aulas'}
            {stats.minutes ? `, ${formatMinutes(stats.minutes)}` : ''}
          </p>
          <div className="hero__progress">
            <ProgressBar value={stats.percent} label={`Progresso em ${course.title}`} />
            <span className="mono">{Math.round(stats.percent)}%</span>
          </div>
          <div className="hero__actions">
            {stats.nextLessonId && (
              <Link className="btn btn--play" to={`/aula/${stats.nextLessonId}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                {stats.percent === 100 ? 'Rever' : stats.started ? 'Continuar' : 'Começar'}
              </Link>
            )}
            {canEditCourse(profile, course) && (
              <Link className="btn btn--glass" to={`/admin/treinamento/${course.id}`}>Editar treinamento</Link>
            )}
          </div>
        </div>
      </section>

      <section className="course__content" aria-labelledby="ct-title">
        <div className="course__content-head">
          <h2 id="ct-title">Conteúdo do treinamento</h2>
          <div className="side__search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar aula" aria-label="Procurar aula" />
          </div>
        </div>
        {course.modules.length ? (
          <ModuleOutline course={course} query={query} />
        ) : (
          <p className="empty">Nenhuma aula publicada neste treinamento.</p>
        )}
      </section>
    </div>
  )
}
