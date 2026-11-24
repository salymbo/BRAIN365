const SUPABASE_URL = 'https://ghhcxldbwqmsgdyszwgg.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Yzf_6I7J5SnU9p5U_Q1w8g_SuyjlPp7'
const SHARED_EMAIL = 'salim.boukhari@sotutrasm.tn'
const SESSION_KEY = 'brain365-supabase-session'
const TABLE_URL = `${SUPABASE_URL}/rest/v1/brain365_state`

export const syncedStorageKeys = [
  'sotutrasm-fuel-records',
  'sotutrasm-fuel-deliveries',
  'sotutrasm-reservoir-baseline',
  'sotutrasm-fuel-tank-capacity',
  'sotutrasm-fuel-stock',
  'sotutrasm-fleet-assets',
  'sotutrasm-hourmeter-readings',
  'sotutrasm-enrochement-trips',
  'sotutrasm-imported-ENR0411-2026-11-04',
]

const headers = (token) => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
})

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || `Supabase (${response.status})`)
  return data
}

function saveSession(session) {
  const normalized = { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600) }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized))
  return normalized
}

export function clearCloudSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export async function signIn(login, password) {
  if (login.trim().toLowerCase() !== 'sotutrasm' && login.trim().toLowerCase() !== SHARED_EMAIL) {
    throw new Error('Login ou mot de passe incorrect.')
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email: SHARED_EMAIL, password }),
  })
  const session = saveSession(await readResponse(response))
  return session
}

export async function restoreSession() {
  let session
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { session = null }
  if (!session?.access_token) return null
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session
  if (!session.refresh_token) { clearCloudSession(); return null }
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
    return saveSession(await readResponse(response))
  } catch {
    clearCloudSession()
    return null
  }
}

async function fetchRows(session) {
  const response = await fetch(`${TABLE_URL}?select=key,value`, { headers: headers(session.access_token) })
  return readResponse(response)
}

export async function loadCloudState(session) {
  const rows = await fetchRows(session)
  return Object.fromEntries(rows.filter((row) => syncedStorageKeys.includes(row.key)).map(({ key, value }) => [key, value]))
}

export function applyCloudState(cloudState) {
  syncedStorageKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(cloudState, key)) {
      const value = cloudState[key]
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } else localStorage.removeItem(key)
  })
}

export async function initializeCloudFromThisDevice(session) {
  const rows = syncedStorageKeys.flatMap((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return []
    try { return [{ key, value: JSON.parse(raw) }] } catch { return [{ key, value: raw }] }
  })
  if (!rows.length) throw new Error('Aucune donnée locale à importer sur cet appareil.')
  const response = await fetch(`${TABLE_URL}?on_conflict=key`, {
    method: 'POST', headers: { ...headers(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  await readResponse(response)
  return rows.length
}

export function startLocalStorageSync(session, onStatus) {
  const originalSet = Storage.prototype.setItem
  const originalRemove = Storage.prototype.removeItem
  const writes = new Map()
  let stopped = false

  const schedule = (key, value, removed = false) => {
    if (!syncedStorageKeys.includes(key)) return
    const operation = async () => {
      if (stopped) return
      onStatus('syncing')
      const response = removed
        ? await fetch(`${TABLE_URL}?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers: headers(session.access_token), keepalive: true })
        : await fetch(`${TABLE_URL}?on_conflict=key`, {
          method: 'POST', headers: { ...headers(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key, value }]), keepalive: true,
        })
      await readResponse(response)
      if (!stopped) onStatus('online')
    }
    const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(operation).catch(() => { if (!stopped) onStatus('error') })
    writes.set(key, next)
  }

  Storage.prototype.setItem = function (key, value) {
    originalSet.call(this, key, value)
    if (this === localStorage && syncedStorageKeys.includes(String(key))) {
      let parsed = value
      try { parsed = JSON.parse(value) } catch { /* keep text values as text */ }
      schedule(String(key), parsed)
    }
  }
  Storage.prototype.removeItem = function (key) {
    originalRemove.call(this, key)
    if (this === localStorage) schedule(String(key), null, true)
  }

  return () => {
    stopped = true
    Storage.prototype.setItem = originalSet
    Storage.prototype.removeItem = originalRemove
  }
}
