import { useEffect, useRef, useState } from 'react'
import CourseCard from './CourseCard'

// Fileira de cursos que passa sozinha, com bolinhas indicando a página
export default function CourseRow({ title, courses }) {
  const track = useRef(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => setPages(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.02)))
    const onScroll = () => setPage(Math.min(Math.round(el.scrollLeft / el.clientWidth), pages - 1))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [courses.length, pages])

  const goTo = (p) => track.current?.scrollTo({ left: p * track.current.clientWidth, behavior: 'smooth' })

  useEffect(() => {
    if (pages < 2 || paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => goTo((page + 1) % pages), 5000)
    return () => clearInterval(t)
  }, [pages, page, paused])

  if (!courses.length) return null

  return (
    <section
      className="row"
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="row__head">
        <h2>{title}</h2>
      </div>
      <div className="row__track" ref={track}>
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
      {pages > 1 && (
        <div className="row__dots">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={i === page ? 'is-active' : ''} onClick={() => goTo(i)}
              aria-label={`Página ${i + 1} de ${pages}`} aria-current={i === page} />
          ))}
        </div>
      )}
    </section>
  )
}
