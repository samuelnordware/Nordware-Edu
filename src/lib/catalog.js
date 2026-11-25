import { supabase } from './supabase'

const COURSE_SELECT =
  '*, modules(id, title, sort_order), lessons(id, title, description, sort_order, is_published, duration_minutes, module_id)'

// Agrupa as aulas por modulo, na ordem definida pelo professor
export function groupLessons(modules = [], lessons = []) {
  const mods = [...modules].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const byOrder = (a, b) => a.sort_order - b.sort_order || a.id - b.id
  const groups = mods.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id).sort(byOrder) }))
  const loose = lessons.filter((l) => !mods.some((m) => m.id === l.module_id)).sort(byOrder)
  if (loose.length) groups.push({ id: 'avulsas', title: 'Outras aulas', lessons: loose })
  return groups.filter((g) => g.lessons.length)
}

function enrich(c, byLesson, includeHidden = false) {
  const visible = (c.lessons || []).filter((l) => includeHidden || l.is_published)
  const modules = groupLessons(c.modules || [], visible)
  const lessons = modules.flatMap((m) => m.lessons)
  const seen = lessons.map((l) => byLesson.get(l.id)).filter(Boolean)
  const done = seen.filter((p) => p.completed_at).length
  const lastSeen = seen.reduce((max, p) => (p.last_seen_at > max ? p.last_seen_at : max), '')
  const next = lessons.find((l) => !byLesson.get(l.id)?.completed_at) || lessons[0]
  return {
    ...c,
    modules,
    lessons,
    progressByLesson: byLesson,
    stats: {
      lessonCount: lessons.length,
      moduleCount: modules.length,
      done,
      percent: lessons.length ? (done / lessons.length) * 100 : 0,
      lastSeen,
      started: seen.length > 0,
      nextLessonId: next?.id,
      minutes: lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0),
    },
  }
}

async function progressMap(userId) {
  const { data } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed_at, last_seen_at')
    .eq('user_id', userId)
  return new Map((data || []).map((p) => [p.lesson_id, p]))
}

// Todos os treinamentos visiveis, com modulos e progresso do usuario
export async function loadCatalog(userId) {
  const [{ data, error }, byLesson] = await Promise.all([
    supabase.from('courses').select(COURSE_SELECT).order('sort_order').order('created_at'),
    progressMap(userId),
  ])
  if (error) throw error
  return (data || []).map((c) => enrich(c, byLesson))
}

// Um treinamento; quem edita tambem ve as aulas ocultas
export async function loadCourse(courseId, userId, includeHidden = false) {
  const [{ data, error }, byLesson] = await Promise.all([
    supabase.from('courses').select(COURSE_SELECT).eq('id', courseId).maybeSingle(),
    progressMap(userId),
  ])
  if (error) throw error
  return data ? enrich(data, byLesson, includeHidden) : null
}
