import { supabase } from './supabase'
export async function api(path, { body, ...opts } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const pt = sessionStorage.getItem('pinToken')
  const r = await fetch(import.meta.env.VITE_API_URL + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...(pt ? { 'x-pin-token': pt } : {}) },
    body: body && JSON.stringify(body)
  })
  const j = await r.json().catch(() => ({}))
  if (r.status === 403) { sessionStorage.removeItem('pinToken'); location.reload() }
  if (!r.ok) throw new Error(j.error || r.status)
  return j
}
