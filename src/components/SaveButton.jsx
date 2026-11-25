import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast, toastError } from '../lib/toast'

export default function SaveButton({ lessonId }) {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('saved_lessons')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .then(({ data }) => setSaved(Boolean(data?.length)))
  }, [lessonId, user.id])

  async function toggle() {
    const next = !saved
    setSaved(next)
    const { error } = next
      ? await supabase.from('saved_lessons').insert({ user_id: user.id, lesson_id: lessonId })
      : await supabase.from('saved_lessons').delete().eq('user_id', user.id).eq('lesson_id', lessonId)
    if (error) {
      setSaved(!next)
      return toastError(error)
    }
    toast(next ? 'Aula salva. Ela aparece em Aulas salvas.' : 'Aula removida das salvas.')
  }

  return (
    <button
      className={'save-btn' + (saved ? ' is-on' : '')}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remover das aulas salvas' : 'Salvar aula'}
      title={saved ? 'Remover das aulas salvas' : 'Salvar aula'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" /></svg>
    </button>
  )
}
