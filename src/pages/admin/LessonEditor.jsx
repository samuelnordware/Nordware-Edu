import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { safeName, uploadResumable, uploadSimple } from '../../lib/upload'
import { embedUrl, formatBytes, vimeoParts, youTubeId } from '../../lib/video'
import { toast, toastError } from '../../lib/toast'
import VideoPlayer from '../../components/VideoPlayer'
import ProgressBar from '../../components/ProgressBar'

const SOURCES = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'vimeo', label: 'Vimeo' },
  { id: 'upload', label: 'Enviar do computador' },
]

export default function LessonEditor() {
  const { lessonId } = useParams()
  const [params] = useSearchParams()
  const isNew = lessonId === 'nova'
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [upload, setUpload] = useState(null) // { name, size, pct }
  const [modules, setModules] = useState([])

  useEffect(() => {
    if (isNew) {
      const courseId = Number(params.get('curso'))
      if (!courseId) return navigate('/admin/cursos')
      setForm({
        course_id: courseId,
        title: '',
        description: '',
        video_provider: 'youtube',
        video_ref: '',
        duration_minutes: '',
        is_published: true,
        sort_order: 999,
        module_id: Number(params.get('modulo')) || null,
      })
      return
    }
    supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toastError(error || 'Aula não encontrada.')
          return navigate('/admin/cursos')
        }
        setForm({ ...data, duration_minutes: data.duration_minutes ?? '' })
      })
  }, [lessonId, isNew, params, navigate])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!form?.course_id) return
    supabase.from('modules').select('id, title').eq('course_id', form.course_id).order('sort_order').order('id')
      .then(({ data }) => {
        setModules(data || [])
        if (data?.length) setForm((f) => (f.module_id ? f : { ...f, module_id: data[0].id }))
      })
  }, [form?.course_id])

  if (!form) return <div className="page-loading" aria-busy="true" />

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const refValid =
    form.video_provider === 'youtube'
      ? Boolean(youTubeId(form.video_ref))
      : form.video_provider === 'vimeo'
        ? Boolean(vimeoParts(form.video_ref))
        : Boolean(form.video_ref)

  async function pickVideo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUpload({ name: file.name, size: file.size, pct: 0 })
    try {
      const path = `${form.course_id}/${safeName(file.name)}`
      await uploadResumable({
        bucket: 'lesson-videos',
        path,
        file,
        onProgress: (pct) => setUpload((u) => ({ ...u, pct })),
      })
      setForm((f) => ({ ...f, video_ref: path }))
      setUpload((u) => ({ ...u, pct: 100, done: true }))
      toast('Vídeo enviado. Salve a aula para publicar.')
    } catch (err) {
      setUpload(null)
      toastError(err)
    }
  }

  async function save(e) {
    e.preventDefault()
    if (!refValid) return toastError('Informe um vídeo válido antes de salvar.')
    setSaving(true)
    let sort = form.sort_order
    if (isNew) {
      let q = supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', form.course_id)
      q = form.module_id ? q.eq('module_id', form.module_id) : q.is('module_id', null)
      const { count } = await q
      sort = (count || 0) + 1
    }
    const payload = {
      course_id: form.course_id,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      video_provider: form.video_provider,
      video_ref: form.video_ref.trim(),
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      is_published: form.is_published,
      sort_order: sort,
      module_id: form.module_id ? Number(form.module_id) : null,
    }
    const res = isNew
      ? await supabase.from('lessons').insert(payload).select('id').single()
      : await supabase.from('lessons').update(payload).eq('id', lessonId).select('id').single()
    setSaving(false)
    if (res.error) return toastError(res.error)
    toast('Aula salva.')
    if (isNew) navigate(`/admin/aula/${res.data.id}`, { replace: true })
  }

  async function remove() {
    if (!window.confirm('Excluir esta aula com checklist, documentos e comentários?')) return
    const { data: docs } = await supabase.from('lesson_documents').select('storage_path').eq('lesson_id', lessonId)
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
    if (error) return toastError(error)
    if (docs?.length) await supabase.storage.from('lesson-documents').remove(docs.map((d) => d.storage_path))
    if (form.video_provider === 'upload') await supabase.storage.from('lesson-videos').remove([form.video_ref])
    toast('Aula excluída.')
    navigate(`/admin/treinamento/${form.course_id}`)
  }

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <Link to={`/admin/treinamento/${form.course_id}`} className="back">
            Voltar ao treinamento
          </Link>
          <h1>{isNew ? 'Nova aula' : form.title || 'Aula'}</h1>
        </div>
        {!isNew && (
          <Link className="btn btn--ghost" to={`/aula/${lessonId}`}>
            Ver como aluno
          </Link>
        )}
      </header>

      <form className="editor editor--lesson" onSubmit={save}>
        <div className="editor__fields">
          <fieldset className="field">
            <legend>Origem do vídeo</legend>
            <div className="segmented" role="radiogroup">
              {SOURCES.map((s) => (
                <label key={s.id} className={form.video_provider === s.id ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="provider"
                    value={s.id}
                    checked={form.video_provider === s.id}
                    onChange={() => {
                      setUpload(null)
                      setForm((f) => ({ ...f, video_provider: s.id, video_ref: '' }))
                    }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          {form.video_provider === 'youtube' && (
            <div className="field">
              <label htmlFor="yt">Link do vídeo no YouTube</label>
              <input
                id="yt"
                value={form.video_ref}
                onChange={set('video_ref')}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="hint">
                Use vídeos com visibilidade <strong>Não listado</strong>. Vídeos marcados como Privado no YouTube não
                podem ser exibidos fora do YouTube.
              </p>
            </div>
          )}

          {form.video_provider === 'vimeo' && (
            <div className="field">
              <label htmlFor="vm">Link do vídeo no Vimeo</label>
              <input id="vm" value={form.video_ref} onChange={set('video_ref')} placeholder="https://vimeo.com/123456789/abc123" />
              <p className="hint">
                Para vídeos privados, use o link com o código de compartilhamento e libere o domínio do site em
                Vimeo, Privacidade, Onde o vídeo pode ser incorporado.
              </p>
            </div>
          )}

          {form.video_provider === 'upload' && (
            <div className="field">
              <span className="label">Arquivo de vídeo (MP4, WebM ou MOV)</span>
              <label className="dropzone">
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={pickVideo} disabled={upload && !upload.done} />
                {upload ? (
                  <span className="dropzone__state">
                    <strong>{upload.name}</strong>
                    <small>
                      {formatBytes(upload.size)}, {upload.done ? 'enviado' : `${upload.pct}%`}
                    </small>
                    <ProgressBar value={upload.pct} label="Envio do vídeo" />
                  </span>
                ) : form.video_ref ? (
                  <span className="dropzone__state">
                    <strong>Vídeo atual: {form.video_ref.split('/').pop()}</strong>
                    <small>Clique para substituir</small>
                  </span>
                ) : (
                  <span className="dropzone__state">
                    <strong>Clique para escolher o vídeo</strong>
                    <small>O envio continua de onde parou se a conexão cair</small>
                  </span>
                )}
              </label>
            </div>
          )}

          <div className="field">
            <label htmlFor="lmod">Módulo</label>
            <select id="lmod" className="role-select" value={form.module_id || ''} onChange={set('module_id')}>
              <option value="">Sem módulo</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ltitle">Título da aula</label>
            <input id="ltitle" value={form.title} onChange={set('title')} required maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="ldesc">Descrição</label>
            <textarea id="ldesc" rows={3} value={form.description || ''} onChange={set('description')} />
          </div>
          <div className="field-row">
            <div className="field field--narrow">
              <label htmlFor="dur">Duração (min)</label>
              <input id="dur" type="number" min="0" value={form.duration_minutes} onChange={set('duration_minutes')} />
            </div>
            <label className="switch switch--inline">
              <input type="checkbox" checked={form.is_published} onChange={set('is_published')} />
              <span aria-hidden="true" />
              Aula visível para os alunos
            </label>
          </div>
          <div className="editor__actions">
            {!isNew && (
              <button type="button" className="btn btn--danger" onClick={remove}>
                Excluir aula
              </button>
            )}
            <button className="btn btn--primary" disabled={saving || (upload && !upload.done)}>
              {saving ? 'Salvando' : isNew ? 'Criar aula' : 'Salvar aula'}
            </button>
          </div>
        </div>

        <div className="editor__preview">
          <span className="label">Pré-visualização</span>
          {refValid && (form.video_provider !== 'upload' || !upload || upload.done) ? (
            <VideoPlayer
              key={form.video_provider + form.video_ref}
              provider={form.video_provider}
              videoRef={form.video_ref.trim()}
              title="Pré-visualização"
            />
          ) : (
            <div className="player">
              <div className="player__msg">
                {form.video_provider === 'upload' ? 'Envie um vídeo para ver a prévia' : 'Cole um link válido para ver a prévia'}
              </div>
            </div>
          )}
          {form.video_provider !== 'upload' && refValid && (
            <p className="hint">Endereço de exibição: {embedUrl(form.video_provider, form.video_ref)}</p>
          )}
        </div>
      </form>

      {isNew ? (
        <p className="empty">Crie a aula para adicionar checklist e documentos.</p>
      ) : (
        <div className="editor-panels">
          <ChecklistEditor lessonId={Number(lessonId)} />
          <DocumentsEditor lessonId={Number(lessonId)} courseId={form.course_id} />
        </div>
      )}
    </div>
  )
}

function ChecklistEditor({ lessonId }) {
  const [items, setItems] = useState([])
  const [label, setLabel] = useState('')

  async function load() {
    const { data } = await supabase
      .from('checklist_items')
      .select('id, label, sort_order')
      .eq('lesson_id', lessonId)
      .order('sort_order')
      .order('id')
    setItems(data || [])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  async function add(e) {
    e.preventDefault()
    const text = label.trim()
    if (!text) return
    const { error } = await supabase
      .from('checklist_items')
      .insert({ lesson_id: lessonId, label: text, sort_order: items.length + 1 })
    if (error) return toastError(error)
    setLabel('')
    load()
  }

  async function rename(item, value) {
    const text = value.trim()
    if (!text || text === item.label) return
    const { error } = await supabase.from('checklist_items').update({ label: text }).eq('id', item.id)
    if (error) return toastError(error)
    toast('Item atualizado.')
    load()
  }

  async function remove(item) {
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id)
    if (error) return toastError(error)
    load()
  }

  async function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const list = [...items]
    ;[list[i], list[j]] = [list[j], list[i]]
    setItems(list)
    await Promise.all(
      list.map((it, k) => supabase.from('checklist_items').update({ sort_order: k + 1 }).eq('id', it.id))
    )
  }

  return (
    <section className="panel" aria-labelledby="ce-title">
      <h2 id="ce-title">Checklist da aula</h2>
      <p className="muted">Cada aluno marca os itens no próprio ritmo. Clique em um item para editar o texto.</p>
      <ol className="edit-list">
        {items.map((it, i) => (
          <li key={it.id}>
            <input
              defaultValue={it.label}
              aria-label={`Item ${i + 1}`}
              onBlur={(e) => rename(it, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
            </button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Mover para baixo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button className="icon-btn icon-btn--danger" onClick={() => remove(it)} aria-label="Remover item">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </li>
        ))}
      </ol>
      <form className="inline-form" onSubmit={add}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Novo item, por exemplo: Configurar a integração"
          aria-label="Novo item do checklist"
          maxLength={300}
        />
        <button className="btn btn--primary btn--sm" disabled={!label.trim()}>
          Adicionar item
        </button>
      </form>
    </section>
  )
}

function DocumentsEditor({ lessonId, courseId }) {
  const [docs, setDocs] = useState([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('lesson_documents')
      .select('id, name, storage_path, size_bytes')
      .eq('lesson_id', lessonId)
      .order('created_at')
    setDocs(data || [])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  async function addFiles(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    for (const file of files) {
      try {
        const path = `${courseId}/${lessonId}/${safeName(file.name)}`
        await uploadSimple({ bucket: 'lesson-documents', path, file })
        const { error } = await supabase.from('lesson_documents').insert({
          lesson_id: lessonId,
          name: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        if (error) {
          await supabase.storage.from('lesson-documents').remove([path])
          throw error
        }
      } catch (err) {
        toastError(err)
      }
    }
    setBusy(false)
    toast('Documentos adicionados.')
    load()
  }

  async function remove(doc) {
    if (!window.confirm(`Remover ${doc.name}?`)) return
    const { error } = await supabase.from('lesson_documents').delete().eq('id', doc.id)
    if (error) return toastError(error)
    await supabase.storage.from('lesson-documents').remove([doc.storage_path])
    load()
  }

  return (
    <section className="panel" aria-labelledby="de-title">
      <h2 id="de-title">Documentos da aula</h2>
      <p className="muted">PDFs, planilhas e apresentações de apoio. Limite de 50 MB por arquivo.</p>
      <ul className="docs">
        {docs.map((d) => (
          <li key={d.id}>
            <span className="docs__name">
              <strong>{d.name}</strong>
              <small>{formatBytes(d.size_bytes)}</small>
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => remove(d)}>
              Remover
            </button>
          </li>
        ))}
      </ul>
      {!docs.length && <p className="empty">Nenhum documento anexado.</p>}
      <label className="btn btn--ghost file-btn">
        {busy ? 'Enviando' : 'Adicionar documentos'}
        <input type="file" multiple onChange={addFiles} disabled={busy} />
      </label>
    </section>
  )
}
