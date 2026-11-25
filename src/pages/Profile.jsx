import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { squareJpeg } from '../lib/image'
import { ROLE_LABEL } from '../lib/roles'
import { toast, toastError } from '../lib/toast'
import Avatar from '../components/Avatar'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  if (!profile) return <div className="page-loading" aria-busy="true" />

  async function changePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const blob = await squareJpeg(file)
      const folder = user.id
      const path = `${folder}/foto-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: upErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      if (upErr) throw upErr
      // remove fotos antigas
      const { data: old } = await supabase.storage.from('avatars').list(folder)
      const stale = (old || []).map((o) => `${folder}/${o.name}`).filter((p) => p !== path)
      if (stale.length) await supabase.storage.from('avatars').remove(stale)
      await refreshProfile()
      toast('Foto atualizada.')
    } catch (err) {
      toastError(err)
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto() {
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) return toastError(error)
    const { data: old } = await supabase.storage.from('avatars').list(user.id)
    if (old?.length) await supabase.storage.from('avatars').remove(old.map((o) => `${user.id}/${o.name}`))
    await refreshProfile()
    toast('Foto removida.')
  }

  async function saveName(e) {
    e.preventDefault()
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() || null }).eq('id', user.id)
    setSavingName(false)
    if (error) return toastError(error)
    await refreshProfile()
    toast('Nome atualizado.')
  }

  async function savePassword(e) {
    e.preventDefault()
    if (password !== confirm) return toastError('As senhas não conferem.')
    setSavingPass(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPass(false)
    if (error) return toastError(error)
    setPassword('')
    setConfirm('')
    toast('Senha alterada.')
  }

  return (
    <div className="admin profile">
      <header className="admin__head">
        <div>
          <h1>Meu perfil</h1>
          <p className="muted">
            {profile.email}, {ROLE_LABEL[profile.role]}
          </p>
        </div>
      </header>

      <div className="profile__grid">
        <section className="panel profile__photo" aria-labelledby="ph-title">
          <h2 id="ph-title">Foto</h2>
          <Avatar name={profile.full_name || profile.email} url={profile.avatar_url} size={128} />
          <label className="btn btn--primary file-btn">
            {uploading ? 'Enviando foto' : profile.avatar_url ? 'Trocar foto' : 'Enviar foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} disabled={uploading} />
          </label>
          {profile.avatar_url && (
            <button className="link-btn" onClick={removePhoto}>
              Remover foto
            </button>
          )}
          <p className="hint">JPG, PNG ou WebP. A imagem é recortada em formato quadrado.</p>
        </section>

        <div className="profile__forms">
          <form className="panel form" onSubmit={saveName}>
            <h2>Dados</h2>
            <div className="field">
              <label htmlFor="pname">Nome completo</label>
              <input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
            </div>
            <div className="editor__actions">
              <button className="btn btn--primary" disabled={savingName}>
                {savingName ? 'Salvando' : 'Salvar nome'}
              </button>
            </div>
          </form>

          <form className="panel form" onSubmit={savePassword}>
            <h2>Senha</h2>
            <div className="field-row">
              <div className="field">
                <label htmlFor="np1">Nova senha</label>
                <input id="np1" type="password" minLength={8} required value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="np2">Repita a nova senha</label>
                <input id="np2" type="password" minLength={8} required value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <div className="editor__actions">
              <button className="btn btn--primary" disabled={savingPass}>
                {savingPass ? 'Salvando' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
