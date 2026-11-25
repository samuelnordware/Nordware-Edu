import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABEL } from '../lib/roles'
import Avatar from './Avatar'

export default function UserMenu() {
  const { profile, isStaff, isMaster, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const name = profile?.full_name || profile?.email?.split('@')[0] || ''
  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="nav__user" ref={ref}>
      <button className="user-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu da conta">
        <Avatar name={name} url={profile?.avatar_url} size={34} />
        <span className="user-btn__text">
          <strong>{name.split(' ')[0]}</strong>
          <small>
            {ROLE_LABEL[profile?.role] || ''}
            {isMaster ? ', ADM Master' : ''}
          </small>
        </span>
        <svg className="user-btn__caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__head">
            <strong>{name}</strong>
            <span>{profile?.email}</span>
          </div>
          <button role="menuitem" onClick={() => go('/perfil')}>Meu perfil</button>
          <button role="menuitem" onClick={() => go('/')}>Área do aluno</button>
          {isStaff && <button role="menuitem" onClick={() => go('/admin')}>Painel administrativo</button>}
          <button role="menuitem" onClick={() => signOut().then(() => navigate('/login'))}>Sair</button>
        </div>
      )}
    </div>
  )
}
