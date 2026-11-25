import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadCatalog } from '../lib/catalog'

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function openPalette() {
  window.dispatchEvent(new Event('nw-palette'))
}

// Busca global (Ctrl + K) por treinamentos, modulos e aulas
export default function CommandPalette() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(null)
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('nw-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('nw-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    setTimeout(() => input.current?.focus(), 0)
    loadCatalog(user.id).then((courses) => {
      const list = []
      courses.forEach((c) => {
        list.push({ kind: 'Treinamento', title: c.title, sub: `${c.stats.lessonCount} aulas`, to: `/treinamento/${c.id}` })
        c.modules.forEach((m) =>
          m.lessons.forEach((l) => list.push({ kind: 'Aula', title: l.title, sub: `${c.title}, ${m.title}`, to: `/aula/${l.id}` }))
        )
      })
      setItems(list)
    })
  }, [open, user.id])

  const results = useMemo(() => {
    if (!items) return []
    const q = norm(query.trim())
    const list = q ? items.filter((i) => norm(i.title + ' ' + i.sub).includes(q)) : items.filter((i) => i.kind === 'Treinamento')
    return list.slice(0, 8)
  }, [items, query])

  if (!open) return null

  const go = (item) => {
    setOpen(false)
    navigate(item.to)
  }

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar" onMouseDown={() => setOpen(false)}>
      <div className="palette__box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette__input">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              }
              if (e.key === 'Enter' && results[active]) go(results[active])
            }}
            placeholder="Procurar treinamentos e aulas"
            aria-label="Procurar treinamentos e aulas"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette__list" role="listbox">
          {!items && <li className="palette__empty">Carregando</li>}
          {items && !results.length && <li className="palette__empty">Nada encontrado para “{query}”.</li>}
          {results.map((r, i) => (
            <li key={r.to} role="option" aria-selected={i === active}>
              <button className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                <span className="palette__kind">{r.kind}</span>
                <span className="palette__text">
                  <strong>{r.title}</strong>
                  <small>{r.sub}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
