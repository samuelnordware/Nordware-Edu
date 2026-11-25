import { useRef } from 'react'
import CourseCard from './CourseCard'

export default function CourseRow({ title, courses }) {
  const track = useRef(null)
  if (!courses.length) return null
  const scroll = (dir) => {
    const el = track.current
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <section className="row" aria-label={title}>
      <div className="row__head">
        <h2>{title}</h2>
        <div className="row__ctrl">
          <button onClick={() => scroll(-1)} aria-label="Voltar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button onClick={() => scroll(1)} aria-label="Avançar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div className="row__track" ref={track}>
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  )
}
