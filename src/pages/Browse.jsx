import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadCatalog } from '../lib/catalog'
import { asset } from '../lib/supabase'
import { formatMinutes } from '../lib/video'
import { toastError } from '../lib/toast'
import CourseRow from '../components/CourseRow'
import ProgressBar from '../components/ProgressBar'

export default function Browse() {
  const { user, isStaff, profile } = useAuth()
  const [courses, setCourses] = useState(null)

  useEffect(() => {
    loadCatalog(user.id).then(setCourses).catch(toastError)
  }, [user.id])

  const { hero, continuing, rows, finished } = useMemo(() => {
    if (!courses) return {}
    const visible = courses.filter((c) => c.stats.lessonCount > 0 || isStaff)
    const hero =
      visible.find((c) => c.is_featured && c.is_published) || visible.find((c) => c.is_published) || visible[0]
    const continuing = visible
      .filter((c) => c.stats.started && c.stats.percent < 100)
      .sort((a, b) => (b.stats.lastSeen > a.stats.lastSeen ? 1 : -1))
    const finished = visible.filter((c) => c.stats.percent === 100)
    const groups = new Map()
    visible.forEach((c) => {
      const key = c.category || 'Todos os treinamentos'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(c)
    })
    return { hero, continuing, rows: [...groups.entries()], finished }
  }, [courses, isStaff])

  if (!courses) return <div className="page-loading" aria-busy="true" />

  if (!hero) {
    return (
      <div className="empty-state">
        <h1>Nenhum treinamento publicado ainda</h1>
        {isStaff ? (
          <>
            <p>Crie o primeiro treinamento e publique para os alunos.</p>
            <Link className="btn btn--primary" to="/admin/treinamento/novo">
              Criar treinamento
            </Link>
          </>
        ) : (
          <p>Assim que um treinamento for publicado, ele aparece aqui.</p>
        )}
      </div>
    )
  }

  const firstName = (profile?.full_name || '').split(' ')[0]
  const heroAction = hero.stats.nextLessonId ? `/aula/${hero.stats.nextLessonId}` : `/treinamento/${hero.id}`

  return (
    <div className="browse">
      <section className="hero" style={{ '--accent': hero.accent_color }}>
        <div className="hero__media" aria-hidden="true">
          {hero.cover_url && <img src={asset(hero.cover_url)} alt="" />}
        </div>
        <div className="hero__content">
          {firstName && <p className="hero__hello">Olá, {firstName}</p>}
          <h1>{hero.title}</h1>
          {hero.subtitle && <p className="hero__sub">{hero.subtitle}</p>}
          {hero.description && <p className="hero__desc">{hero.description}</p>}
          <p className="hero__facts">
            {hero.stats.lessonCount} {hero.stats.lessonCount === 1 ? 'aula' : 'aulas'}
            {hero.stats.minutes ? `, ${formatMinutes(hero.stats.minutes)}` : ''}
          </p>
          {hero.stats.percent > 0 && (
            <div className="hero__progress">
              <ProgressBar value={hero.stats.percent} label={`Progresso em ${hero.title}`} />
              <span>{Math.round(hero.stats.percent)}% concluído</span>
            </div>
          )}
          <div className="hero__actions">
            <Link className="btn btn--play" to={heroAction}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
              {hero.stats.started ? 'Continuar' : 'Assistir'}
            </Link>
            <Link className="btn btn--glass" to={`/treinamento/${hero.id}`}>
              Ver aulas
            </Link>
          </div>
        </div>
      </section>

      <div className="rows">
        <CourseRow title="Continuar assistindo" courses={continuing} />
        {rows.map(([title, list]) => (
          <CourseRow key={title} title={title} courses={list} />
        ))}
        <CourseRow title="Concluídos" courses={finished} />
      </div>
    </div>
  )
}
