import { Link } from 'react-router-dom'
import { asset } from '../lib/supabase'
import ProgressBar from './ProgressBar'

export default function CourseCard({ course }) {
  const { lessonCount, moduleCount, percent, started } = course.stats
  return (
    <Link to={`/treinamento/${course.id}`} className="card">
      <div className="card__media">
        {course.cover_url ? <img src={asset(course.cover_url)} alt="" loading="lazy" /> : <div className="card__fallback">{course.title}</div>}
        {!course.is_published && <span className="chip chip--draft">Rascunho</span>}
      </div>
      <div className="card__body">
        <h3>{course.title}</h3>
        <p className="mono">
          {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}, {lessonCount} {lessonCount === 1 ? 'aula' : 'aulas'}
        </p>
        <div className="card__progress">
          <ProgressBar value={percent} label={`Progresso em ${course.title}`} />
          <span className="mono">{started ? `${Math.round(percent)}%` : 'Novo'}</span>
        </div>
      </div>
    </Link>
  )
}
