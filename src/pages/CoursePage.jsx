import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadCatalog } from '../lib/catalog'
import { asset } from '../lib/supabase'
import { formatMinutes } from '../lib/video'
import { toastError } from '../lib/toast'
import ProgressBar from '../components/ProgressBar'
import { canEditCourse } from '../lib/roles'

export default function CoursePage() {
  const { courseId } = useParams()
  const { user, profile } = useAuth()
  const [course, setCourse] = useState(undefined)

  useEffect(() => {
    loadCatalog(user.id)
      .then((list) => setCourse(list.find((c) => String(c.id) === courseId) || null))
      .catch(toastError)
  }, [courseId, user.id])

  if (course === undefined) return <div className="page-loading" aria-busy="true" />
  if (course === null)
    return (
      <div className="empty-state">
        <h1>Treinamento não encontrado</h1>
        <p>Ele pode ter sido removido ou ainda não foi publicado.</p>
        <Link className="btn btn--primary" to="/">
          Voltar ao início
        </Link>
      </div>
    )

  const { stats } = course
  return (
    <div className="course" style={{ '--accent': course.accent_color }}>
      <section className="course__banner">
        <div className="hero__media" aria-hidden="true">
          {course.cover_url && <img src={asset(course.cover_url)} alt="" />}
        </div>
        <div className="course__intro">
          <Link to="/" className="back">
            Início
          </Link>
          <h1>{course.title}</h1>
          {course.subtitle && <p className="hero__sub">{course.subtitle}</p>}
          {course.description && <p className="hero__desc">{course.description}</p>}
          <div className="hero__progress">
            <ProgressBar value={stats.percent} label={`Progresso em ${course.title}`} />
            <span>
              {stats.done} de {stats.lessonCount} aulas concluídas
            </span>
          </div>
          <div className="hero__actions">
            {stats.nextLessonId && (
              <Link className="btn btn--play" to={`/aula/${stats.nextLessonId}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                {stats.percent === 100 ? 'Rever' : stats.started ? 'Continuar' : 'Começar'}
              </Link>
            )}
            {canEditCourse(profile, course) && (
              <Link className="btn btn--glass" to={`/admin/treinamento/${course.id}`}>
                Editar treinamento
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="lessons" aria-labelledby="lessons-title">
        <h2 id="lessons-title">Aulas</h2>
        {!course.lessons.length && <p className="empty">Nenhuma aula publicada neste treinamento.</p>}
        <ol className="lesson-list">
          {course.lessons.map((l, i) => {
            const p = course.progressByLesson.get(l.id)
            return (
              <li key={l.id}>
                <Link to={`/aula/${l.id}`} className={p?.completed_at ? 'is-done' : ''}>
                  <span className="lesson-list__num">{p?.completed_at ? <Tick /> : i + 1}</span>
                  <span className="lesson-list__title">{l.title}</span>
                  <span className="lesson-list__time">{formatMinutes(l.duration_minutes)}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-label="Concluída">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
