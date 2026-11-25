import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { canEditCourse } from '../../lib/roles'
import { timeAgo } from '../../lib/video'
import Avatar from '../../components/Avatar'
import ProgressBar from '../../components/ProgressBar'

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <strong className="stat__value mono">{value ?? '—'}</strong>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  )
}

export default function AdminHome() {
  const { profile, isManager } = useAuth()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)

  useEffect(() => {
    let active = true
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const count = (q) => q.then(({ count: n }) => n ?? 0)
    ;(async () => {
      const [courses, completed, comments, recent, students, newStudents, activeStudents, progress] = await Promise.all([
        supabase.from('courses').select('id, title, is_published, created_by, modules(count), lessons(id)').order('sort_order'),
        count(supabase.from('lesson_progress').select('lesson_id', { count: 'exact', head: true }).gte('completed_at', since)),
        count(supabase.from('lesson_comments').select('id', { count: 'exact', head: true }).gte('created_at', since)),
        supabase.from('lesson_comments').select('id, body, author_name, author_avatar, created_at, lesson_id, lessons(title)').order('created_at', { ascending: false }).limit(6),
        isManager ? count(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student')) : null,
        isManager ? count(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').gte('created_at', since)) : null,
        isManager ? count(supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', since)) : null,
        supabase.from('lesson_progress').select('user_id, lesson_id, completed_at').limit(5000),
      ])
      if (!active) return
      const own = (courses.data || []).filter((c) => canEditCourse(profile, c))
      const rows = own.map((c) => {
        const ids = new Set((c.lessons || []).map((l) => l.id))
        const prog = (progress.data || []).filter((p) => ids.has(p.lesson_id))
        const learners = new Set(prog.map((p) => p.user_id)).size
        const done = prog.filter((p) => p.completed_at).length
        const avg = learners && ids.size ? (done / (learners * ids.size)) * 100 : 0
        return { ...c, lessonCount: ids.size, moduleCount: c.modules?.[0]?.count ?? 0, learners, avg }
      })
      setData({ rows, completed, comments, recent: recent.data || [], students, newStudents, activeStudents })
    })()
    return () => {
      active = false
    }
  }, [days, isManager, profile])

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Resumo</h1>
          <p className="muted">Visão geral dos {isManager ? 'treinamentos e alunos' : 'seus treinamentos'} no período.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.days} role="tab" aria-selected={days === p.days} className={days === p.days ? 'is-active' : ''} onClick={() => setDays(p.days)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="stats">
        {isManager && <Stat label="Total de alunos" value={data?.students} />}
        {isManager && <Stat label="Novos alunos" value={data?.newStudents} hint={`Últimos ${days} dias`} />}
        {isManager && <Stat label="Pessoas ativas" value={data?.activeStudents} hint="Acessaram no período" />}
        <Stat label="Aulas concluídas" value={data?.completed} hint={`Últimos ${days} dias`} />
        <Stat label="Comentários" value={data?.comments} hint={`Últimos ${days} dias`} />
      </div>

      <div className="dash-grid">
        <section className="panel" aria-labelledby="dc-title">
          <div className="panel__head">
            <h2 id="dc-title">Treinamentos</h2>
            <Link className="btn btn--ghost btn--sm" to="/admin/cursos">Gerenciar</Link>
          </div>
          {!data && <div className="page-loading" aria-busy="true" />}
          {data && !data.rows.length && <p className="empty">Nenhum treinamento seu ainda.</p>}
          {data && data.rows.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Treinamento</th>
                    <th scope="col">Módulos</th>
                    <th scope="col">Aulas</th>
                    <th scope="col">Alunos</th>
                    <th scope="col">Conclusão média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/treinamento/${c.id}`} className="table__link">{c.title}</Link>
                        {!c.is_published && <span className="chip chip--draft">Rascunho</span>}
                      </td>
                      <td className="mono">{c.moduleCount}</td>
                      <td className="mono">{c.lessonCount}</td>
                      <td className="mono">{c.learners}</td>
                      <td>
                        <div className="table__progress">
                          <ProgressBar value={c.avg} label={`Conclusão média em ${c.title}`} />
                          <span className="mono">{Math.round(c.avg)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="dr-title">
          <div className="panel__head">
            <h2 id="dr-title">Comentários recentes</h2>
            <Link className="btn btn--ghost btn--sm" to="/admin/comentarios">Ver todos</Link>
          </div>
          {data && !data.recent.length && <p className="empty">Nenhum comentário ainda.</p>}
          <ul className="feed">
            {data?.recent.map((c) => (
              <li key={c.id}>
                <Avatar name={c.author_name} url={c.author_avatar} size={32} />
                <div>
                  <p className="feed__meta">
                    <strong>{c.author_name}</strong> em{' '}
                    <Link to={`/aula/${c.lesson_id}?aba=comments`}>{c.lessons?.title}</Link>
                  </p>
                  <p className="feed__body">{c.body}</p>
                  <time className="mono">{timeAgo(c.created_at)}</time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
