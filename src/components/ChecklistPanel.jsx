import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toastError } from '../lib/toast'
import ProgressBar from './ProgressBar'

export default function ChecklistPanel({ lessonId, onCountChange }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [done, setDone] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: list } = await supabase
        .from('checklist_items')
        .select('id, label, sort_order')
        .eq('lesson_id', lessonId)
        .order('sort_order')
      const ids = (list || []).map((i) => i.id)
      let doneIds = []
      if (ids.length) {
        const { data } = await supabase
          .from('checklist_progress')
          .select('item_id')
          .eq('user_id', user.id)
          .in('item_id', ids)
        doneIds = (data || []).map((d) => d.item_id)
      }
      if (!active) return
      setItems(list || [])
      setDone(new Set(doneIds))
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [lessonId, user.id])

  useEffect(() => {
    onCountChange?.({ total: items.length, done: done.size })
  }, [items.length, done.size, onCountChange])

  async function toggle(item) {
    const isDone = done.has(item.id)
    const next = new Set(done)
    isDone ? next.delete(item.id) : next.add(item.id)
    setDone(next)
    const { error } = isDone
      ? await supabase.from('checklist_progress').delete().eq('user_id', user.id).eq('item_id', item.id)
      : await supabase.from('checklist_progress').insert({ user_id: user.id, item_id: item.id })
    if (error) {
      setDone(done)
      toastError(error)
    }
  }

  if (loading) return <p className="muted">Carregando checklist</p>
  if (!items.length) return <p className="empty">Esta aula não tem checklist.</p>

  const pct = (done.size / items.length) * 100
  return (
    <div className="checklist">
      <div className="checklist__summary">
        <span>
          {done.size} de {items.length} concluídos
        </span>
        <ProgressBar value={pct} label="Checklist da aula" />
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label className={done.has(item.id) ? 'is-done' : ''}>
              <input type="checkbox" checked={done.has(item.id)} onChange={() => toggle(item)} />
              <span className="check" aria-hidden="true" />
              <span className="checklist__label">{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
