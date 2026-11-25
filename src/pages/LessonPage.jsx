import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, asset } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes } from '../lib/video'
import { toast, toastError } from '../lib/toast'
import VideoPlayer from '../components/VideoPlayer'
import ChecklistPanel from '../components/ChecklistPanel'
import DocumentsPanel from '../components/DocumentsPanel'
import CommentsPanel from '../components/CommentsPanel'
import ProgressBar from '../components/ProgressBar'
import { canEditCourse } from '../lib/roles'

export default function LessonPage() {
  const { lessonId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(undefined)
  const [siblings, setSiblings] = useState([])
  const [progress, setProgress] = useState(new Map())
  const [tab, setTab] = useState('checklist')
  const [counts, setCounts] = useState({ checklist: null, docs: null, comments: null })

  useEffect(() => {
    let active = true
    setLesson(undefined)
    ;(async () => {
      const { data: l, error } = await supabase
        .from('lessons')
        .select('*, courses(id, title, accent_color, created_by, cover_url)')
        .eq('id', lessonId)
        .maybeSingle()
      if (!active) return
      if (error) toastError(error)
      if (!l) return setLesson(null)
      const [{ data: sibs }, { data: prog }] = await Promise.all([
        supabase
          .from('lessons')
          .select('id, title, sort_order, duration_minutes, is_published')
          .eq('course_id', l.course_id)
          .order('sort_order')
          .order('id'),
        supabase.from('lesson_progress').select('lesson_id, completed_at').eq('user_id', user.id),
      ])
      if (!active) return
      setLesson(l)
      setSiblings((sibs || []).filter((s) => s.is_published || canEditCourse(profile, l.courses)))
      setProgress(new Map((prog || []).map((p) => [p.lesson_id, p])))
      // registra a visita (alimenta "Continuar assistindo")
      supabase
        .from('lesson_progress')
        .upsert(
          { user_id: user.id, lesson_id: l.id, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,lesson_id' }
        )
        .then(({ error: e }) => e && console.warn(e))
    })()
    return () => {
      active = false
    }
  }, [lessonId, user.id, profile])

  const setChecklistCount = useCallback((c) => setCounts((s) => ({ ...s, checklist: c })), [])
  const setDocsCount = useCallback((n) => setCounts((s) => ({ ...s, docs: n })), [])
  const setCommentsCount = useCallback((n) => setCounts((s) => ({ ...s, comments: n })), [])

  if (lesson === undefined) return <div className="page-loading" aria-busy="true" />
  if (lesson === null)
    return (
      <div className="empty-state">
        <h1>Aula não encontrada</h1>
        <p>Ela pode ter sido removida ou ainda não foi publicada.</p>
        <Link className="btn btn--primary" to="/">
          Voltar ao início
        </Link>
      </div>
    )

  const idx = siblings.findIndex((s) => s.id === lesson.id)
  const next = siblings[idx + 1]
  const prev = siblings[idx - 1]
  const completed = Boolean(progress.get(lesson.id)?.completed_at)
  const canEdit = canEditCourse(profile, lesson.courses)

  const doneCount = siblings.filter((s) => progress.get(s.id)?.completed_at).length

  // Marca ou desmarca qualquer aula do treinamento
  async function setComplete(lessonId, value) {
    const completed_at = value ? new Date().toISOString() : null
    const before = progress
    const m = new Map(progress)
    m.set(lessonId, { lesson_id: lessonId, completed_at })
    setProgress(m)
    const { error } = await supabase
      .from('lesson_progress')
      .upsert(
        { user_id: user.id, lesson_id: lessonId, completed_at, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' }
      )
    if (error) {
      setProgress(before)
      toastError(error)
      return false
    }
    return true
  }

  async function toggleComplete() {
    const ok = await setComplete(lesson.id, !completed)
    if (ok && !completed) {
      toast('Aula concluída.')
      if (next) navigate(`/aula/${next.id}`)
    }
  }

  const tabs = [
    {
      id: 'checklist',
      label: 'Checklist',
      badge: counts.checklist?.total ? `${counts.checklist.done}/${counts.checklist.total}` : null,
    },
    { id: 'docs', label: 'Documentos', badge: counts.docs || null },
    { id: 'comments', label: 'Comentários', badge: counts.comments || null },
  ]

  return (
    <div className="lesson" style={{ '--accent': lesson.courses?.accent_color }}>
      <div className="lesson__main">
        <nav className="crumbs" aria-label="Você está em">
          <Link to="/">Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/treinamento/${lesson.course_id}`}>{lesson.courses?.title}</Link>
        </nav>

        <VideoPlayer provider={lesson.video_provider} videoRef={lesson.video_ref} title={lesson.title} />

        <div className="lesson__head">
          <div>
            <p className="lesson__pos">
              Aula {idx + 1} de {siblings.length}
              {lesson.duration_minutes ? `, ${formatMinutes(lesson.duration_minutes)}` : ''}
            </p>
            <h1>{lesson.title}</h1>
          </div>
          <div className="lesson__actions">
            {canEdit && (
              <Link className="btn btn--ghost btn--sm" to={`/admin/aula/${lesson.id}`}>
                Editar aula
              </Link>
            )}
            <button className={'btn btn--sm ' + (completed ? 'btn--done' : 'btn--primary')} onClick={toggleComplete}>
              {completed ? 'Concluída' : 'Marcar como concluída'}
            </button>
          </div>
        </div>
        {lesson.description && <p className="lesson__desc">{lesson.description}</p>}

        <div className="tabs" role="tablist" aria-label="Recursos da aula">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={tab === t.id ? 'is-active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge !== null && <span className="tabs__badge">{t.badge}</span>}
            </button>
          ))}
        </div>
        {/* Paineis ficam montados para manter os contadores das abas */}
        <div role="tabpanel" id="panel-checklist" aria-labelledby="tab-checklist" hidden={tab !== 'checklist'}>
          <ChecklistPanel lessonId={lesson.id} onCountChange={setChecklistCount} />
        </div>
        <div role="tabpanel" id="panel-docs" aria-labelledby="tab-docs" hidden={tab !== 'docs'}>
          <DocumentsPanel lessonId={lesson.id} onCountChange={setDocsCount} />
        </div>
        <div role="tabpanel" id="panel-comments" aria-labelledby="tab-comments" hidden={tab !== 'comments'}>
          <CommentsPanel lessonId={lesson.id} onCountChange={setCommentsCount} canModerate={canEdit} />
        </div>
      </div>

      <aside className="lesson__side" aria-label="Aulas do treinamento">
        <div className="side__head">
          {lesson.courses?.cover_url && (
            <img className="side__cover" src={asset(lesson.courses.cover_url)} alt="" />
          )}
          <h2>{lesson.courses?.title}</h2>
          <div className="side__progress">
            <ProgressBar value={siblings.length ? (doneCount / siblings.length) * 100 : 0} label="Progresso no treinamento" />
            <span>
              {doneCount} de {siblings.length} {siblings.length === 1 ? 'aula concluída' : 'aulas concluídas'}
            </span>
          </div>
        </div>

        <ol className="side__list">
          {siblings.map((s, i) => {
            const done = Boolean(progress.get(s.id)?.completed_at)
            const current = s.id === lesson.id
            return (
              <li key={s.id} className={(current ? 'is-current ' : '') + (done ? 'is-done' : '')}>
                <button
                  className="tick"
                  onClick={() => setComplete(s.id, !done)}
                  aria-pressed={done}
                  aria-label={done ? `Desmarcar ${s.title}` : `Marcar ${s.title} como concluída`}
                  title={done ? 'Desmarcar aula' : 'Marcar como concluída'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4 9-9" /></svg>
                </button>
                <Link to={`/aula/${s.id}`} className="side__link" aria-current={current ? 'page' : undefined}>
                  <span className="side__title">{s.title}</span>
                  <span className="side__meta">
                    {current ? 'Assistindo agora' : `Aula ${i + 1}`}
                    {s.duration_minutes ? `, ${formatMinutes(s.duration_minutes)}` : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>

        {(prev || next) && (
          <div className="lesson__nav">
            {prev ? (
              <Link className="btn btn--ghost btn--sm" to={`/aula/${prev.id}`}>
                Aula anterior
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="btn btn--primary btn--sm" to={`/aula/${next.id}`}>
                Próxima aula
              </Link>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
