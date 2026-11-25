import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { embedUrl } from '../lib/video'

export default function VideoPlayer({ provider, videoRef, title }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setError(null)
    setSrc(null)
    if (provider === 'upload') {
      supabase.storage
        .from('lesson-videos')
        .createSignedUrl(videoRef, 60 * 60 * 3)
        .then(({ data, error: err }) => {
          if (!active) return
          if (err) setError('O vídeo não está disponível. Avise o administrador.')
          else setSrc(data.signedUrl)
        })
    } else {
      const url = embedUrl(provider, videoRef)
      if (url) setSrc(url)
      else setError('O link do vídeo é inválido. Avise o administrador.')
    }
    return () => {
      active = false
    }
  }, [provider, videoRef])

  return (
    <div className="player">
      {error && <div className="player__msg">{error}</div>}
      {!error && !src && <div className="player__msg">Carregando vídeo</div>}
      {src && provider === 'upload' && (
        <video src={src} controls controlsList="nodownload" playsInline preload="metadata" />
      )}
      {src && provider !== 'upload' && (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  )
}
