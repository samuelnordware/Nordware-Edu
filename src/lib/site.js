import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const DEFAULT_SITE = {
  login_title: 'Entre para continuar seus treinamentos',
  login_text: '',
  login_images: [],
  hero_greeting: 'Olá, {nome}',
  hero_image_url: '',
}

const FALLBACK_LOGIN_IMAGES = ['covers/enviando.jpg', 'covers/roter.jpg', 'covers/bahn.jpg']

let cache = null
const listeners = new Set()

export async function loadSite(force = false) {
  if (cache && !force) return cache
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  cache = { ...DEFAULT_SITE, ...(data || {}) }
  listeners.forEach((fn) => fn(cache))
  return cache
}

export function useSite() {
  const [site, setSite] = useState(cache)
  useEffect(() => {
    listeners.add(setSite)
    loadSite().then(setSite)
    return () => listeners.delete(setSite)
  }, [])
  return site
}

export function loginImages(site) {
  return site?.login_images?.length ? site.login_images : FALLBACK_LOGIN_IMAGES
}

export function greeting(site, firstName) {
  const tpl = site?.hero_greeting ?? DEFAULT_SITE.hero_greeting
  if (!tpl) return ''
  if (tpl.includes('{nome}') && !firstName) return ''
  return tpl.replace('{nome}', firstName || '')
}
