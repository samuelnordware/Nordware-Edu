import { useEffect, useMemo, useState } from 'react'
import { supabase, asset } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEFAULT_SITE, loadSite, loginImages } from '../../lib/site'
import { fitImage } from '../../lib/image'
import { restRequest } from '../../lib/rest'
import { ROLE_LABEL } from '../../lib/roles'
import { toast, toastError } from '../../lib/toast'
import Avatar from '../../components/Avatar'

async function uploadSiteImage(file, folder) {
  const blob = await fitImage(file, 1600)
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const { error } = await supabase.storage.from('site').upload(path, blob, { contentType: blob.type })
  if (error) throw error
  return supabase.storage.from('site').getPublicUrl(path).data.publicUrl
}

export default function SiteSettings() {
  const { user } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)

  useEffect(() => {
    loadSite(true).then((s) => setForm({ ...DEFAULT_SITE, ...s, login_text: s.login_text || '', hero_image_url: s.hero_image_url || '' }))
  }, [])

  if (!form) return <div className="page-loading" aria-busy="true" />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function addLoginImages(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setUploading('login')
    try {
      const urls = []
      for (const f of files) urls.push(await uploadSiteImage(f, 'login'))
      setForm((s) => ({ ...s, login_images: [...s.login_images, ...urls] }))
      toast('Imagens adicionadas. Salve para publicar.')
    } catch (err) {
      toastError(err)
    } finally {
      setUploading(null)
    }
  }

  function moveImage(i, dir) {
    const j = i + dir
    setForm((s) => {
      const list = [...s.login_images]
      if (j < 0 || j >= list.length) return s
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...s, login_images: list }
    })
  }

  function removeImage(i) {
    setForm((s) => ({ ...s, login_images: s.login_images.filter((_, k) => k !== i) }))
  }

  async function setHeroImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading('hero')
    try {
      const url = await uploadSiteImage(file, 'destaque')
      setForm((s) => ({ ...s, hero_image_url: url }))
      toast('Imagem enviada. Salve para publicar.')
    } catch (err) {
      toastError(err)
    } finally {
      setUploading(null)
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const rows = await restRequest('PATCH', 'site_settings', {
        filters: { id: 1 },
        select: 'id',
        body: {
          login_title: form.login_title.trim() || DEFAULT_SITE.login_title,
          login_text: form.login_text.trim() || null,
          login_images: form.login_images,
          hero_greeting: form.hero_greeting.trim(),
          hero_image_url: form.hero_image_url || null,
          updated_by: user.id,
        },
      })
      // Nenhuma linha alterada = sem permissao (o RLS nao gera erro)
      if (!rows.length) {
        throw new Error('Sem permissão para salvar. Saia e entre novamente para atualizar seu acesso de ADM Master.')
      }
      await loadSite(true)
      toast('Personalização publicada.')
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const preview = loginImages(form)

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Personalizar site</h1>
          <p className="muted">Somente ADM Master vê esta página. As mudanças valem para todos ao salvar.</p>
        </div>
      </header>

      <form onSubmit={save} className="settings">
        <section className="panel" aria-labelledby="st-login">
          <h2 id="st-login">Tela de login</h2>
          <div className="field">
            <label htmlFor="lt">Título</label>
            <input id="lt" value={form.login_title} onChange={set('login_title')} maxLength={120} required />
          </div>
          <div className="field">
            <label htmlFor="lx">Texto de apoio (opcional)</label>
            <textarea id="lx" rows={2} value={form.login_text} onChange={set('login_text')} maxLength={300}
              placeholder="Por exemplo: Acesso exclusivo para clientes e colaboradores Nordware." />
          </div>

          <div className="field">
            <span className="label">Imagens do mural</span>
            <p className="hint">
              {form.login_images.length
                ? 'As imagens se repetem em mosaico ao lado do formulário. Use formato horizontal (16:9).'
                : 'Sem imagens próprias, o mural usa as capas Enviando, Roter e Bahn.'}
            </p>
            <ul className="thumbs">
              {form.login_images.map((url, i) => (
                <li key={url + i}>
                  <img src={asset(url)} alt={`Imagem ${i + 1} do mural`} />
                  <div className="thumbs__ctrl">
                    <button type="button" className="icon-btn" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Mover para a esquerda">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                    </button>
                    <button type="button" className="icon-btn" onClick={() => moveImage(i, 1)} disabled={i === form.login_images.length - 1} aria-label="Mover para a direita">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeImage(i)} aria-label="Remover imagem">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <label className="btn btn--ghost file-btn">
              {uploading === 'login' ? 'Enviando imagens' : 'Adicionar imagens'}
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={addLoginImages} disabled={!!uploading} />
            </label>
          </div>

          <div className="login-preview" aria-label="Prévia da tela de login">
            <div className="login-preview__wall">
              {Array.from({ length: 6 }, (_, i) => (
                <img key={i} src={asset(preview[i % preview.length])} alt="" />
              ))}
            </div>
            <div className="login-preview__panel">
              <strong>{form.login_title || DEFAULT_SITE.login_title}</strong>
              {form.login_text && <small>{form.login_text}</small>}
              <span className="login-preview__field" />
              <span className="login-preview__field" />
              <span className="login-preview__btn" />
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="st-home">
          <h2 id="st-home">Página inicial</h2>
          <div className="field">
            <label htmlFor="hg">Saudação acima do destaque</label>
            <input id="hg" value={form.hero_greeting} onChange={set('hero_greeting')} maxLength={80} />
            <p className="hint">Use {'{nome}'} para o primeiro nome da pessoa. Deixe em branco para ocultar.</p>
          </div>
          <div className="field">
            <span className="label">Imagem do destaque</span>
            <div className="hero-pick">
              {form.hero_image_url ? (
                <img src={asset(form.hero_image_url)} alt="Imagem atual do destaque" />
              ) : (
                <span className="muted">Usando a capa do treinamento em destaque</span>
              )}
            </div>
            <div className="inline-actions">
              <label className="btn btn--ghost file-btn">
                {uploading === 'hero' ? 'Enviando imagem' : form.hero_image_url ? 'Trocar imagem' : 'Enviar imagem própria'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={setHeroImage} disabled={!!uploading} />
              </label>
              {form.hero_image_url && (
                <button type="button" className="btn btn--ghost" onClick={() => setForm((s) => ({ ...s, hero_image_url: '' }))}>
                  Voltar a usar a capa do treinamento
                </button>
              )}
            </div>
            <p className="hint">
              O treinamento em destaque é escolhido na edição de cada treinamento, na opção Destaque na página inicial.
            </p>
          </div>
        </section>

        <div className="settings__save">
          <button className="btn btn--primary" disabled={saving || !!uploading}>
            {saving ? 'Publicando' : 'Salvar e publicar'}
          </button>
        </div>
      </form>

      <MasterAccess />
    </div>
  )
}

function MasterAccess() {
  const { user } = useAuth()
  const [people, setPeople] = useState(null)
  const [query, setQuery] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, is_master')
      .order('full_name')
    if (error) toastError(error)
    setPeople(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const masters = useMemo(() => (people || []).filter((p) => p.is_master), [people])
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (people || [])
      .filter((p) => !p.is_master && ((p.full_name || '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [people, query])

  async function setMaster(p, value) {
    const verb = value ? 'Conceder' : 'Remover'
    if (!window.confirm(`${verb} o acesso de ADM Master ${value ? 'para' : 'de'} ${p.full_name || p.email}?`)) return
    const { error } = await supabase.from('profiles').update({ is_master: value }).eq('id', p.id)
    if (error) return toastError(error)
    toast(value ? 'Acesso de ADM Master concedido.' : 'Acesso de ADM Master removido.')
    setQuery('')
    load()
  }

  return (
    <section className="panel master-access" aria-labelledby="st-master">
      <h2 id="st-master">Quem é ADM Master</h2>
      <p className="muted">
        ADM Master personaliza o site e concede este acesso a outras pessoas. Ninguém consegue remover o próprio acesso.
      </p>
      <ul className="people">
        {masters.map((p) => (
          <li key={p.id}>
            <Avatar name={p.full_name || p.email} url={p.avatar_url} size={34} />
            <span>
              <strong>{p.full_name || p.email.split('@')[0]}</strong>
              <small className="muted">
                {p.email}, {ROLE_LABEL[p.role]}
              </small>
            </span>
            {p.id === user.id ? (
              <span className="chip chip--brand">Você</span>
            ) : (
              <button className="btn btn--ghost btn--sm" onClick={() => setMaster(p, false)}>
                Remover acesso
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="mq">Conceder acesso</label>
        <input id="mq" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por nome ou e-mail" autoComplete="off" />
      </div>
      {query.trim() && !candidates.length && <p className="empty">Nenhum usuário encontrado. Crie a pessoa em Usuários primeiro.</p>}
      <ul className="people">
        {candidates.map((p) => (
          <li key={p.id}>
            <Avatar name={p.full_name || p.email} url={p.avatar_url} size={34} />
            <span>
              <strong>{p.full_name || p.email.split('@')[0]}</strong>
              <small className="muted">
                {p.email}, {ROLE_LABEL[p.role]}
              </small>
            </span>
            <button className="btn btn--primary btn--sm" onClick={() => setMaster(p, true)}>
              Tornar ADM Master
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
