import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from '../lib/toast'

export default function RecoveryDialog() {
  const { recovering, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  if (!recovering) return null
  async function submit(e) {
    e.preventDefault()
    const { error: err } = await updatePassword(password)
    if (err) return setError(err.message)
    toast('Senha atualizada.')
    window.history.replaceState(null, '', window.location.pathname + '#/')
  }
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rec-title">
      <form className="dialog__box form" onSubmit={submit}>
        <h2 id="rec-title">Defina uma nova senha</h2>
        <div className="field">
          <label htmlFor="newpass">Nova senha</label>
          <input id="newpass" type="password" minLength={8} required value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <p className="form__msg form__msg--error">{error}</p>}
        <button className="btn btn--primary btn--block">Salvar nova senha</button>
      </form>
    </div>
  )
}
