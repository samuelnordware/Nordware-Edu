import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMinutes } from '../lib/video'

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 12.5l4 4 9-9" />
    </svg>
  )
}

// Modulos em sanfona com as aulas; a bolinha marca a aula como concluida
export default function ModuleOutline({ course, currentLessonId, onToggle, query = '' }) {
  const currentModule = course.modules.find((m) => m.lessons.some((l) => l.id === currentLessonId))?.id
  const [open, setOpen] = useState(() => new Set([currentModule ?? course.modules[0]?.id]))

  useEffect(() => {
    if (currentModule) setOpen((s) => new Set(s).add(currentModule))
  }, [currentModule])

  const q = norm(query.trim())
  const modules = useMemo(
    () =>
      q
        ? course.modules
            .map((m) => ({ ...m, lessons: m.lessons.filter((l) => norm(l.title).includes(q)) }))
            .filter((m) => m.lessons.length)
        : course.modules,
    [course.modules, q]
  )
  const isDone = (id) => Boolean(course.progressByLesson.get(id)?.completed_at)

  if (!modules.length) return <p className="empty">Nenhuma aula encontrada.</p>

  return (
    <ol className="outline">
      {modules.map((m, mi) => {
        const doneCount = m.lessons.filter((l) => isDone(l.id)).length
        const complete = doneCount === m.lessons.length
        const expanded = Boolean(q) || open.has(m.id)
        return (
          <li key={m.id} className={'outline__module' + (complete ? ' is-complete' : '')}>
            <button
              className="outline__head"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((s) => {
                  const n = new Set(s)
                  n.has(m.id) ? n.delete(m.id) : n.add(m.id)
                  return n
                })
              }
            >
              <span className={'outline__ring' + (complete ? ' is-done' : doneCount ? ' is-partial' : '')} aria-hidden="true">
                {complete ? <Check /> : <span>{String(mi + 1).padStart(2, '0')}</span>}
              </span>
              <span className="outline__title">
                <strong>{m.title}</strong>
                <small>
                  {doneCount}/{m.lessons.length} {m.lessons.length === 1 ? 'aula' : 'aulas'}
                </small>
              </span>
              <svg className="outline__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {expanded && (
              <ol className="outline__lessons">
                {m.lessons.map((l) => {
                  const done = isDone(l.id)
                  const current = l.id === currentLessonId
                  return (
                    <li key={l.id} className={(current ? 'is-current ' : '') + (done ? 'is-done' : '')}>
                      {onToggle ? (
                        <button
                          className="tick"
                          onClick={() => onToggle(l.id, !done)}
                          aria-pressed={done}
                          aria-label={done ? `Desmarcar ${l.title}` : `Marcar ${l.title} como concluída`}
                          title={done ? 'Desmarcar aula' : 'Marcar como concluída'}
                        >
                          <Check />
                        </button>
                      ) : (
                        <span className={'tick tick--static' + (done ? ' is-on' : '')} aria-hidden="true"><Check /></span>
                      )}
                      <Link to={`/aula/${l.id}`} aria-current={current ? 'page' : undefined}>
                        <span className="outline__lesson">{l.title}</span>
                        <span className="outline__meta">
                          {current ? 'Assistindo agora' : formatMinutes(l.duration_minutes) || (l.is_published ? '' : 'Oculta')}
                          {current && l.duration_minutes ? `, ${formatMinutes(l.duration_minutes)}` : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
}
