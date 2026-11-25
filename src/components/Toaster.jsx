import { useEffect, useState } from 'react'

export default function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const onToast = (e) => {
      const id = Math.random().toString(36).slice(2)
      setItems((list) => [...list, { id, ...e.detail }])
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4200)
    }
    window.addEventListener('nw-toast', onToast)
    return () => window.removeEventListener('nw-toast', onToast)
  }, [])
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
