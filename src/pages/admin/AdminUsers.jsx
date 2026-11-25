import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast, toastError } from '../../lib/toast'

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState(null)
  const [done, setDone] = useState(new Map())
  const [query, setQuery] = useState('')

  async function load() {
    const [{ data: profiles, error }, { data: progress }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, role, created_at').order('created_at'),
      supabase.from('lesson_progress').select('user_id').not('completed_at', 'is', null),
    ])
    if (error) toastError(error)
    const m = new Map()
    ;(progress || []).forEach((p) => m.set(p.user_id, (m.get(p.user_id) || 0) + 1))
    setDone(m)
    setUsers(profiles || [])
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!users) return []
    return q
      ? users.filter((u) => (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : users
  }, [users, query])

  async function toggleRole(u) {
    const role = u.role === 'admin' ? 'student' : 'admin'
    const verb = role === 'admin' ? 'Tornar administrador' : 'Remover acesso de administrador de'
    if (!window.confirm(`${verb} ${u.full_name || u.email}?`)) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) return toastError(error)
    toast('Permissão atualizada.')
    load()
  }

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Alunos se cadastram pela tela de login. Aqui você define quem publica conteúdo.</p>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Buscar por nome ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar usuários"
        />
      </header>
      {!users && <div className="page-loading" aria-busy="true" />}
      {users && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Aulas concluídas</th>
                <th scope="col">Acesso</th>
                <th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{done.get(u.id) || 0}</td>
                  <td>
                    <span className={'chip ' + (u.role === 'admin' ? 'chip--brand' : '')}>
                      {u.role === 'admin' ? 'Administrador' : 'Aluno'}
                    </span>
                  </td>
                  <td className="table__act">
                    {u.id !== user.id && (
                      <button className="btn btn--ghost btn--sm" onClick={() => toggleRole(u)}>
                        {u.role === 'admin' ? 'Tornar aluno' : 'Tornar administrador'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
