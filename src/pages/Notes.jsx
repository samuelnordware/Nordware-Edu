import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/video'
import { toastError } from '../lib/toast'

export default function Notes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState(null)

  useEffect(() => {
    supabase
      .from('lesson_notes')
      .select('id, body, updated_at, lessons(id, title, courses(title))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toastError(error)
        setNotes((data || []).filter((n) => n.lessons))
      })
  }, [user.id])

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Minhas anotações</h1>
          <p className="muted">Tudo o que você anotou nas aulas. Só você vê estas anotações.</p>
        </div>
      </header>
      {!notes && <div className="page-loading" aria-busy="true" />}
      {notes && !notes.length && (
        <p className="empty">Nenhuma anotação ainda. Abra uma aula e use a aba Anotações.</p>
      )}
      <ul className="notes-list">
        {notes?.map((n) => (
          <li key={n.id}>
            <div className="notes-list__head">
              <div>
                <strong>{n.lessons.title}</strong>
                <small>{n.lessons.courses?.title}</small>
              </div>
              <time className="mono" dateTime={n.updated_at}>{timeAgo(n.updated_at)}</time>
            </div>
            <p>{n.body}</p>
            <Link className="btn btn--ghost btn--sm" to={`/aula/${n.lessons.id}?aba=anotacoes`}>Abrir na aula</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
