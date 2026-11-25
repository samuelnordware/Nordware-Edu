// Utilitarios para YouTube, Vimeo e arquivos enviados

export function youTubeId(input = '') {
  const v = input.trim()
  if (/^[\w-]{11}$/.test(v)) return v
  try {
    const u = new URL(v)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12)
    if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11)
    const m = u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/)
    if (m) return m[2]
  } catch {
    /* URL invalida */
  }
  return null
}

// Aceita vimeo.com/123, vimeo.com/123/hash, ?h=hash e player.vimeo.com/video/123
export function vimeoParts(input = '') {
  const v = input.trim()
  if (/^\d+$/.test(v)) return { id: v, hash: null }
  try {
    const u = new URL(v)
    if (!u.hostname.includes('vimeo.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => /^\d+$/.test(p))
    if (idx === -1) return null
    const id = parts[idx]
    const next = parts[idx + 1]
    const hash = u.searchParams.get('h') || (next && /^[a-f0-9]{6,}$/i.test(next) ? next : null)
    return { id, hash }
  } catch {
    return null
  }
}

export function embedUrl(provider, ref) {
  if (provider === 'youtube') {
    const id = youTubeId(ref)
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null
  }
  if (provider === 'vimeo') {
    const p = vimeoParts(ref)
    if (!p) return null
    const h = p.hash ? `h=${p.hash}&` : ''
    return `https://player.vimeo.com/video/${p.id}?${h}title=0&byline=0&portrait=0`
  }
  return null
}

export function youTubeThumb(ref) {
  const id = youTubeId(ref)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

export function formatMinutes(min) {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatBytes(b) {
  if (!b && b !== 0) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`
  return `${(b / 1073741824).toFixed(2)} GB`
}
