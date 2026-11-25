import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { canEditCourse, ROLE_LABEL } from '../../lib/roles'
import { timeAgo } from '../../lib/video'
import { toast, toastError } from '../../lib/toast'
import Avatar from '../../components/Avatar'

export default function AdminComments() {
  const { profile } = useAuth()
  const [items, setItems] = useState(null)
  const [course, setCourse] = useState('all')

  async function load() {
    const { data, error } = await supabase
      .from('lesson_comments')
      .select('id, body, author_name, author_role, author_avatar, created_at, lesson_id, lessons(title, course_id, courses(id, title, created_by))')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) toastError(error)
    setItems((data || []).filter((c) => c.lessons && canEditCourse(profile, c.lessons.courses)))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const courses = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach((c) => m.set(c.lessons.courses.id, c.lessons.courses.title))
    return [...m.entries()]
  }, [items])
  const list = (items || []).filter((c) => course === 'all' || String(c.lessons.courses.id) === course)

  async function remove(c) {
    if (!window.confirm('Excluir este comentário?')) return
    const { error } = await supabase.from('lesson_comments').delete().eq('id', c.id)
    if (error) return toastError(error)
    toast('Comentário excluído.')
    load()
  }

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Comentários</h1>
          <p className="muted">Dúvidas e observações dos alunos nos treinamentos que você gerencia.</p>
        </div>
        <select className="role-select" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filtrar por treinamento">
          <option value="all">Todos os treinamentos</option>
          {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </header>
      {!items && <div className="page-loading" aria-busy="true" />}
      {items && !list.length && <p className="empty">Nenhum comentário por aqui.</p>}
      <ul className="feed feed--panel">
        {list.map((c) => (
          <li key={c.id}>
            <Avatar name={c.author_name} url={c.author_avatar} size={36} />
            <div>
              <p className="feed__meta">
                <strong>{c.author_name}</strong>
                {c.author_role !== 'student' && ROLE_LABEL[c.author_role] && <span className="chip chip--brand">{ROLE_LABEL[c.author_role]}</span>}
                <span className="muted">em {c.lessons.courses.title}, {c.lessons.title}</span>
              </p>
              <p className="feed__body">{c.body}</p>
              <div className="feed__actions">
                <time className="mono">{timeAgo(c.created_at)}</time>
                <Link className="btn btn--ghost btn--sm" to={`/aula/${c.lesson_id}?aba=comments`}>Responder na aula</Link>
                <button className="btn btn--danger btn--sm" onClick={() => remove(c)}>Excluir</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
