import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBytes } from '../lib/video'
import { toastError } from '../lib/toast'

function ext(name) {
  const m = name.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toUpperCase().slice(0, 4) : 'ARQ'
}

export default function DocumentsPanel({ lessonId, onCountChange }) {
  const [docs, setDocs] = useState(null)

  useEffect(() => {
    supabase
      .from('lesson_documents')
      .select('id, name, storage_path, size_bytes, created_at')
      .eq('lesson_id', lessonId)
      .order('created_at')
      .then(({ data }) => {
        setDocs(data || [])
        onCountChange?.(data?.length || 0)
      })
  }, [lessonId, onCountChange])

  async function download(doc) {
    const { data, error } = await supabase.storage
      .from('lesson-documents')
      .createSignedUrl(doc.storage_path, 120, { download: doc.name })
    if (error) return toastError(error)
    window.location.href = data.signedUrl
  }

  if (!docs) return <p className="muted">Carregando documentos</p>
  if (!docs.length) return <p className="empty">Esta aula não tem documentos.</p>

  return (
    <ul className="docs">
      {docs.map((d) => (
        <li key={d.id}>
          <span className="docs__ext">{ext(d.name)}</span>
          <span className="docs__name">
            <strong>{d.name}</strong>
            <small>{formatBytes(d.size_bytes)}</small>
          </span>
          <button className="btn btn--ghost btn--sm" onClick={() => download(d)}>
            Baixar
          </button>
        </li>
      ))}
    </ul>
  )
}
