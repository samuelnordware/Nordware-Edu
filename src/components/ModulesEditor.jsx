import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMinutes } from '../lib/video'
import { toast, toastError } from '../lib/toast'

const PROVIDER = { youtube: 'YouTube', vimeo: 'Vimeo', upload: 'Arquivo' }

function Grip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  )
}

// Modulos e aulas do treinamento: reordene arrastando pela alca (ou com as setas do teclado)
export default function ModulesEditor({ courseId }) {
  const [groups, setGroups] = useState(null)
  const [title, setTitle] = useState('')
  const [drag, setDrag] = useState(null) // { type: 'module' | 'lesson', id }
  const [over, setOver] = useState(null) // { type, id, pos } | { type: 'zone', moduleId }
  const focusAfter = useRef(null)

  async function load() {
    const [{ data: mods, error }, { data: lessons }] = await Promise.all([
      supabase.from('modules').select('id, title, sort_order').eq('course_id', courseId).order('sort_order').order('id'),
      supabase
        .from('lessons')
        .select('id, title, video_provider, duration_minutes, is_published, sort_order, module_id')
        .eq('course_id', courseId)
        .order('sort_order')
        .order('id'),
    ])
    if (error) toastError(error)
    const list = (mods || []).map((m) => ({ ...m, lessons: (lessons || []).filter((l) => l.module_id === m.id) }))
    const loose = (lessons || []).filter((l) => !list.some((m) => m.id === l.module_id))
    list.push({ id: null, title: 'Sem módulo', lessons: loose })
    setGroups(list)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  useEffect(() => {
    if (!focusAfter.current) return
    document.querySelector(`[data-grip="${focusAfter.current}"]`)?.focus()
    focusAfter.current = null
  })

  async function persist(next, prev) {
    const jobs = []
    next.forEach((g, gi) => {
      const old = prev.find((p) => p.id === g.id)
      if (g.id !== null && old && old.sort_order !== gi + 1) {
        jobs.push(supabase.from('modules').update({ sort_order: gi + 1 }).eq('id', g.id))
      }
      g.lessons.forEach((l, li) => {
        if (l.sort_order !== li + 1 || l.module_id !== g.id) {
          jobs.push(supabase.from('lessons').update({ sort_order: li + 1, module_id: g.id }).eq('id', l.id))
        }
      })
    })
    const results = await Promise.all(jobs)
    const failed = results.find((r) => r.error)
    if (failed) {
      toastError(failed.error)
      load()
      return
    }
    setGroups(
      next.map((g, gi) => ({
        ...g,
        sort_order: gi + 1,
        lessons: g.lessons.map((l, li) => ({ ...l, sort_order: li + 1, module_id: g.id })),
      }))
    )
  }

  function moveLesson(lessonId, toModuleId, toIndex) {
    const prev = groups
    const next = groups.map((g) => ({ ...g, lessons: [...g.lessons] }))
    const from = next.find((g) => g.lessons.some((l) => l.id === lessonId))
    const fromIdx = from.lessons.findIndex((l) => l.id === lessonId)
    const [lesson] = from.lessons.splice(fromIdx, 1)
    const target = next.find((g) => g.id === toModuleId)
    let idx = toIndex
    if (from === target && fromIdx < toIndex) idx -= 1
    target.lessons.splice(Math.max(0, Math.min(idx, target.lessons.length)), 0, lesson)
    setGroups(next)
    persist(next, prev)
  }

  function moveModule(moduleId, toIndex) {
    const prev = groups
    const mods = groups.filter((g) => g.id !== null)
    const fromIdx = mods.findIndex((m) => m.id === moduleId)
    const [m] = mods.splice(fromIdx, 1)
    let idx = toIndex
    if (fromIdx < toIndex) idx -= 1
    mods.splice(Math.max(0, Math.min(idx, mods.length)), 0, m)
    const next = [...mods, groups.find((g) => g.id === null)]
    setGroups(next)
    persist(next, prev)
  }

  function onLessonKey(e, g, li) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const gi = groups.indexOf(g)
    const id = g.lessons[li].id
    focusAfter.current = `l${id}`
    if (e.key === 'ArrowUp') {
      if (li > 0) return moveLesson(id, g.id, li - 1)
      const prevGroup = groups[gi - 1]
      if (prevGroup) moveLesson(id, prevGroup.id, prevGroup.lessons.length)
    } else {
      if (li < g.lessons.length - 1) return moveLesson(id, g.id, li + 2)
      const nextGroup = groups[gi + 1]
      if (nextGroup) moveLesson(id, nextGroup.id, 0)
    }
  }

  function onModuleKey(e, mi, id) {
    const count = groups.filter((g) => g.id !== null).length
    if (e.key === 'ArrowUp' && mi > 0) {
      e.preventDefault()
      focusAfter.current = `m${id}`
      moveModule(id, mi - 1)
    }
    if (e.key === 'ArrowDown' && mi < count - 1) {
      e.preventDefault()
      focusAfter.current = `m${id}`
      moveModule(id, mi + 2)
    }
  }

  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'before' : 'after'
  }
  const endDrag = () => {
    setDrag(null)
    setOver(null)
  }

  async function addModule(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const count = groups.filter((g) => g.id !== null).length
    const { error } = await supabase.from('modules').insert({ course_id: Number(courseId), title: t, sort_order: count + 1 })
    if (error) return toastError(error)
    setTitle('')
    load()
  }

  async function rename(m, value) {
    const t = value.trim()
    if (!t || t === m.title) return
    const { error } = await supabase.from('modules').update({ title: t }).eq('id', m.id)
    if (error) return toastError(error)
    toast('Módulo renomeado.')
    setGroups((gs) => gs.map((g) => (g.id === m.id ? { ...g, title: t } : g)))
  }

  async function removeModule(m) {
    if (m.lessons.length) return toastError('Mova ou exclua as aulas deste módulo antes de excluí-lo.')
    if (!window.confirm(`Excluir o módulo ${m.title}?`)) return
    const { error } = await supabase.from('modules').delete().eq('id', m.id)
    if (error) return toastError(error)
    load()
  }

  if (!groups) return <div className="page-loading" aria-busy="true" />
  const mods = groups.filter((g) => g.id !== null)
  const loose = groups.find((g) => g.id === null)

  return (
    <section className="modules-editor" aria-labelledby="me-title">
      <div className="admin__head">
        <div>
          <h2 id="me-title">Módulos e aulas</h2>
          <p className="muted">Arraste pela alça para reordenar. As aulas também podem ser arrastadas de um módulo para outro.</p>
        </div>
      </div>

      {[...mods, ...(loose.lessons.length || drag?.type === 'lesson' ? [loose] : [])].map((g) => {
        const mi = mods.indexOf(g)
        const isModule = g.id !== null
        const overClass =
          drag?.type === 'module' && over?.type === 'module' && over.id === g.id ? ` drop-${over.pos}` : ''
        return (
          <div
            key={g.id ?? 'loose'}
            className={'mod-card' + overClass + (drag?.type === 'module' && drag.id === g.id ? ' is-dragging' : '')}
            onDragOver={(e) => {
              if (drag?.type !== 'module' || !isModule) return
              e.preventDefault()
              setOver({ type: 'module', id: g.id, pos: pos(e) })
            }}
            onDrop={(e) => {
              if (drag?.type !== 'module' || !isModule) return
              e.preventDefault()
              moveModule(drag.id, mi + (over?.pos === 'after' ? 1 : 0))
              endDrag()
            }}
          >
            <div
              className="mod-card__head"
              draggable={isModule}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', `m${g.id}`)
                setDrag({ type: 'module', id: g.id })
              }}
              onDragEnd={endDrag}
            >
              {isModule ? (
                <button className="grip" data-grip={`m${g.id}`} onKeyDown={(e) => onModuleKey(e, mi, g.id)}
                  aria-label={`Mover o módulo ${g.title}. Arraste ou use as setas do teclado.`}>
                  <Grip />
                </button>
              ) : (
                <span className="grip grip--off" aria-hidden="true" />
              )}
              <span className="mod-card__num mono">{isModule ? String(mi + 1).padStart(2, '0') : '--'}</span>
              {isModule ? (
                <input className="mod-card__title" defaultValue={g.title} aria-label="Nome do módulo" maxLength={160}
                  onBlur={(e) => rename(g, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
              ) : (
                <span className="mod-card__title mod-card__title--static">Sem módulo</span>
              )}
              <span className="mod-card__count mono">{g.lessons.length} {g.lessons.length === 1 ? 'aula' : 'aulas'}</span>
              {isModule && (
                <button className="icon-btn icon-btn--danger" onClick={() => removeModule(g)} aria-label={`Excluir o módulo ${g.title}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </div>

            <ol
              className={'mod-card__lessons' + (drag?.type === 'lesson' && over?.type === 'zone' && over.moduleId === g.id ? ' is-target' : '')}
              onDragOver={(e) => {
                if (drag?.type !== 'lesson') return
                e.preventDefault()
                if (e.target === e.currentTarget) setOver({ type: 'zone', moduleId: g.id })
              }}
              onDrop={(e) => {
                if (drag?.type !== 'lesson' || e.target !== e.currentTarget) return
                e.preventDefault()
                moveLesson(drag.id, g.id, g.lessons.length)
                endDrag()
              }}
            >
              {g.lessons.map((l, li) => (
                <li
                  key={l.id}
                  draggable
                  className={
                    (drag?.type === 'lesson' && drag.id === l.id ? 'is-dragging ' : '') +
                    (drag?.type === 'lesson' && over?.type === 'lesson' && over.id === l.id ? `drop-${over.pos}` : '')
                  }
                  onDragStart={(e) => {
                    e.stopPropagation()
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', `l${l.id}`)
                    setDrag({ type: 'lesson', id: l.id })
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (drag?.type !== 'lesson') return
                    e.preventDefault()
                    e.stopPropagation()
                    setOver({ type: 'lesson', id: l.id, pos: pos(e) })
                  }}
                  onDrop={(e) => {
                    if (drag?.type !== 'lesson') return
                    e.preventDefault()
                    e.stopPropagation()
                    moveLesson(drag.id, g.id, li + (over?.pos === 'after' ? 1 : 0))
                    endDrag()
                  }}
                >
                  <button className="grip" data-grip={`l${l.id}`} onKeyDown={(e) => onLessonKey(e, g, li)}
                    aria-label={`Mover a aula ${l.title}. Arraste ou use as setas do teclado.`}>
                    <Grip />
                  </button>
                  <div className="mod-card__info">
                    <strong>{l.title}</strong>
                    <small className="muted">
                      {PROVIDER[l.video_provider]}
                      {l.duration_minutes ? `, ${formatMinutes(l.duration_minutes)}` : ''}
                      {!l.is_published ? ', oculta' : ''}
                    </small>
                  </div>
                  <Link className="btn btn--ghost btn--sm" to={`/admin/aula/${l.id}`}>Editar</Link>
                </li>
              ))}
              {!g.lessons.length && <li className="mod-card__empty">Arraste aulas para cá ou crie uma nova.</li>}
            </ol>
            {isModule && (
              <Link className="mod-card__add" to={`/admin/aula/nova?curso=${courseId}&modulo=${g.id}`}>Nova aula neste módulo</Link>
            )}
          </div>
        )
      })}

      <form className="inline-form mod-new" onSubmit={addModule}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do novo módulo, por exemplo: Primeiros passos"
          aria-label="Nome do novo módulo" maxLength={160} />
        <button className="btn btn--primary btn--sm" disabled={!title.trim()}>Adicionar módulo</button>
      </form>
    </section>
  )
}
