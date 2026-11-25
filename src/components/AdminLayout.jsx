import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'

export default function AdminLayout() {
  const { isManager, isMaster } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="admin-shell">
      <aside className={'admin-side' + (open ? ' is-open' : '')} aria-label="Menu administrativo">
        <Link to="/admin" className="admin-side__brand">
          <Logo />
        </Link>
        <nav>
          <NavLink to="/admin" end>Resumo</NavLink>
          <p className="admin-side__label">Conteúdos</p>
          <NavLink to="/admin/cursos">Treinamentos</NavLink>
          <NavLink to="/admin/treinamento/novo">Criar treinamento</NavLink>
          <NavLink to="/admin/comentarios">Comentários</NavLink>
          {isManager && (
            <>
              <p className="admin-side__label">Pessoas</p>
              <NavLink to="/admin/usuarios">Usuários</NavLink>
            </>
          )}
          {isMaster && (
            <>
              <p className="admin-side__label">Configurações</p>
              <NavLink to="/admin/personalizar">Personalizar site</NavLink>
            </>
          )}
        </nav>
        <Link to="/" className="admin-side__back">Ir para a área do aluno</Link>
      </aside>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
      <div className="admin-main">
        <header className="admin-top">
          <button className="icon-btn admin-top__menu" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <span className="admin-top__title">Painel administrativo</span>
          <div className="topbar__actions">
            <UserMenu />
            <ThemeToggle />
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
