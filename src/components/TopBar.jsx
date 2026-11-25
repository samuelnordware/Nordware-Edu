import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import { openPalette } from './CommandPalette'
import { useAuth } from '../context/AuthContext'

export default function TopBar() {
  const { isStaff } = useAuth()
  const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  return (
    <header className="topbar">
      <div className="topbar__row">
        <Link to="/" className="topbar__brand" aria-label="Nordware Edu, Resumo">
          <Logo />
        </Link>
        <button className="search-trigger" onClick={openPalette}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <span>Procurar treinamentos e aulas</span>
          <kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>
        <div className="topbar__actions">
          {isStaff && (
            <Link className="btn btn--ghost btn--sm topbar__admin" to="/admin">
              Painel
            </Link>
          )}
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>
      <nav className="tabs-nav" aria-label="Área do aluno">
        <NavLink to="/" end>Resumo</NavLink>
        <NavLink to="/cursos">Meus cursos</NavLink>
        <NavLink to="/salvas">Aulas salvas</NavLink>
        <NavLink to="/anotacoes">Minhas anotações</NavLink>
      </nav>
    </header>
  )
}
