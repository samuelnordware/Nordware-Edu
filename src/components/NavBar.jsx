import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

export default function NavBar() {
  const { profile, isAdmin, signOut } = useAuth()
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
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

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
          {isAdmin && (
            <>
              <NavLink to="/admin" end>
                Treinamentos
              </NavLink>
              <NavLink to="/admin/usuarios">Usuários</NavLink>
            </>
          )}
        </nav>
        <div className="nav__user" ref={menuRef}>
          <button
            className="avatar"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menu da conta"
          >
            {initials || '?'}
          </button>
          {open && (
            <div className="menu" role="menu">
              <div className="menu__head">
                <strong>{name}</strong>
                <span>{isAdmin ? 'Administrador' : 'Aluno'}</span>
              </div>
              {isAdmin && (
                <button role="menuitem" onClick={() => { setOpen(false); navigate('/admin') }}>
                  Gerenciar treinamentos
                </button>
              )}
              {isAdmin && (
                <button role="menuitem" onClick={() => { setOpen(false); navigate('/admin/usuarios') }}>
                  Usuários
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
