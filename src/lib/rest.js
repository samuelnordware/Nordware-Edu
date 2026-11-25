import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase'

// Requisicao direta a Data API, com tempo limite e erro detalhado.
// Usada nos salvamentos para nao depender do estado interno da sessao.

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

async function accessToken() {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 5000)
    if (data?.session?.access_token) return data.session.access_token
  } catch {
    /* tenta a copia salva no navegador */
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const value = JSON.parse(localStorage.getItem(key))
        if (value?.access_token) return value.access_token
      }
    }
  } catch {
    /* armazenamento indisponivel */
  }
  throw new Error('Sessão expirada. Saia e entre novamente.')
}

export async function restRequest(method, table, { filters = {}, body, select = '*' } = {}) {
  const token = await accessToken()
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => params.append(k, `eq.${v}`))
  if (select) params.append('select', select)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      /* resposta sem JSON */
    }
    if (!res.ok) throw new Error(`Erro ${res.status}: ${json?.message || text || res.statusText}`)
    return Array.isArray(json) ? json : json ? [json] : []
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('O Supabase não respondeu em 15 segundos. Tente novamente em instantes.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
