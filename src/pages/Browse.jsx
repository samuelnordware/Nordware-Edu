import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadCatalog } from '../lib/catalog'
import { asset } from '../lib/supabase'
import { formatMinutes } from '../lib/video'
import { toastError } from '../lib/toast'
import { useSite, greeting } from '../lib/site'
import { canEditCourse } from '../lib/roles'
import CourseRow from '../components/CourseRow'
import ProgressBar from '../components/ProgressBar'

function Carousel({ banners }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || banners.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((v) => (v + 1) % banners.length), 6000)
    return () => clearInterval(t)
  }, [paused, banners.length])

  return (
    <section className="carousel" aria-roledescription="carrossel" aria-label="Destaques"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="carousel__track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, k) => {
          const img = <img src={asset(b.image_url)} alt={b.alt || ''} loading={k ? 'lazy' : 'eager'} />
          return (
            <div key={k} className="carousel__slide" aria-hidden={k !== i} role="group" aria-label={`${k + 1} de ${banners.length}`}>
              {b.link ? (
                /^https?:/.test(b.link) ? (
                  <a href={b.link} target="_blank" rel="noreferrer" tabIndex={k === i ? 0 : -1}>{img}</a>
                ) : (
                  <Link to={b.link} tabIndex={k === i ? 0 : -1}>{img}</Link>
                )
              ) : (
                img
              )}
            </div>
          )
        })}
      </div>
      {banners.length > 1 && (
        <div className="carousel__dots">
          {banners.map((_, k) => (
            <button key={k} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} aria-label={`Ver destaque ${k + 1}`} aria-current={k === i} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Browse() {
  const { user, isStaff, profile } = useAuth()
  const [courses, setCourses] = useState(null)
  const site = useSite()

  useEffect(() => {
    loadCatalog(user.id).then(setCourses).catch(toastError)
  }, [user.id])

  const { hero, continuing, rows, finished } = useMemo(() => {
    if (!courses) return {}
    const visible = courses.filter((c) => c.stats.lessonCount > 0 || isStaff)
    const hero = visible.find((c) => c.is_featured && c.is_published) || visible.find((c) => c.is_published) || visible[0]
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
            <Link className="btn btn--primary" to="/admin/treinamento/novo">Criar treinamento</Link>
          </>
        ) : (
          <p>Assim que um treinamento for publicado, ele aparece aqui.</p>
        )}
      </div>
    )
  }

  const firstName = (profile?.full_name || '').split(' ')[0]
  const banners = (site?.home_banners || []).filter((b) => b?.image_url)
  const heroAction = hero.stats.nextLessonId ? `/aula/${hero.stats.nextLessonId}` : `/treinamento/${hero.id}`

  return (
    <div className="browse">
      {banners.length ? (
        <div className="browse__top">
          {greeting(site, firstName) && <p className="browse__hello">{greeting(site, firstName)}</p>}
          <Carousel banners={banners} />
        </div>
      ) : (
        <section className="hero">
          <div className="hero__media" aria-hidden="true">
            {(site?.hero_image_url || hero.cover_url) && <img src={asset(site?.hero_image_url || hero.cover_url)} alt="" />}
          </div>
          <div className="hero__content">
            {greeting(site, firstName) && <p className="hero__hello">{greeting(site, firstName)}</p>}
            <h1>{hero.title}</h1>
            {hero.subtitle && <p className="hero__sub">{hero.subtitle}</p>}
            {hero.description && <p className="hero__desc">{hero.description}</p>}
            <p className="hero__facts mono">
              {hero.stats.moduleCount} {hero.stats.moduleCount === 1 ? 'módulo' : 'módulos'}, {hero.stats.lessonCount}{' '}
              {hero.stats.lessonCount === 1 ? 'aula' : 'aulas'}
              {hero.stats.minutes ? `, ${formatMinutes(hero.stats.minutes)}` : ''}
            </p>
            {hero.stats.percent > 0 && (
              <div className="hero__progress">
                <ProgressBar value={hero.stats.percent} label={`Progresso em ${hero.title}`} />
                <span className="mono">{Math.round(hero.stats.percent)}%</span>
              </div>
            )}
            <div className="hero__actions">
              <Link className="btn btn--play" to={heroAction}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                {hero.stats.started ? 'Continuar' : 'Assistir'}
              </Link>
              <Link className="btn btn--glass" to={`/treinamento/${hero.id}`}>Ver conteúdo</Link>
              {canEditCourse(profile, hero) && (
                <Link className="btn btn--glass" to={`/admin/treinamento/${hero.id}`}>Editar textos</Link>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="rows">
        <CourseRow title="Continue aprendendo" courses={continuing} />
        {rows.map(([title, list]) => (
          <CourseRow key={title} title={title} courses={list} />
        ))}
        <CourseRow title="Concluídos" courses={finished} />
      </div>
    </div>
  )
}
