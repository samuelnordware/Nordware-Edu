// Nordware Edu - gestao de usuarios (somente gestores)
// Publicar: Supabase > Edge Functions > Deploy a new function > Via Editor
// Nome da funcao: admin-users
import { withSupabase } from 'npm:@supabase/server@1'

const ROLES = ['student', 'teacher', 'manager']
const fail = (message: string, status = 400) => Response.json({ error: message }, { status })

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const admin = ctx.supabaseAdmin
    const callerId = ctx.userClaims?.id
    if (!callerId) return fail('Sessão inválida. Entre novamente.', 401)

    // Confere no banco se quem chamou e gestor
    const { data: caller } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle()
    if (caller?.role !== 'manager') return fail('Somente gestores podem gerenciar usuários.', 403)

    const body = await req.json().catch(() => ({}))

    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      const role = String(body.role || 'student')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Informe um e-mail válido.')
      if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.')
      if (!ROLES.includes(role)) return fail('Papel inválido.')

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) {
        const msg = /already|registered|exists/i.test(error.message)
          ? 'Já existe um usuário com este e-mail.'
          : error.message
        return fail(msg)
      }
      const { error: upErr } = await admin
        .from('profiles')
        .update({ role, full_name: fullName || null })
        .eq('id', data.user.id)
      if (upErr) return fail(upErr.message, 500)
      return Response.json({ id: data.user.id })
    }

    if (body.action === 'delete') {
      const userId = String(body.user_id || '')
      if (!userId) return fail('Usuário não informado.')
      if (userId === callerId) return fail('Você não pode excluir o próprio usuário.')
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return fail(error.message, 500)
      return Response.json({ ok: true })
    }

    if (body.action === 'set_password') {
      const userId = String(body.user_id || '')
      const password = String(body.password || '')
      if (!userId) return fail('Usuário não informado.')
      if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.')
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return fail(error.message, 500)
      return Response.json({ ok: true })
    }

    return fail('Ação desconhecida.')
  }),
}
