import { useEffect, useState } from 'react'

const KEY = 'nw-theme'

function current() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(current)

  useEffect(() => {
    const onChange = (e) => setTheme(e.detail)
    window.addEventListener('nw-theme', onChange)
    return () => window.removeEventListener('nw-theme', onChange)
  }, [])

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* armazenamento indisponivel */
    }
    window.dispatchEvent(new CustomEvent('nw-theme', { detail: next }))
  }

  return { theme, toggle }
}
