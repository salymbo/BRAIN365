const SUPABASE_URL = 'https://ghhcxldbwqmsgdyszwgg.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Yzf_6I7J5SnU9p5U_Q1w8g_SuyjlPp7'
const SESSION_KEY = 'brain365-supabase-session'
const PENDING_SYNC_KEY = 'brain365-pending-cloud-sync'
const TABLE_URL = `${SUPABASE_URL}/rest/v1/brain365_state`

export const syncedStorageKeys = [
  'sotutrasm-fuel-records',
  'sotutrasm-fuel-deliveries',
  'sotutrasm-reservoir-baseline',
  'sotutrasm-fuel-tank-capacity',
  'sotutrasm-fuel-stock',
  'sotutrasm-custom-drivers',
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
  const email = login.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Saisis l’adresse e-mail du compte partagé.')
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
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
  let pending = {}
  try { pending = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '{}') } catch { pending = {} }
  syncedStorageKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(pending, key)) {
      const queued = pending[key]
      if (queued.removed) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(queued.value))
      return
    }
    if (Object.prototype.hasOwnProperty.call(cloudState, key)) {
      const value = cloudState[key]
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } else localStorage.removeItem(key)
  })
}

export function markCloudWritePending(key, value) {
  if (!syncedStorageKeys.includes(key)) return
  let pending = {}
  try { pending = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '{}') } catch { pending = {} }
  pending[key] = { value, removed: false }
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending))
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

export async function importCloudBackup(session, backup) {
  if (backup?.format !== 'brain365-local-backup' || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    throw new Error('Ce fichier n’est pas une sauvegarde SOTUTRASM BRAIN 365 valide.')
  }
  const rows = Object.entries(backup.data)
    .filter(([key]) => syncedStorageKeys.includes(key))
    .map(([key, value]) => ({ key, value }))
  if (!rows.length) throw new Error('La sauvegarde ne contient aucune donnée reconnue.')
  const response = await fetch(`${TABLE_URL}?on_conflict=key`, {
    method: 'POST', headers: { ...headers(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  await readResponse(response)
  return rows.length
}

export function startLocalStorageSync(session, onStatus) {
  const originalGet = Storage.prototype.getItem
  const originalSet = Storage.prototype.setItem
  const originalRemove = Storage.prototype.removeItem
  const writes = new Map()
  let stopped = false

  const readPending = () => {
    try { return JSON.parse(originalGet.call(localStorage, PENDING_SYNC_KEY) || '{}') } catch { return {} }
  }
  const savePending = (pending) => originalSet.call(localStorage, PENDING_SYNC_KEY, JSON.stringify(pending))

  const schedule = (key, value, removed = false) => {
    if (!syncedStorageKeys.includes(key)) return
    const operation = async () => {
      if (stopped) return
      onStatus('syncing')
      const currentSession = await restoreSession()
      if (!currentSession?.access_token) throw new Error('Session expirée. Reconnecte-toi pour synchroniser les données.')
      const response = removed
        ? await fetch(`${TABLE_URL}?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers: headers(currentSession.access_token), keepalive: true })
        : await fetch(`${TABLE_URL}?on_conflict=key`, {
          method: 'POST', headers: { ...headers(currentSession.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key, value }]), keepalive: true,
        })
      await readResponse(response)
      const pending = readPending()
      const queued = pending[key]
      if (queued && queued.removed === removed && (removed || JSON.stringify(queued.value) === JSON.stringify(value))) {
        delete pending[key]
        savePending(pending)
      }
      if (!stopped) onStatus('online')
    }
    const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(operation).catch((error) => { if (!stopped) onStatus('error', error.message || 'Erreur inconnue') })
    writes.set(key, next)
  }

  Storage.prototype.setItem = function (key, value) {
    originalSet.call(this, key, value)
    if (this === localStorage && syncedStorageKeys.includes(String(key))) {
      let parsed = value
      try { parsed = JSON.parse(value) } catch { /* keep text values as text */ }
      const pending = readPending()
      pending[String(key)] = { value: parsed, removed: false }
      savePending(pending)
      schedule(String(key), parsed)
    }
  }
  Storage.prototype.removeItem = function (key) {
    originalRemove.call(this, key)
    if (this === localStorage && syncedStorageKeys.includes(String(key))) {
      const pending = readPending()
      pending[String(key)] = { value: null, removed: true }
      savePending(pending)
      schedule(String(key), null, true)
    }
  }

  const pending = readPending()
  Object.entries(pending).forEach(([key, queued]) => {
    if (syncedStorageKeys.includes(key)) schedule(key, queued.value, queued.removed)
  })

  return () => {
    stopped = true
    Storage.prototype.setItem = originalSet
    Storage.prototype.removeItem = originalRemove
  }
}
