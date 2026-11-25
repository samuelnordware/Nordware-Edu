import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/video'
import { toastError } from '../lib/toast'

export default function CommentsPanel({ lessonId, onCountChange }) {
  const { user, isAdmin } = useAuth()
  const [comments, setComments] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('lesson_comments')
      .select('id, user_id, author_name, author_role, body, created_at')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })
    setComments(data || [])
    onCountChange?.(data?.length || 0)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`comments-${lessonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lesson_comments', filter: `lesson_id=eq.${lessonId}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  async function submit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    const { error } = await supabase
      .from('lesson_comments')
      .insert({ lesson_id: Number(lessonId), user_id: user.id, body: text })
    setSending(false)
    if (error) return toastError(error)
    setBody('')
    load()
  }

  async function remove(c) {
    if (!window.confirm('Excluir este comentário?')) return
    const { error } = await supabase.from('lesson_comments').delete().eq('id', c.id)
    if (error) return toastError(error)
    load()
  }

  return (
    <div className="comments">
      <form onSubmit={submit} className="comments__form">
        <label htmlFor="comment" className="sr-only">
          Seu comentário
        </label>
        <textarea
          id="comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma dúvida ou observação sobre esta aula"
          maxLength={2000}
          rows={3}
        />
        <div className="comments__actions">
          <small className="muted">{body.length}/2000</small>
          <button className="btn btn--primary btn--sm" disabled={sending || !body.trim()}>
            {sending ? 'Publicando' : 'Publicar comentário'}
          </button>
        </div>
      </form>

      {!comments && <p className="muted">Carregando comentários</p>}
      {comments && !comments.length && <p className="empty">Nenhum comentário ainda. Comece a conversa.</p>}
      <ul className="comments__list">
        {comments?.map((c) => (
          <li key={c.id}>
            <div className="comments__avatar" aria-hidden="true">
              {(c.author_name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="comments__content">
              <div className="comments__meta">
                <strong>{c.author_name}</strong>
                {c.author_role === 'admin' && <span className="chip chip--brand">Instrutor</span>}
                <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
                {(c.user_id === user.id || isAdmin) && (
                  <button className="link-btn" onClick={() => remove(c)}>
                    Excluir
                  </button>
                )}
              </div>
              <p>{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
