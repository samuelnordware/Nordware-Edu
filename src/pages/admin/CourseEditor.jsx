import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, asset } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { safeName, uploadSimple } from '../../lib/upload'
import { formatMinutes } from '../../lib/video'
import { toast, toastError } from '../../lib/toast'
import { restRequest } from '../../lib/rest'

const EMPTY = {
  title: '',
  subtitle: '',
  description: '',
  category: '',
  cover_url: '',
  accent_color: '#13C98E',
  is_featured: false,
  is_published: false,
  sort_order: 0,
}

const PROVIDER = { youtube: 'YouTube', vimeo: 'Vimeo', upload: 'Arquivo enviado' }

export default function CourseEditor() {
  const { courseId } = useParams()
  const isNew = courseId === 'novo'
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(isNew ? EMPTY : null)
  const [lessons, setLessons] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY)
      setLessons([])
      return
    }
    ;(async () => {
      const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
      if (error || !data) {
        toastError(error || 'Treinamento não encontrado.')
        return navigate('/admin')
      }
      setForm(data)
      loadLessons()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  async function loadLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('id, title, video_provider, duration_minutes, is_published, sort_order')
      .eq('course_id', courseId)
      .order('sort_order')
      .order('id')
    setLessons(data || [])
  }

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function uploadCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `${user.id}/${safeName(file.name)}`
      await uploadSimple({ bucket: 'covers', path, file })
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      setForm((f) => ({ ...f, cover_url: data.publicUrl }))
      toast('Capa enviada. Salve para aplicar.')
    } catch (err) {
      toastError(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || null,
      description: form.description?.trim() || null,
      category: form.category?.trim() || null,
      cover_url: form.cover_url || null,
      accent_color: form.accent_color,
      is_featured: form.is_featured,
      is_published: form.is_published,
      sort_order: Number(form.sort_order) || 0,
    }
    try {
      const rows = isNew
        ? await restRequest('POST', 'courses', { body: { ...payload, created_by: user.id }, select: 'id' })
        : await restRequest('PATCH', 'courses', { filters: { id: courseId }, body: payload, select: 'id' })
      if (!rows.length) throw new Error('Sem permissão para salvar este treinamento.')
      toast('Treinamento salvo.')
      if (isNew) navigate(`/admin/treinamento/${rows[0].id}`, { replace: true })
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm('Excluir este treinamento e todas as aulas, checklists e comentários dele?')) return
    const { error } = await supabase.from('courses').delete().eq('id', courseId)
    if (error) return toastError(error)
    toast('Treinamento excluído.')
    navigate('/admin')
  }

  async function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= lessons.length) return
    const list = [...lessons]
    ;[list[i], list[j]] = [list[j], list[i]]
    const ordered = list.map((l, k) => ({ ...l, sort_order: k + 1 }))
    setLessons(ordered)
    const results = await Promise.all(
      [ordered[i], ordered[j]].map((l) => supabase.from('lessons').update({ sort_order: l.sort_order }).eq('id', l.id))
    )
    const err = results.find((r) => r.error)
    if (err) toastError(err.error)
  }

  if (!form) return <div className="page-loading" aria-busy="true" />

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <Link to="/admin" className="back">
            Treinamentos
          </Link>
          <h1>{isNew ? 'Novo treinamento' : form.title || 'Treinamento'}</h1>
        </div>
        {!isNew && (
          <Link className="btn btn--ghost" to={`/treinamento/${courseId}`}>
            Ver como aluno
          </Link>
        )}
      </header>

      <form className="editor" onSubmit={save}>
        <div className="editor__cover">
          <div className="cover-preview" style={{ '--accent': form.accent_color }}>
            {form.cover_url ? <img src={asset(form.cover_url)} alt="Capa atual" /> : <span>Sem capa</span>}
          </div>
          <label className="btn btn--ghost btn--block file-btn">
            {uploading ? 'Enviando capa' : 'Enviar capa (1600 x 900)'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadCover} disabled={uploading} />
          </label>
          <div className="field">
            <label htmlFor="cover_url">Ou URL da capa</label>
            <input id="cover_url" value={form.cover_url || ''} onChange={set('cover_url')} placeholder="https://" />
          </div>
        </div>

        <div className="editor__fields">
          <div className="field">
            <label htmlFor="title">Título</label>
            <input id="title" value={form.title} onChange={set('title')} required maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="subtitle">Subtítulo</label>
            <input id="subtitle" value={form.subtitle || ''} onChange={set('subtitle')} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" rows={4} value={form.description || ''} onChange={set('description')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="category">Categoria (vira uma fileira na página inicial)</label>
              <input id="category" value={form.category || ''} onChange={set('category')} placeholder="Produtos Nordware" />
            </div>
            <div className="field field--narrow">
              <label htmlFor="sort_order">Ordem</label>
              <input id="sort_order" type="number" value={form.sort_order} onChange={set('sort_order')} />
            </div>
            <div className="field field--narrow">
              <label htmlFor="accent">Cor</label>
              <input id="accent" type="color" value={form.accent_color} onChange={set('accent_color')} />
            </div>
          </div>
          <div className="toggles">
            <label className="switch">
              <input type="checkbox" checked={form.is_published} onChange={set('is_published')} />
              <span aria-hidden="true" />
              Publicado para os alunos
            </label>
            <label className="switch">
              <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} />
              <span aria-hidden="true" />
              Destaque na página inicial
            </label>
          </div>
          <div className="editor__actions">
            {!isNew && (
              <button type="button" className="btn btn--danger" onClick={remove}>
                Excluir treinamento
              </button>
            )}
            <button className="btn btn--primary" disabled={saving}>
              {saving ? 'Salvando' : isNew ? 'Criar treinamento' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>

      {!isNew && (
        <section className="admin-lessons" aria-labelledby="al-title">
          <div className="admin__head">
            <h2 id="al-title">Aulas</h2>
            <Link className="btn btn--primary btn--sm" to={`/admin/aula/nova?curso=${courseId}`}>
              Nova aula
            </Link>
          </div>
          {!lessons.length && <p className="empty">Este treinamento ainda não tem aulas.</p>}
          <ol className="admin-lesson-list">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <span className="lesson-list__num">{i + 1}</span>
                <div className="admin-lesson-list__info">
                  <strong>{l.title}</strong>
                  <small className="muted">
                    {PROVIDER[l.video_provider]}
                    {l.duration_minutes ? `, ${formatMinutes(l.duration_minutes)}` : ''}
                    {!l.is_published ? ', oculta' : ''}
                  </small>
                </div>
                <div className="admin-lesson-list__ctrl">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === lessons.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  <Link className="btn btn--ghost btn--sm" to={`/admin/aula/${l.id}`}>
                    Editar
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
