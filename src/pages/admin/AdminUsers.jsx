import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLES, ROLE_LABEL, functionError } from '../../lib/roles'
import { toast, toastError } from '../../lib/toast'
import Avatar from '../../components/Avatar'

const EMPTY = { full_name: '', email: '', password: '', role: 'student' }

async function callAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(await functionError(error))
  return data
}

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState(null)
  const [done, setDone] = useState(new Map())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null) // formulario de novo usuario
  const [busy, setBusy] = useState(false)

  async function load() {
    const [{ data: profiles, error }, { data: progress }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, role, avatar_url, created_at').order('created_at'),
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
    if (!users) return []
    const q = query.trim().toLowerCase()
    return users.filter(
      (u) =>
        (filter === 'all' || u.role === filter) &&
        (!q || (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    )
  }, [users, query, filter])

  const counts = useMemo(() => {
    const c = { all: users?.length || 0 }
    ;(users || []).forEach((u) => (c[u.role] = (c[u.role] || 0) + 1))
    return c
  }, [users])

  async function createUser(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await callAdmin({ action: 'create', ...form })
      toast(`${ROLE_LABEL[form.role]} criado. Envie o e-mail e a senha inicial para a pessoa.`)
      setForm(null)
      load()
    } catch (err) {
      toastError(err)
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(u, role) {
    if (role === u.role) return
    if (!window.confirm(`Alterar ${u.full_name || u.email} para ${ROLE_LABEL[role]}?`)) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) return toastError(error)
    toast('Papel atualizado.')
    load()
  }

  async function resetPassword(u) {
    const password = window.prompt(`Nova senha para ${u.full_name || u.email} (mínimo de 8 caracteres):`)
    if (!password) return
    try {
      await callAdmin({ action: 'set_password', user_id: u.id, password })
      toast('Senha redefinida. Informe a nova senha à pessoa.')
    } catch (err) {
      toastError(err)
    }
  }

  async function removeUser(u) {
    if (!window.confirm(`Excluir ${u.full_name || u.email}? O progresso e os comentários dessa pessoa também serão apagados.`))
      return
    try {
      await callAdmin({ action: 'delete', user_id: u.id })
      toast('Usuário excluído.')
      load()
    } catch (err) {
      toastError(err)
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Crie acessos para alunos, professores e gestores.</p>
        </div>
        {!form && (
          <button className="btn btn--primary" onClick={() => setForm(EMPTY)}>
            Novo usuário
          </button>
        )}
      </header>

      {form && (
        <form className="panel form new-user" onSubmit={createUser}>
          <h2>Novo usuário</h2>
          <fieldset className="field">
            <legend>Papel</legend>
            <div className="role-pick">
              {ROLES.map((r) => (
                <label key={r.id} className={form.role === r.id ? 'is-active' : ''}>
                  <input type="radio" name="role" value={r.id} checked={form.role === r.id} onChange={set('role')} />
                  <strong>{r.label}</strong>
                  <small>{r.help}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <div className="field">
              <label htmlFor="nu-name">Nome completo</label>
              <input id="nu-name" value={form.full_name} onChange={set('full_name')} required maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="nu-email">E-mail</label>
              <input id="nu-email" type="email" value={form.email} onChange={set('email')} required autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="nu-pass">Senha inicial</label>
              <input id="nu-pass" type="text" value={form.password} onChange={set('password')} required minLength={8}
                autoComplete="new-password" />
            </div>
          </div>
          <p className="hint">A pessoa entra com essa senha e pode trocá-la em Meu perfil.</p>
          <div className="editor__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn--primary" disabled={busy}>
              {busy ? 'Criando' : `Criar ${ROLE_LABEL[form.role].toLowerCase()}`}
            </button>
          </div>
        </form>
      )}

      <div className="users-toolbar">
        <div className="segmented" role="tablist" aria-label="Filtrar por papel">
          {[{ id: 'all', label: 'Todos' }, ...ROLES].map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={filter === r.id}
              className={filter === r.id ? 'is-active' : ''}
              onClick={() => setFilter(r.id)}
            >
              {r.id === 'all' ? 'Todos' : r.label} ({counts[r.id] || 0})
            </button>
          ))}
        </div>
        <input
          className="search"
          type="search"
          placeholder="Buscar por nome ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar usuários"
        />
      </div>

      {!users && <div className="page-loading" aria-busy="true" />}
      {users && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Aulas concluídas</th>
                <th scope="col">Papel</th>
                <th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <Avatar name={u.full_name || u.email} url={u.avatar_url} size={34} />
                      <span>
                        <strong>{u.full_name || u.email.split('@')[0]}</strong>
                        <small className="muted">{u.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{done.get(u.id) || 0}</td>
                  <td>
                    {u.id === user.id ? (
                      <span className="chip chip--brand">{ROLE_LABEL[u.role]} (você)</span>
                    ) : (
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        aria-label={`Papel de ${u.full_name || u.email}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="table__act">
                    {u.id !== user.id && (
                      <>
                        <button className="btn btn--ghost btn--sm" onClick={() => resetPassword(u)}>
                          Redefinir senha
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => removeUser(u)}>
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="empty table-empty">Nenhum usuário encontrado.</p>}
        </div>
      )}
    </div>
  )
}
