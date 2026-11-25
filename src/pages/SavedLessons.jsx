import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, asset } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes, timeAgo } from '../lib/video'
import { toastError } from '../lib/toast'

export default function SavedLessons() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('saved_lessons')
      .select('lesson_id, created_at, lessons(id, title, duration_minutes, modules(title), courses(id, title, cover_url))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toastError(error)
    setItems((data || []).filter((d) => d.lessons))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function remove(id) {
    const { error } = await supabase.from('saved_lessons').delete().eq('user_id', user.id).eq('lesson_id', id)
    if (error) return toastError(error)
    load()
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Aulas salvas</h1>
          <p className="muted">Use o marcador na página da aula para guardar aqui o que quer rever.</p>
        </div>
      </header>
      {!items && <div className="page-loading" aria-busy="true" />}
      {items && !items.length && <p className="empty">Você ainda não salvou nenhuma aula.</p>}
      <ul className="stack-list">
        {items?.map(({ lessons: l, created_at }) => (
          <li key={l.id}>
            <Link to={`/aula/${l.id}`} className="stack-list__main">
              <span className="stack-list__thumb">{l.courses?.cover_url && <img src={asset(l.courses.cover_url)} alt="" />}</span>
              <span className="stack-list__text">
                <strong>{l.title}</strong>
                <small>
                  {l.courses?.title}
                  {l.modules?.title ? `, ${l.modules.title}` : ''}
                  {l.duration_minutes ? `, ${formatMinutes(l.duration_minutes)}` : ''}
                </small>
                <small className="mono">Salva {timeAgo(created_at)}</small>
              </span>
            </Link>
            <button className="btn btn--ghost btn--sm" onClick={() => remove(l.id)}>Remover</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
