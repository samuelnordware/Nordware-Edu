import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import { ROLE_LABEL } from '../lib/roles'

export default function NavBar() {
  const { profile, isStaff, isManager, isMaster, signOut } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const name = profile?.full_name || profile?.email?.split('@')[0] || ''

  return (
    <header className={'nav' + (scrolled ? ' nav--solid' : '')}>
      <div className="nav__inner">
        <Link to="/" className="nav__brand" aria-label="Nordware Edu, início">
          <Logo />
        </Link>
        <nav className="nav__links" aria-label="Principal">
          <NavLink to="/" end>
            Início
          </NavLink>
          {isStaff && (
            <NavLink to="/admin" end>
              Treinamentos
            </NavLink>
          )}
          {isManager && <NavLink to="/admin/usuarios">Usuários</NavLink>}
          {isMaster && <NavLink to="/personalizar">Personalizar</NavLink>}
        </nav>
        <ThemeToggle />
        <div className="nav__user" ref={menuRef}>
          <button
            className="user-btn"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menu da conta"
          >
            <Avatar name={name} url={profile?.avatar_url} size={36} />
            <span className="user-btn__text">
              <strong>{name.split(' ')[0]}</strong>
              <small>{ROLE_LABEL[profile?.role] || ''}</small>
            </span>
            <svg className="user-btn__caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {open && (
            <div className="menu" role="menu">
              <div className="menu__head">
                <strong>{name}</strong>
                <span>{ROLE_LABEL[profile?.role] || ''}{isMaster ? ', ADM Master' : ''}</span>
              </div>
              <button role="menuitem" onClick={() => { setOpen(false); navigate('/perfil') }}>
                Meu perfil
              </button>
              {isStaff && (
                <button role="menuitem" onClick={() => { setOpen(false); navigate('/admin') }}>
                  Gerenciar treinamentos
                </button>
              )}
              {isManager && (
                <button role="menuitem" onClick={() => { setOpen(false); navigate('/admin/usuarios') }}>
                  Usuários
                </button>
              )}
              {isMaster && (
                <button role="menuitem" onClick={() => { setOpen(false); navigate('/personalizar') }}>
                  Personalizar site
                </button>
              )}
              <button role="menuitem" onClick={() => signOut().then(() => navigate('/login'))}>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
