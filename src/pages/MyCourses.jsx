import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadCatalog } from '../lib/catalog'
import { toastError } from '../lib/toast'
import CourseCard from '../components/CourseCard'

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'doing', label: 'Em andamento' },
  { id: 'new', label: 'Não iniciados' },
  { id: 'done', label: 'Concluídos' },
]

export default function MyCourses() {
  const { user, isStaff } = useAuth()
  const [courses, setCourses] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadCatalog(user.id).then(setCourses).catch(toastError)
  }, [user.id])

  const list = useMemo(() => {
    if (!courses) return []
    const q = norm(query.trim())
    return courses
      .filter((c) => c.stats.lessonCount > 0 || isStaff)
      .filter((c) => {
        const p = c.stats.percent
        if (filter === 'doing') return c.stats.started && p < 100
        if (filter === 'new') return !c.stats.started
        if (filter === 'done') return p === 100
        return true
      })
      .filter((c) => !q || norm(`${c.title} ${c.subtitle || ''} ${c.category || ''}`).includes(q))
  }, [courses, filter, query, isStaff])

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Meus cursos</h1>
          <p className="muted">Todos os treinamentos disponíveis para você.</p>
        </div>
        <div className="side__search page__search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nome" aria-label="Filtrar cursos" />
        </div>
      </header>
      <div className="segmented page__filters" role="tablist" aria-label="Filtrar cursos">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'is-active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {!courses && <div className="page-loading" aria-busy="true" />}
      {courses && !list.length && <p className="empty">Nenhum curso neste filtro.</p>}
      <div className="course-grid">
        {list.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  )
}
