export const ROLES = [
  { id: 'student', label: 'Aluno', help: 'Assiste às aulas, marca o checklist e comenta.' },
  { id: 'teacher', label: 'Professor', help: 'Cria e publica os próprios treinamentos.' },
  { id: 'manager', label: 'Gestor', help: 'Publica qualquer treinamento e gerencia usuários.' },
]

export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.id, r.label]))

export function canEditCourse(profile, course) {
  if (!profile || !course) return false
  return profile.role === 'manager' || (profile.role === 'teacher' && course.created_by === profile.id)
}

// Le a mensagem de erro devolvida pela funcao de servidor
export async function functionError(error) {
  try {
    const body = await error.context.json()
    return body.error || error.message
  } catch {
    return error.message
  }
}
