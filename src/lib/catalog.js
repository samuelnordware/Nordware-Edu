import { supabase } from './supabase'

// Carrega treinamentos visiveis, aulas e o progresso do usuario
export async function loadCatalog(userId) {
  const [{ data: courses, error }, { data: progress }] = await Promise.all([
    supabase
      .from('courses')
      .select('*, lessons(id, title, sort_order, is_published, duration_minutes)')
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at, last_seen_at')
      .eq('user_id', userId),
  ])
  if (error) throw error

  const byLesson = new Map((progress || []).map((p) => [p.lesson_id, p]))

  return (courses || []).map((c) => {
    const lessons = (c.lessons || [])
      .filter((l) => l.is_published)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    const seen = lessons.map((l) => byLesson.get(l.id)).filter(Boolean)
    const done = seen.filter((p) => p.completed_at).length
    const lastSeen = seen.reduce((max, p) => (p.last_seen_at > max ? p.last_seen_at : max), '')
    const next = lessons.find((l) => !byLesson.get(l.id)?.completed_at) || lessons[0]
    return {
      ...c,
      lessons,
      stats: {
        lessonCount: lessons.length,
        done,
        percent: lessons.length ? (done / lessons.length) * 100 : 0,
        lastSeen,
        started: seen.length > 0,
        nextLessonId: next?.id,
        minutes: lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0),
      },
      progressByLesson: byLesson,
    }
  })
}
