import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { asset } from '../lib/supabase'
import { useSite, loginImages } from '../lib/site'

const allowSignup = import.meta.env.VITE_ALLOW_SIGNUP !== 'false'

const MESSAGES = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link enviado antes de entrar.',
  'User already registered': 'Este e-mail já tem cadastro. Use a opção Entrar.',
}

export default function Login() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const site = useSite()

  if (!loading && user) return <Navigate to={location.state?.from?.pathname || '/'} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    let res
    if (mode === 'signin') res = await signIn(email.trim(), password)
    else if (mode === 'signup') res = await signUp(email.trim(), password, name.trim())
    else res = await resetPassword(email.trim())
    setBusy(false)
    if (res.error) {
      setMsg({ kind: 'error', text: MESSAGES[res.error.message] || res.error.message })
      return
    }
    if (mode === 'signin') navigate(location.state?.from?.pathname || '/', { replace: true })
    if (mode === 'signup') {
      if (res.data.session) navigate('/', { replace: true })
      else setMsg({ kind: 'ok', text: 'Conta criada. Confirme o e-mail pelo link enviado e depois entre.' })
    }
    if (mode === 'reset') setMsg({ kind: 'ok', text: 'Enviamos um link de redefinição para o seu e-mail.' })
  }

  const covers = loginImages(site)
  const wall = Array.from({ length: Math.max(9, covers.length) }, (_, i) => covers[i % covers.length])

  return (
    <div className="login">
      <div className="login__wall" aria-hidden="true">
        {wall.map((c, i) => (
          <img key={i} src={asset(c)} alt="" />
        ))}
      </div>
      <div className="login__panel">
        <div className="login__top">
          <Logo size="lg" />
          <ThemeToggle />
        </div>
        <h1>
          {mode === 'signin' && (site?.login_title || 'Entre para continuar seus treinamentos')}
          {mode === 'signup' && 'Crie sua conta de aluno'}
          {mode === 'reset' && 'Redefina sua senha'}
        </h1>
        {mode === 'signin' && site?.login_text && <p className="login__text">{site.login_text}</p>}
        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">Nome completo</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>
          )}
          {msg && <p className={`form__msg form__msg--${msg.kind}`}>{msg.text}</p>}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Aguarde' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
          </button>
        </form>
        <div className="login__alt">
          {mode === 'signin' ? (
            <>
              <button className="link-btn" onClick={() => setMode('reset')}>
                Esqueci minha senha
              </button>
              {allowSignup && (
                <button className="link-btn" onClick={() => setMode('signup')}>
                  Criar conta
                </button>
              )}
            </>
          ) : (
            <button className="link-btn" onClick={() => setMode('signin')}>
              Já tenho conta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
