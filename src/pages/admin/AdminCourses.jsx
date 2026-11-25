import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, asset } from '../../lib/supabase'
import { toastError } from '../../lib/toast'

export default function AdminCourses() {
  const [courses, setCourses] = useState(null)

  useEffect(() => {
    supabase
      .from('courses')
      .select('id, title, category, cover_url, is_published, is_featured, sort_order, lessons(count)')
      .order('sort_order')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) toastError(error)
        setCourses(data || [])
      })
  }, [])

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <h1>Treinamentos</h1>
          <p className="muted">Crie treinamentos, publique aulas e organize o que os alunos veem.</p>
        </div>
        <Link className="btn btn--primary" to="/admin/treinamento/novo">
          Novo treinamento
        </Link>
      </header>

      {!courses && <div className="page-loading" aria-busy="true" />}
      {courses && !courses.length && (
        <p className="empty">Nenhum treinamento criado. Use Novo treinamento para começar.</p>
      )}

      <ul className="admin-grid">
        {courses?.map((c) => (
          <li key={c.id}>
            <Link to={`/admin/treinamento/${c.id}`} className="admin-card">
              <div className="admin-card__media">
                {c.cover_url ? <img src={asset(c.cover_url)} alt="" /> : <span>{c.title}</span>}
              </div>
              <div className="admin-card__body">
                <h2>{c.title}</h2>
                <p className="muted">
                  {c.lessons?.[0]?.count ?? 0} aulas
                  {c.category ? `, ${c.category}` : ''}
                </p>
                <div className="chips">
                  <span className={'chip ' + (c.is_published ? 'chip--ok' : 'chip--draft')}>
                    {c.is_published ? 'Publicado' : 'Rascunho'}
                  </span>
                  {c.is_featured && <span className="chip chip--brand">Destaque</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
