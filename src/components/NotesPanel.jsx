import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/video'

// Anotacao pessoal da aula, salva automaticamente
export default function NotesPanel({ lessonId }) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('loading') // loading | idle | saving | saved | error
  const [savedAt, setSavedAt] = useState(null)
  const timer = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    first.current = true
    supabase
      .from('lesson_notes')
      .select('body, updated_at')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()
      .then(({ data }) => {
        setBody(data?.body || '')
        setSavedAt(data?.updated_at || null)
        setStatus('idle')
      })
  }, [lessonId, user.id])

  useEffect(() => {
    if (status === 'loading') return
    if (first.current) {
      first.current = false
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setStatus('saving')
      const text = body.trim()
      const { error } = text
        ? await supabase
            .from('lesson_notes')
            .upsert({ user_id: user.id, lesson_id: lessonId, body: text }, { onConflict: 'user_id,lesson_id' })
        : await supabase.from('lesson_notes').delete().eq('user_id', user.id).eq('lesson_id', lessonId)
      if (error) return setStatus('error')
      setSavedAt(new Date().toISOString())
      setStatus('saved')
    }, 900)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  return (
    <div className="notes">
      <label htmlFor="note" className="sr-only">Sua anotação</label>
      <textarea
        id="note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escreva aqui o que quer lembrar desta aula. Só você vê esta anotação."
        maxLength={5000}
        rows={7}
        disabled={status === 'loading'}
      />
      <p className="notes__status" aria-live="polite">
        {status === 'saving' && 'Salvando'}
        {status === 'saved' && 'Salvo automaticamente'}
        {status === 'error' && 'Não foi possível salvar. Verifique a conexão.'}
        {status === 'idle' && savedAt && `Última alteração ${timeAgo(savedAt)}`}
      </p>
    </div>
  )
}
