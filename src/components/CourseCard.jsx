import { Link } from 'react-router-dom'
import { asset } from '../lib/supabase'
import ProgressBar from './ProgressBar'

export default function CourseCard({ course }) {
  const { lessonCount, done, percent } = course.stats
  return (
    <Link to={`/treinamento/${course.id}`} className="card" style={{ '--accent': course.accent_color }}>
      <div className="card__media">
        {course.cover_url ? (
          <img src={asset(course.cover_url)} alt="" loading="lazy" />
        ) : (
          <div className="card__fallback">{course.title}</div>
        )}
        {!course.is_published && <span className="chip chip--draft">Rascunho</span>}
        {percent > 0 && <ProgressBar value={percent} label={`Progresso em ${course.title}`} />}
      </div>
      <div className="card__body">
        <h3>{course.title}</h3>
        <p>
          {lessonCount === 1 ? '1 aula' : `${lessonCount} aulas`}
          {percent === 100 ? ', concluído' : done > 0 ? `, ${done} assistida${done > 1 ? 's' : ''}` : ''}
        </p>
      </div>
    </Link>
  )
}
