import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { loadCourse } from '../lib/catalog'
import { canEditCourse } from '../lib/roles'
import { formatMinutes } from '../lib/video'
import { toast, toastError } from '../lib/toast'
import VideoPlayer from '../components/VideoPlayer'
import ChecklistPanel from '../components/ChecklistPanel'
import DocumentsPanel from '../components/DocumentsPanel'
import CommentsPanel from '../components/CommentsPanel'
import NotesPanel from '../components/NotesPanel'
import ModuleOutline from '../components/ModuleOutline'
import ProgressBar from '../components/ProgressBar'
import SaveButton from '../components/SaveButton'

export default function LessonPage() {
  const { lessonId } = useParams()
  const [params, setParams] = useSearchParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(undefined)
  const [course, setCourse] = useState(null)
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState({ checklist: null, docs: null, comments: null })
  const tab = params.get('aba') || 'checklist'
  const setTab = (t) => setParams(t === 'checklist' ? {} : { aba: t }, { replace: true })

  useEffect(() => {
    let active = true
    setLesson(undefined)
    ;(async () => {
      try {
      const { data: l, error } = await supabase
        .from('lessons')
        .select('*, courses(id, title, created_by)')
        .eq('id', lessonId)
        .maybeSingle()
      if (!active) return
      if (error) toastError(error)
      if (!l) return setLesson(null)
      const c = await loadCourse(l.course_id, user.id, canEditCourse(profile, l.courses))
      if (!active) return
      setLesson(l)
      setCourse(c)
      supabase
        .from('lesson_progress')
        .upsert(
          { user_id: user.id, lesson_id: l.id, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,lesson_id' }
        )
        .then(() => {})
      } catch (err) {
        if (!active) return
        toastError(err)
        setLesson(null)
      }
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
        <Link className="btn btn--primary" to="/">Voltar ao Resumo</Link>
      </div>
    )

  const ordered = course?.lessons || []
  const idx = ordered.findIndex((s) => s.id === lesson.id)
  const prev = ordered[idx - 1]
  const next = ordered[idx + 1]
  const module = course?.modules.find((m) => m.lessons.some((l) => l.id === lesson.id))
  const progress = course?.progressByLesson || new Map()
  const completed = Boolean(progress.get(lesson.id)?.completed_at)
  const doneCount = ordered.filter((s) => progress.get(s.id)?.completed_at).length
  const pct = ordered.length ? Math.round((doneCount / ordered.length) * 100) : 0
  const canEdit = canEditCourse(profile, lesson.courses)

  async function setComplete(id, value) {
    const completed_at = value ? new Date().toISOString() : null
    const before = course.progressByLesson
    const map = new Map(before)
    map.set(id, { ...(map.get(id) || {}), lesson_id: id, completed_at })
    setCourse((c) => ({ ...c, progressByLesson: map }))
    const { error } = await supabase
      .from('lesson_progress')
      .upsert({ user_id: user.id, lesson_id: id, completed_at, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' })
    if (error) {
      setCourse((c) => ({ ...c, progressByLesson: before }))
      toastError(error)
      return false
    }
    return true
  }

  async function completeAndNext() {
    if (completed) return next ? navigate(`/aula/${next.id}`) : null
    if (await setComplete(lesson.id, true)) {
      toast('Aula concluída.')
      if (next) navigate(`/aula/${next.id}`)
    }
  }

  const tabs = [
    lesson.description && { id: 'descricao', label: 'Descrição' },
    { id: 'checklist', label: 'Checklist', badge: counts.checklist?.total ? `${counts.checklist.done}/${counts.checklist.total}` : null },
    { id: 'docs', label: 'Materiais', badge: counts.docs || null },
    { id: 'comments', label: 'Comentários', badge: counts.comments || null },
    { id: 'anotacoes', label: 'Anotações' },
  ].filter(Boolean)

  return (
    <div className="lesson">
      <div className="lesson__main">
        <div className="lesson__titlebar">
          <div>
            <p className="lesson__module">
              <Link to={`/treinamento/${lesson.course_id}`}>{course?.title}</Link>
              {module && <> / {module.title}</>}
            </p>
            <h1>{lesson.title}</h1>
          </div>
          <div className="lesson__tools">
            {canEdit && (
              <Link className="btn btn--ghost btn--sm" to={`/admin/aula/${lesson.id}`}>Editar aula</Link>
            )}
            <SaveButton lessonId={lesson.id} />
          </div>
        </div>

        <VideoPlayer provider={lesson.video_provider} videoRef={lesson.video_ref} title={lesson.title} />

        <div className="lesson__bar">
          <span className="lesson__pos mono">
            {String(idx + 1).padStart(2, '0')}/{String(ordered.length).padStart(2, '0')}
            {lesson.duration_minutes ? `, ${formatMinutes(lesson.duration_minutes)}` : ''}
          </span>
          <div className="lesson__actions">
            {prev && <Link className="btn btn--ghost btn--sm" to={`/aula/${prev.id}`}>Anterior</Link>}
            {completed ? (
              <button className="btn btn--done btn--sm" onClick={() => setComplete(lesson.id, false)} title="Clique para desmarcar">
                Aula concluída
              </button>
            ) : (
              <button className="btn btn--primary btn--sm" onClick={completeAndNext}>
                {next ? 'Concluir e avançar' : 'Concluir aula'}
              </button>
            )}
            {next && <Link className="btn btn--ghost btn--sm" to={`/aula/${next.id}`}>Próxima</Link>}
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Recursos da aula">
          {tabs.map((t) => (
            <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
              className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.badge != null && <span className="tabs__badge">{t.badge}</span>}
            </button>
          ))}
        </div>
        {lesson.description && (
          <div role="tabpanel" id="panel-descricao" aria-labelledby="tab-descricao" hidden={tab !== 'descricao'}>
            <p className="lesson__desc">{lesson.description}</p>
          </div>
        )}
        <div role="tabpanel" id="panel-checklist" aria-labelledby="tab-checklist" hidden={tab !== 'checklist'}>
          <ChecklistPanel lessonId={lesson.id} onCountChange={setChecklistCount} />
        </div>
        <div role="tabpanel" id="panel-docs" aria-labelledby="tab-docs" hidden={tab !== 'docs'}>
          <DocumentsPanel lessonId={lesson.id} onCountChange={setDocsCount} />
        </div>
        <div role="tabpanel" id="panel-comments" aria-labelledby="tab-comments" hidden={tab !== 'comments'}>
          <CommentsPanel lessonId={lesson.id} onCountChange={setCommentsCount} canModerate={canEdit} />
        </div>
        <div role="tabpanel" id="panel-anotacoes" aria-labelledby="tab-anotacoes" hidden={tab !== 'anotacoes'}>
          {tab === 'anotacoes' && <NotesPanel lessonId={lesson.id} />}
        </div>
      </div>

      <aside className="lesson__side" aria-label="Conteúdo do treinamento">
        <div className="side__head">
          <h2>{course?.title}</h2>
          <ProgressBar value={pct} label="Progresso no treinamento" />
          <p className="side__stat">
            <span className="mono">{pct}%</span> concluído: {doneCount} de {ordered.length} aulas
          </p>
          <div className="side__search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar aula" aria-label="Procurar aula" />
          </div>
        </div>
        {course && (
          <div className="side__scroll">
            <ModuleOutline course={course} currentLessonId={lesson.id} onToggle={setComplete} query={query} />
          </div>
        )}
      </aside>
    </div>
  )
}
