import { useEffect, useState } from 'react'
import './App.css'
import { applyCloudState, clearCloudSession, importCloudBackup, initializeCloudFromThisDevice, loadCloudState, restoreSession, signIn, startLocalStorageSync } from './cloudSync.js'

const navItems = [
  { label: 'Vue générale', icon: '◫' },
  { label: 'Carburant', icon: '◉' },
  { label: 'Parc matériel', icon: '▦' },
  { label: 'Enrochement', icon: '◩' },
  { label: 'Compteurs horaires', icon: '◷' },
  { label: 'Rapports', icon: '▤' },
]

const weatherDescriptions = { 0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte', 61: 'Pluie faible', 63: 'Pluie', 65: 'Pluie forte', 80: 'Averses faibles', 81: 'Averses', 82: 'Fortes averses', 95: 'Orage' }

function BizerteWeather() {
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState(false)
  const [localTime, setLocalTime] = useState(() => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))

  useEffect(() => {
    const updateClock = () => setLocalTime(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))
    updateClock()
    const clockInterval = window.setInterval(updateClock, 30_000)
    let active = true
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.2744&longitude=9.8739&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=Africa%2FTunis')
      .then((response) => {
        if (!response.ok) throw new Error('Météo indisponible')
        return response.json()
      })
      .then((data) => { if (active) setWeather({ ...data.current, sunrise: data.daily?.sunrise?.[0], sunset: data.daily?.sunset?.[0], elevation: data.elevation }) })
      .catch(() => { if (active) setWeatherError(true) })
    return () => { active = false; window.clearInterval(clockInterval) }
  }, [])

  const windDirection = (degrees) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(degrees / 45) % 8]

  return <div className="weather-card" aria-label="Météo actuelle à Bizerte">
    <div className="weather-overview"><div className="weather-main"><span className="weather-symbol">{weather ? (weather.weather_code === 0 ? '☀' : weather.weather_code <= 3 ? '⛅' : '🌧') : '◌'}</span><div><strong>{weather ? `${Math.round(weather.temperature_2m)}°C` : weatherError ? 'Météo indisponible' : 'Chargement…'}</strong><span>{weather ? (weatherDescriptions[weather.weather_code] || 'Conditions variables') : 'Bizerte'}</span></div></div>
      {weather && <div className="weather-wind"><span>↗</span> Vent {Math.round(weather.wind_speed_10m)} km/h · {windDirection(weather.wind_direction_10m)}</div>}
    </div>
    <div className="weather-details">
      <div><span>Sunrise</span><strong>{weather?.sunrise?.split('T')?.[1] || '—'}</strong></div>
      <div><span>Sunset</span><strong>{weather?.sunset?.split('T')?.[1] || '—'}</strong></div>
      <div><span>Local time</span><strong>{localTime ? `${localTime} (UTC +1)` : '—'}</strong></div>
      <div><span>Elevation</span><strong>{weather?.elevation ? `${Math.round(weather.elevation)} m` : '2 m'}</strong></div>
    </div>
  </div>
}

const fuelStorageKey = 'sotutrasm-fuel-records'
const deliveryStorageKey = 'sotutrasm-fuel-deliveries'
const driverStorageKey = 'sotutrasm-custom-drivers'
const confirmedMonthlyFuelTotals = { '2026-03': 2101, '2026-04': 6856, '2026-05': 8057, '2026-06': 12045, '2026-07': 2664, '2026-08': 782, '2026-09': 9257, '2026-10': 9048, '2026-11': 1756 }
const enrochementBeforeAugust2026Tonnes = { '1/500': 22465.76, '1/3T': 9338.79 }

function fuelMonthlyTotal(records, baseline, key) {
  const parsedBaselineTime = Date.parse(baseline.baselineAt || '')
  const baselineTime = Number.isFinite(parsedBaselineTime) ? parsedBaselineTime : Date.now()
  const recordedTotal = records.filter((record) => record.date?.startsWith(key)).reduce((sum, record) => sum + Number(record.liters || 0), 0)
  const confirmedTotal = Number(baseline.monthlyConsumption?.[key] ?? confirmedMonthlyFuelTotals[key] ?? 0)
  const addedSinceBaseline = records.filter((record) => !record.sourceFile && record.date?.startsWith(key) && record.recordedAt && Date.parse(record.recordedAt) >= baselineTime).reduce((sum, record) => sum + Number(record.liters || 0), 0)
  return confirmedTotal ? confirmedTotal + addedSinceBaseline : recordedTotal
}

const defaultFuelEquipment = [
  'NQ -239 TU 9589',
  'DMAX -256 TU 7994',
  'ISUZU - 235 TU 6359',
  'Komatsu 300',
  'Hyundai 290',
  'Hyundai 300',
  'Hitachi ZAXIS190W',
  'SAWL500',
  'Hidromec',
  'Liebherr R 954C',
  'SOCMA HNFY200',
  'SUMITOMO SH450',
  'SCANIA 410',
  'MAN TGS41.400',
  'Groupe electrogene',
  'COMPAAIR C76-315',
  'COMPAAIR C76-314',
  'Peugeot Expert',
]
const defaultFuelDrivers = [
  'Jamel Ben Aissa',
  'Zouhaier Hedhli',
  'Abderrahmen',
  'Ali Jbeli',
  'Khemais Bejaoui',
  'Lassad Dridi',
  'Mounir Jouini',
  'Oussama Landolssi',
  'Habib Ben Fraj',
  'Hamdi Kouki',
  'Khmaies Landolssi',
]

function loadFuelRecords() {
  let records = []
  try { records = JSON.parse(localStorage.getItem(fuelStorageKey) || '[]') } catch { return [] }
  let corrected = false
  const updated = records.map((record) => {
    const equipment = (record.equipment || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('fr')
    if (record.date === '2026-11-01' && equipment === 'SUMITOMO SH450' && Number(record.liters) === 99.99) {
      corrected = true
      return { ...record, liters: 100 }
    }
    return record
  })
  if (corrected) {
    localStorage.setItem(fuelStorageKey, JSON.stringify(updated))
    localStorage.setItem('sotutrasm-fuel-correction-message', 'SUMITOMO SH450 · 01/11/2026 : consommation corrigée à 100 L.')
  }
  return updated
}

function loadReservoirBaseline() {
  try {
    const saved = localStorage.getItem('sotutrasm-reservoir-baseline')
    if (saved) {
      const baseline = JSON.parse(saved)
      if (baseline.liters === 10912 && baseline.balanceDate === '2026-11-04') {
        const monthlyConsumption = { '2026-10': 9048, '2026-11': 1756, ...(baseline.monthlyConsumption || {}) }
        const updated = { ...baseline, monthlyConsumption }
        localStorage.setItem('sotutrasm-reservoir-baseline', JSON.stringify(updated))
        return updated
      }
    }
  } catch { /* use the confirmed balance below */ }
  const baseline = { liters: 10912, balanceDate: '2026-11-04', baselineAt: new Date().toISOString(), monthlyConsumption: { '2026-10': 9048, '2026-11': 1756 } }
  localStorage.setItem('sotutrasm-reservoir-baseline', JSON.stringify(baseline))
  return baseline
}

function readReservoirBaseline() {
  try {
    const saved = localStorage.getItem('sotutrasm-reservoir-baseline')
    return saved ? JSON.parse(saved) : loadReservoirBaseline()
  } catch { return loadReservoirBaseline() }
}

function FuelModule() {
  const [records, setRecords] = useState(loadFuelRecords)
  const [customDrivers, setCustomDrivers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(driverStorageKey) || '[]').filter((driver) => typeof driver === 'string') } catch { return [] }
  })
  const [newDriverName, setNewDriverName] = useState('')
  const [driverMessage, setDriverMessage] = useState('')
  const [reservoirBaseline, setReservoirBaseline] = useState(loadReservoirBaseline)
  const [tankCapacity, setTankCapacity] = useState(() => {
    const saved = Number(localStorage.getItem('sotutrasm-fuel-tank-capacity'))
    return Number.isFinite(saved) && saved > 0 ? saved : 10912 / 0.8613
  })
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [recordEditMessage, setRecordEditMessage] = useState('')
  const [correctionMessage] = useState(() => {
    const message = localStorage.getItem('sotutrasm-fuel-correction-message') || ''
    if (message) localStorage.removeItem('sotutrasm-fuel-correction-message')
    return message
  })
  const [stockSnapshot, setStockSnapshot] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sotutrasm-fuel-stock') || 'null') } catch { return null }
  })
  const [deliveries, setDeliveries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(deliveryStorageKey) || '[]') } catch { return [] }
  })
  const [saved, setSaved] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const fuelEquipmentOptions = (() => {
    let fleetAssets = []
    try { fleetAssets = JSON.parse(localStorage.getItem('sotutrasm-fleet-assets') || '[]') } catch { /* use the built-in equipment list */ }
    const additionalAssets = [...fleetAssets.map((asset) => asset.name), ...records.map((record) => record.equipment)].map((name) => name && name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'))
    return [...new Set([...defaultFuelEquipment, ...additionalAssets])]
  })()
  const fuelDriverOptions = (() => {
    let fleetAssets = []
    try { fleetAssets = JSON.parse(localStorage.getItem('sotutrasm-fleet-assets') || '[]') } catch { /* use the built-in driver list */ }
    const additionalDrivers = [...records.map((record) => record.driver), ...fleetAssets.map((asset) => asset.responsible)]
      .filter((name) => name && name !== '—').map((name) => name.trim()).filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'))
    return [...new Set([...defaultFuelDrivers, ...customDrivers, ...additionalDrivers])].sort((a, b) => a.localeCompare(b, 'fr'))
  })()
  const editingRecord = records.find((record) => record.id === editingRecordId)

  useEffect(() => {
    localStorage.setItem(fuelStorageKey, JSON.stringify(records))
  }, [records])

  useEffect(() => {
    localStorage.setItem(driverStorageKey, JSON.stringify(customDrivers))
  }, [customDrivers])

  function addDriver(event) {
    event.preventDefault()
    const name = newDriverName.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (fuelDriverOptions.some((driver) => driver.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) {
      setDriverMessage('Ce chauffeur figure déjà dans la liste.')
      return
    }
    setCustomDrivers((current) => [...current, name].sort((a, b) => a.localeCompare(b, 'fr')))
    setNewDriverName('')
    setDriverMessage(`${name} a été ajouté à la liste.`)
  }

  function removeDriver(name) {
    setCustomDrivers((current) => current.filter((driver) => driver !== name))
    setDriverMessage(`${name} a été retiré de la liste personnalisée. Il peut rester proposé s’il figure dans une ancienne consommation ou dans le parc matériel.`)
  }

  useEffect(() => {
    if (stockSnapshot) localStorage.setItem('sotutrasm-fuel-stock', JSON.stringify(stockSnapshot))
  }, [stockSnapshot])

  useEffect(() => {
    localStorage.setItem('sotutrasm-reservoir-baseline', JSON.stringify(reservoirBaseline))
  }, [reservoirBaseline])

  useEffect(() => {
    localStorage.setItem(deliveryStorageKey, JSON.stringify(deliveries))
  }, [deliveries])

  function addRecord(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const record = {
      id: crypto.randomUUID(),
      date: form.get('date'),
      equipment: form.get('equipment'),
      driver: form.get('driver') || '—',
      ficheConso: form.get('ficheConso').trim(),
      liters: Number(form.get('liters')),
      pumpIndex: form.get('pumpIndex') === '' ? null : Number(form.get('pumpIndex')),
      hourmeterCounter: form.get('hourmeterCounter') === '' ? null : Number(form.get('hourmeterCounter')),
      kilometerCounter: form.get('kilometerCounter') === '' ? null : Number(form.get('kilometerCounter')),
      recordedAt: new Date().toISOString(),
    }
    setRecords((current) => [record, ...current])
    event.currentTarget.reset()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  function saveFuelRecord(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const changes = {
      date: form.get('date'),
      equipment: form.get('equipment'),
      driver: form.get('driver') || '—',
      ficheConso: form.get('ficheConso').trim(),
      liters: Number(form.get('liters')),
      pumpIndex: form.get('pumpIndex') === '' ? null : Number(form.get('pumpIndex')),
      hourmeterCounter: form.get('hourmeterCounter') === '' ? null : Number(form.get('hourmeterCounter')),
      kilometerCounter: form.get('kilometerCounter') === '' ? null : Number(form.get('kilometerCounter')),
    }
    setRecords((current) => current.map((record) => record.id === editingRecordId ? { ...record, ...changes } : record))
    setEditingRecordId(null)
    setRecordEditMessage('La consommation a été mise à jour.')
    window.setTimeout(() => setRecordEditMessage(''), 3000)
  }

  function addDelivery(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const delivery = {
      id: crypto.randomUUID(),
      date: form.get('date'),
      liters: Number(form.get('liters')),
      supplier: form.get('supplier').trim() || '—',
      reference: form.get('reference').trim() || '—',
      recordedAt: new Date().toISOString(),
    }
    setDeliveries((current) => [delivery, ...current])
    event.currentTarget.reset()
    setDeliveryMessage(`Réception enregistrée : ${new Intl.NumberFormat('fr-TN').format(delivery.liters)} L ajoutés au stock.`)
    window.setTimeout(() => setDeliveryMessage(''), 4000)
  }

  async function importCsv(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const bytes = await file.arrayBuffer()
      let content
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { content = new TextDecoder('windows-1252').decode(bytes) }
      const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.split(';'))
      const headerIndex = lines.findIndex((line) => line[0]?.toLowerCase().includes('engin') && line.some((cell) => /^\d{2}\/\d{2}$/.test(cell.trim())))
      if (headerIndex < 0) throw new Error('Ligne de titres avec les jours introuvable.')
      const months = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 }
      const period = content.match(/(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})/i)
      if (!period) throw new Error('Mois et année introuvables dans le titre du fichier.')
      const month = months[period[1].toLocaleLowerCase('fr')]
      const year = Number(period[2])
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const sourceFigures = (lines[0] || []).slice(1).map((cell) => cell.trim().replace(/[\s\u00a0]/g, '')).filter((cell) => /^\d+$/.test(cell)).map(Number)
      const headers = lines[headerIndex]
      const dateColumns = headers.map((header, index) => ({ header: header.trim(), index })).filter(({ header }) => /^\d{2}\/\d{2}$/.test(header))
      const imported = []
      for (const row of lines.slice(headerIndex + 1)) {
        const equipment = row[0]?.trim()
        if (!equipment || equipment.toLocaleUpperCase('fr').startsWith('TOTAL')) continue
        for (const column of dateColumns) {
          const value = row[column.index]?.trim().replace(/[\s\u00a0]/g, '').replace(',', '.')
          const liters = Number(value)
          if (!Number.isFinite(liters) || liters <= 0) continue
          const [day, sourceMonth] = column.header.split('/').map(Number)
          if (sourceMonth !== month) continue
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          imported.push({ id: `${file.name}:${date}:${equipment}`, date, equipment, driver: row[1]?.trim() || '—', liters, sourceFile: file.name })
        }
      }
      if (!imported.length) throw new Error('Aucune consommation quotidienne positive trouvée.')
      const importedIds = new Set(imported.map((record) => record.id))
      setRecords((current) => [...imported, ...current.filter((record) => !importedIds.has(record.id))])
      if (sourceFigures.length >= 3) {
        const balanceDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        const baselineAt = new Date().toISOString()
        setReservoirBaseline((current) => ({ ...current, liters: sourceFigures[1], balanceDate, baselineAt, monthlyConsumption: { ...(current.monthlyConsumption || {}), [`${year}-${String(month).padStart(2, '0')}`]: sourceFigures[2] } }))
        setStockSnapshot({ opening: sourceFigures[0], current: sourceFigures[1], reportedConsumption: sourceFigures[2], month: `${year}-${String(month).padStart(2, '0')}`, balanceDate, periodLabel: `${period[1]} ${year}`, baselineAt })
      }
      setImportMessage(`${imported.length} lignes quotidiennes importées depuis ${file.name}.`)
    } catch (error) {
      setImportMessage(`Import impossible : ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const totalLiters = records.reduce((sum, item) => sum + item.liters, 0)
  const monthlyTotalKeys = [...new Set([...Object.keys(confirmedMonthlyFuelTotals), ...Object.keys(reservoirBaseline.monthlyConsumption || {}), ...records.map((record) => record.date?.slice(0, 7)).filter(Boolean)])]
  const monthlyConsumptionTotal = monthlyTotalKeys.reduce((sum, key) => sum + fuelMonthlyTotal(records, reservoirBaseline, key), 0)
  const equipmentCount = new Set(records.map((item) => item.equipment)).size
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 })
  const periodLiters = stockSnapshot ? records.filter((item) => item.date.startsWith(stockSnapshot.month)).reduce((sum, item) => sum + item.liters, 0) : totalLiters
  const stockReconciles = stockSnapshot && stockSnapshot.opening - stockSnapshot.current === stockSnapshot.reportedConsumption && periodLiters === stockSnapshot.reportedConsumption
  const baselineTime = Date.parse(reservoirBaseline.baselineAt)
  const receivedSinceBaseline = deliveries.filter((delivery) => Date.parse(delivery.recordedAt) >= baselineTime).reduce((sum, delivery) => sum + delivery.liters, 0)
  const usedSinceBaseline = records.filter((record) => !record.sourceFile && record.recordedAt && Date.parse(record.recordedAt) >= baselineTime).reduce((sum, record) => sum + record.liters, 0)
  const currentStock = Math.max(0, reservoirBaseline.liters + receivedSinceBaseline - usedSinceBaseline)
  const stockLevelClass = currentStock > 6000 ? 'stock-level-high' : currentStock >= 4000 ? 'stock-level-medium' : 'stock-level-low'
  const tankLevel = tankCapacity ? Math.min(100, currentStock / Number(tankCapacity) * 100) : null
  const today = new Date()
  const currentMonthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0')
  const currentMonthLabel = today.toLocaleDateString('fr-TN', { month: 'long' })
  const currentMonthConsumption = Number(reservoirBaseline.monthlyConsumption?.[currentMonthKey] ?? confirmedMonthlyFuelTotals[currentMonthKey] ?? 0) + records.filter((record) => !record.sourceFile && record.date?.startsWith(currentMonthKey) && record.recordedAt && Date.parse(record.recordedAt) >= baselineTime).reduce((sum, record) => sum + Number(record.liters || 0), 0)
  const latestPumpIndexRecord = [...records].filter((record) => record.pumpIndex !== null && record.pumpIndex !== '' && Number.isFinite(Number(record.pumpIndex))).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.recordedAt || 0) - Date.parse(a.recordedAt || 0))[0]
  const summaryItems = (stockSnapshot
    ? [
        { label: `Stock au début · ${stockSnapshot.periodLabel}`, value: stockSnapshot.opening, unit: 'L' },
        { label: `Consommation · ${stockSnapshot.periodLabel}`, value: periodLiters, unit: 'L' },
        { label: 'Réceptions depuis le bilan', value: receivedSinceBaseline, unit: 'L' },
        { label: 'Litres restants', value: currentStock, unit: 'L' },
      ]
    : [
        { label: 'Consommation depuis mars 2025', value: monthlyConsumptionTotal, unit: 'L' },
        { label: `Consommé ce mois · ${currentMonthLabel}`, value: currentMonthConsumption, unit: 'L' },
        { label: 'Litres restants dans le réservoir', value: currentStock, unit: 'L' },
      ]).concat([{ label: 'Dernier index pompe', value: latestPumpIndexRecord ? Number(latestPumpIndexRecord.pumpIndex) : null, unit: 'L', hint: latestPumpIndexRecord ? latestPumpIndexRecord.equipment + ' · ' + new Date(latestPumpIndexRecord.date + 'T00:00:00').toLocaleDateString('fr-TN') : 'Aucun index renseigné pour le moment.' }])

  return (
    <div className="fuel-page">
      <div className="fuel-title-row"><div><div className="eyebrow">GESTION DES OPÉRATIONS</div><h1>Carburant</h1><p>Consommation quotidienne par engin et historique des saisies.</p></div><span className="local-badge"><i/> Données enregistrées dans ce navigateur</span></div>
      <div className="fuel-summary has-stock">
        {summaryItems.map((item) => (
          <article className={`fuel-summary-card ${item.label.startsWith('Litres restants') ? stockLevelClass : ''}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value === null ? '—' : numberFormat.format(item.value)} {item.unit && item.value !== null && <small>{item.unit}</small>}</strong>
            {item.hint && <small className="summary-hint">{item.hint}</small>}
          </article>
        ))}
      </div>
      <section className="panel fuel-gauge-panel">
        <div className="fuel-gauge-copy"><div className="panel-header"><div><h2>Jauge du réservoir</h2><p>Niveau calculé avec le stock enregistré, les réceptions et les consommations.</p></div></div>
          <label>Capacité réelle du réservoir (L)<input type="number" min="1" step="1" placeholder="À renseigner" value={tankCapacity} onChange={(event) => { const value = event.target.value; setTankCapacity(value === '' ? '' : Number(value)); if (value === '') localStorage.removeItem('sotutrasm-fuel-tank-capacity'); else localStorage.setItem('sotutrasm-fuel-tank-capacity', String(Number(value))) }} /></label>
          {tankLevel === null ? <p className="fuel-gauge-note">Saisissez la capacité indiquée sur votre réservoir pour afficher son pourcentage réel.</p> : <p className="fuel-gauge-note">Le niveau est plafonné à 100 % sur la jauge. Stock calculé : {numberFormat.format(currentStock)} L.</p>}
        </div>
        <div className="fuel-dial" role="img" aria-label={tankLevel === null ? `Stock actuel : ${numberFormat.format(currentStock)} litres. Capacité à renseigner.` : `Réservoir à ${numberFormat.format(tankLevel)} pour cent, ${numberFormat.format(currentStock)} litres sur ${numberFormat.format(Number(tankCapacity))}.`}>
          <svg viewBox="0 0 300 175" aria-hidden="true">
            <path className="fuel-dial-track" d="M 38 145 A 112 112 0 0 1 262 145" />
            <path className={`fuel-dial-fill ${stockLevelClass}`} d="M 38 145 A 112 112 0 0 1 262 145" pathLength="100" strokeDasharray={tankLevel === null ? '0 100' : `${tankLevel} 100`} />
            {[0, 25, 50, 75, 100].map((tick) => { const angle = Math.PI - tick / 100 * Math.PI; const x = 150 + Math.cos(angle) * 126; const y = 145 - Math.sin(angle) * 126; return <text key={tick} x={x} y={y} className="fuel-dial-tick">{tick}</text> })}
            {tankLevel !== null && <g transform={`rotate(${-90 + tankLevel * 1.8} 150 145)`}><line x1="150" y1="145" x2="150" y2="47" className="fuel-dial-needle" /><circle cx="150" cy="145" r="6" className="fuel-dial-hub" /></g>}
          </svg>
          <div className="fuel-dial-reading"><b>{tankLevel === null ? '— %' : `${numberFormat.format(tankLevel)} %`}</b><strong className={stockLevelClass}>{numberFormat.format(currentStock)}</strong><span>litres restants</span></div>
          <div className="fuel-dial-ends"><span>E · vide</span><span>F · plein</span></div>
          {tankCapacity && <div className="fuel-dial-capacity">Capacité : {numberFormat.format(Number(tankCapacity))} L</div>}
        </div>
      </section>
      {correctionMessage && <div className="stock-reconciliation valid"><span>✓</span>{correctionMessage}</div>}
      {stockSnapshot ? (
        <div className={stockReconciles ? 'stock-reconciliation valid' : 'stock-reconciliation review'}>
          <span>{stockReconciles ? '✓' : '!'}</span>
          {stockReconciles ? (
            <>Bilan vérifié : {numberFormat.format(stockSnapshot.opening)} L − {numberFormat.format(stockSnapshot.current)} L = {numberFormat.format(periodLiters)} L consommés.</>
          ) : (
            <>Écart à vérifier : le stock de départ moins le stock restant ne correspond pas au détail quotidien.</>
          )}
        </div>
      ) : null}
      <section className="panel fuel-form-panel"><div className="panel-header"><div><h2>Saisir une consommation</h2><p>Ajoutez une consommation journalière ou importez un fichier CSV.</p></div><label className="import-button">Importer un CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label></div>
        <form className="fuel-form" onSubmit={addRecord}>
          <label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
          <label>Engin / véhicule<select name="equipment" defaultValue="" required><option value="" disabled>Choisir un engin ou un véhicule</option>{fuelEquipmentOptions.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}</select></label>
          <label>Chauffeur / responsable <span className="optional">(facultatif)</span><select name="driver" defaultValue=""><option value="">Choisir un nom</option>{fuelDriverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
          <label>Fiche conso N° <span className="optional">(carnet papier)</span><input name="ficheConso" type="text" placeholder="N° de la fiche" /></label>
          <label>Consommation (litres)<input name="liters" type="number" min="0.01" step="0.01" placeholder="Ex. 120" required /></label>
          <label>Index compteur de la pompe (L) <span className="optional">(facultatif)</span><input name="pumpIndex" type="number" min="0" step="0.01" placeholder="Index affiché par la pompe" /></label>
          <label>Compteur horaire (h) <span className="optional">(facultatif)</span><input name="hourmeterCounter" type="number" min="0" step="0.1" placeholder="Index horaire de l’engin" /></label>
          <label>Compteur kilométrique (km) <span className="optional">(facultatif)</span><input name="kilometerCounter" type="number" min="0" step="0.1" placeholder="Kilométrage du véhicule" /></label>
          <div className="form-actions">{saved && <span className="save-confirmation">✓ Consommation enregistrée</span>}<button type="submit" className="primary-button">＋ Ajouter la consommation</button></div>
        </form>
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
      </section>
      <section className="panel driver-manager-panel">
        <div className="panel-header"><div><h2>Gérer les chauffeurs</h2><p>Ajoute un nom pour le retrouver dans la liste de saisie carburant.</p></div></div>
        <form className="driver-manager-form" onSubmit={addDriver}>
          <label htmlFor="new-fuel-driver">Nom du chauffeur</label>
          <input id="new-fuel-driver" value={newDriverName} onChange={(event) => setNewDriverName(event.target.value)} placeholder="Ex. Mohamed Ben Ali" />
          <button type="submit" className="primary-button">＋ Ajouter un chauffeur</button>
        </form>
        {driverMessage && <p className="import-message" role="status">{driverMessage}</p>}
        {customDrivers.length > 0 && <div className="driver-manager-list"><strong>Chauffeurs ajoutés</strong>{customDrivers.map((driver) => <div className="driver-manager-row" key={driver}><span>{driver}</span><button type="button" className="delete-asset" onClick={() => removeDriver(driver)}>Retirer</button></div>)}</div>}
      </section>
      <section className="panel delivery-panel">
        <div className="panel-header"><div><h2>Enregistrer une réception de gasoil</h2><p>Une livraison augmente le stock disponible à partir de la quantité saisie.</p></div></div>
        <form className="delivery-form" onSubmit={addDelivery}>
          <label>Date de réception<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
          <label>Quantité reçue (litres)<input name="liters" type="number" min="0.01" step="0.01" placeholder="Ex. 10000" required /></label>
          <label>Fournisseur <span className="optional">(facultatif)</span><input name="supplier" placeholder="Nom du fournisseur" /></label>
          <label>Bon de livraison <span className="optional">(facultatif)</span><input name="reference" placeholder="N° du bon" /></label>
          <div className="form-actions"><button type="submit" className="primary-button">＋ Enregistrer la réception</button></div>
        </form>
        {deliveryMessage && <p className="import-message" role="status">{deliveryMessage}</p>}
        {deliveries.length > 0 && <div className="delivery-history"><strong>Réceptions enregistrées</strong>{deliveries.slice(0, 5).map((delivery) => <div className="delivery-row" key={delivery.id}><span>{new Date(`${delivery.date}T00:00:00`).toLocaleDateString('fr-TN')}</span><span>{delivery.supplier}</span><strong>+{numberFormat.format(delivery.liters)} L</strong></div>)}</div>}
      </section>
      <section className="panel fuel-history">
        <div className="panel-header"><div><h2>Consommation par jour</h2><p>{records.length ? `${records.length} journées · ${numberFormat.format(totalLiters)} L au total` : 'Les données importées et saisies apparaîtront ici.'}</p></div></div>
        {recordEditMessage && <p className="import-message" role="status">{recordEditMessage}</p>}
        {editingRecord && <form className="fuel-record-edit" key={editingRecord.id} onSubmit={saveFuelRecord}>
          <div className="fleet-edit-heading"><strong>Modifier la consommation du {new Date(editingRecord.date + 'T00:00:00').toLocaleDateString('fr-TN')}</strong><button type="button" onClick={() => setEditingRecordId(null)}>Annuler</button></div>
          <div className="fuel-record-edit-fields">
            <label>Date<input name="date" type="date" defaultValue={editingRecord.date} required /></label>
            <label>Engin / véhicule<select name="equipment" defaultValue={editingRecord.equipment} required>{fuelEquipmentOptions.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}</select></label>
            <label>Chauffeur / responsable<select name="driver" defaultValue={editingRecord.driver === '—' ? '' : editingRecord.driver}><option value="">Choisir un nom</option>{fuelDriverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
            <label>Fiche conso N°<input name="ficheConso" type="text" defaultValue={editingRecord.ficheConso || ''} /></label>
            <label>Consommation (litres)<input name="liters" type="number" min="0.01" step="0.01" defaultValue={editingRecord.liters} required /></label>
            <label>Index compteur de la pompe (L)<input name="pumpIndex" type="number" min="0" step="0.01" defaultValue={editingRecord.pumpIndex ?? ''} /></label>
            <label>Compteur horaire (h)<input name="hourmeterCounter" type="number" min="0" step="0.1" defaultValue={editingRecord.hourmeterCounter ?? ''} /></label>
            <label>Compteur kilométrique (km)<input name="kilometerCounter" type="number" min="0" step="0.1" defaultValue={editingRecord.kilometerCounter ?? ''} /></label>
            <button type="submit" className="primary-button">Enregistrer les modifications</button>
          </div>
        </form>}
        {records.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Engin / véhicule</th><th>Chauffeur / responsable</th><th>Fiche conso N°</th><th>Consommation</th><th>Index pompe</th><th className="fuel-counter-heading fuel-counter-hours">Compteur horaire<br/>(h)</th><th className="fuel-counter-heading fuel-counter-kilometers">Compteur kilométrique<br/>(km)</th><th>Action</th></tr></thead><tbody>{[...records].sort((a, b) => b.date.localeCompare(a.date) || a.equipment.localeCompare(b.equipment)).map((record) => <tr key={record.id}><td>{new Date(`${record.date}T00:00:00`).toLocaleDateString('fr-TN')}</td><td><strong>{record.equipment}</strong></td><td>{record.driver || '—'}</td><td>{record.ficheConso || '—'}</td><td>{numberFormat.format(record.liters)} L</td><td>{record.pumpIndex == null ? '—' : numberFormat.format(record.pumpIndex) + ' L'}</td><td>{record.hourmeterCounter == null ? '—' : numberFormat.format(record.hourmeterCounter) + ' h'}</td><td>{record.kilometerCounter == null ? '—' : numberFormat.format(record.kilometerCounter) + ' km'}</td><td><button className="edit-asset" onClick={() => setEditingRecordId(record.id)}>Modifier</button></td></tr>)}</tbody></table></div> : <div className="empty-history"><span>◉</span><strong>Aucune consommation enregistrée</strong><p>Importez le CSV ou saisissez une consommation ci-dessus.</p></div>}
      </section>
    </div>
  )
}

const fleetStorageKey = 'sotutrasm-fleet-assets'
const assetStatuses = ['En service', 'À l’arrêt', 'En maintenance', 'À confirmer']
const assetParks = ['Bizerte', 'Sfax', 'Sidi Bousaid', 'Sidi Abdelhamid', 'Monastir']
const assetAliases = {
  name: ['designation', 'engin', 'vehicule', 'enginvehicule', 'materiel', 'materiels', 'equipment', 'equipement', 'machine', 'asset', 'nom', 'name'],
  reference: ['immatriculation', 'matricule', 'reference', 'ref', 'numero', 'id'],
  category: ['categorie', 'category', 'type', 'typedengin', 'typequipement'],
  responsible: ['responsable', 'chauffeur', 'conducteur', 'affecte', 'affectation', 'operator'],
  park: ['parc', 'site', 'chantier', 'agence'],
  status: ['etat', 'statut', 'status', 'situation'],
}

function normalizeCsvHeader(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]/g, '')
}

const fleetPhotoCatalog = [
  { aliases: ['SOCMA HNFY200', 'HNFY200'], src: '/fleet-assets/socma-hnfy200.png' },
  { aliases: ['HMK300 LC-2', 'Hidromec'], src: '/fleet-assets/hidromec-hmk300.png' },
  { aliases: ['ROBEX 290', 'Hyundai 290'], src: '/fleet-assets/hyundai-robex290.png' },
  { aliases: ['ZAXIS190W'], src: '/fleet-assets/hitachi-zaxis190w.png' },
  { aliases: ['R954C'], src: '/fleet-assets/liebherr-r954c.png' },
  { aliases: ['SAW L 500', 'SAWL500'], src: '/fleet-assets/sawl500.png' },
  { aliases: ['ZE385G', 'ZoomLion'], src: '/fleet-assets/zoomlion-ze385g.png' },
  { aliases: ['SH450'], src: '/fleet-assets/sumitomo-sh450.png' },
  { aliases: ['PC350', 'Komatsu 300'], src: '/fleet-assets/komatsu-pc350.png' },
  { aliases: ['ROBEX 300', 'Hyundai 300'], src: '/fleet-assets/hyundai-robex300.png' },
  { aliases: ['Groupe electrogene', 'APT DW-G08ME3'], src: '/fleet-assets/groupe-electrogene.png' },
  { aliases: ['AMAROK'], src: '/fleet-assets/vw-amarok.png' },
  { aliases: ['ISUZU', 'DMAX'], src: '/fleet-assets/isuzu-dmax.png' },
  { aliases: ['PEUGEOT Expert'], src: '/fleet-assets/peugeot-expert.png' },
  { aliases: ['VIRTUS'], src: '/fleet-assets/vw-virtus.png' },
  { aliases: ['C76-314'], src: '/fleet-assets/compair-c76-314.png' },
  { aliases: ['C76-315'], src: '/fleet-assets/compair-c76-315.png' },
]

function fleetPhotoForName(name) {
  const normalizedName = normalizeCsvHeader(name || '')
  const photo = fleetPhotoCatalog.find(({ aliases }) => aliases.some((alias) => normalizedName.includes(normalizeCsvHeader(alias))))?.src
  return photo ? `${import.meta.env.BASE_URL}${photo.replace(/^\//, '')}` : ''
}

const fleetIdentityCatalog = [
  { aliases: ['MAN TGS41.400', 'MAN 41400'], details: [['N° de parc', '40107007'], ['Marque', 'MAN'], ['Modèle', 'TGS 41.400 BB CH'], ['Immatriculation', '173 TU 6630'], ['Type d’engin', 'Camion porteur lourd'], ['Poids opérationnel', '32 000 kg'], ['Poids à vide moyen', '~ 13 000 à 16 000 kg'], ['Moteur', 'MAN D2066 LF · 6 cylindres en ligne · injection rampe commune'], ['Capacité de charge', '26 000 kg · 18 à 21 m³'], ['Dimensions (L × l × H)', '~ 8,50 × 2,50 × 3,45 m'], ['Configuration des essieux', '8×4 · 4 essieux'], ['Réservoir', '~ 300 à 400 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Hamdi Kouki']] },
  { aliases: ['SCANIA 410', 'SCA410'], details: [['Marque', 'SCANIA'], ['Modèle', '410 · séries P410, G410 ou R410'], ['N° de série / châssis', 'YS2P8X40009176167'], ['Immatriculation', '167 TU 2899'], ['Type d’engin', 'Camion porteur lourd'], ['Poids opérationnel', '40 000 kg'], ['Poids à vide moyen', '~ 11 000 à 14 000 kg'], ['Puissance moteur', '302 kW · 1 900 RPM · 410 ch'], ['Moteur', 'Scania DC13 · 6 cylindres en ligne · 13 L'], ['Capacité de charge', '18 000 à 21 000 kg'], ['Dimensions', '8,50 à 9,70 m'], ['Configuration des essieux', '8×4 · 4 essieux'], ['Réservoir', '300 à 400 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Habib Ben Fraj']] },
  { aliases: ['SOCMA HNFY200', 'HNFY200'], details: [['Marque', 'SOCMA'], ['Modèle', 'HNFY200'], ['N° de série', '6CTA83-C215'], ['N° de châssis', 'SZ326600'], ['Année de mise en service', '2026'], ['Type d’engin', 'Chariot élévateur thermique lourd'], ['Poids opérationnel', '24 280 kg'], ['Puissance moteur', '160 kW · 2 200 RPM'], ['Moteur', 'Cummins / Yuchai'], ['Charge', '20 000 kg'], ['Dimensions (L × l × H)', '7,50 × 3,05 × 3,50 m'], ['Dimensions des fourches', '2 440 × 280 × 110 mm'], ['Réservoir', '~ 230 à 300 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Oussama Landolssi']] },
  { aliases: ['HIDROMEC', 'HMK300 LC-2'], details: [['N° de parc', '60103014'], ['Marque', 'HIDROMEK'], ['Modèle', 'HMK 300 LC-2'], ['N° de série', 'G125048'], ['N° de châssis', 'HKMH2520V0G125048'], ['Année de mise en service', '2017'], ['Type d’engin', 'Pelle hydraulique sur chenilles'], ['Poids opérationnel', '31 900 kg'], ['Puissance moteur', '147 kW · 216 ch à 1 800 tr/min'], ['Moteur', 'Isuzu AH-6HK1X · 6 cylindres'], ['Capacité du godet', '0,6 à 1,6 m³'], ['Dimensions (L × l × H)', '10,81 × 3,20 × 3,55 m'], ['Réservoir', '480 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Khmaies Bejaoui']] },
  { aliases: ['HYUNDAI 290', 'ROBEX 290'], details: [['N° de parc', '60103005'], ['Marque', 'HYUNDAI'], ['Modèle', 'Robex 290 NLC-7a'], ['N° de série / châssis', 'N80711046'], ['Année de mise en service', '2008'], ['Type d’engin', 'Pelle hydraulique sur chenilles'], ['Poids opérationnel', '29 100 kg'], ['Puissance moteur', '200 kW · 227 ch à 1 900 tr/min'], ['Moteur', 'Cummins QSB6.7 · 6 cylindres turbocompressé'], ['Capacité du godet', '0,79 à 1,85 m³'], ['Dimensions (L × l × H)', '10,70 × 2,99 × 3,29 m'], ['Réservoir', '480 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte']] },
  { aliases: ['SAWL500', 'SAW L 500', 'WL500'], details: [['N° de parc', '60100007'], ['Marque', 'SUPER-ABOVE / Wolf China'], ['Modèle', 'WL500'], ['N° de série / châssis', 'TLS20250102-1'], ['Année de mise en service', '2025'], ['Type d’engin', 'Chargeuse à pelle'], ['Poids opérationnel', '16 900 kg'], ['Puissance moteur', '162 kW · 2 200 RPM · ~ 220 ch'], ['Moteur', 'Weichai WD10G220 E22'], ['Capacité de charge / godet', '5 000 kg · 3,0 m³'], ['Dimensions (L × l × H)', '8,25 × 2,98 × 3,42 m'], ['Taille des pneus', '23.5-25'], ['Réservoir', '~ 250 à 300 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte']] },
  { aliases: ['ZAXIS190W'], details: [['N° de parc', '60103026'], ['Marque', 'HITACHI'], ['Modèle', 'ZAXIS190W-3'], ['N° de série / châssis', 'JK6CHQ04Q0002136'], ['Année de mise en service', '2010'], ['Immatriculation', '21260 م خ'], ['Type d’engin', 'Pelle hydraulique sur pneus'], ['Poids opérationnel', '20 080 kg'], ['Puissance moteur', '120 kW · 154 ch à 2 000 tr/min'], ['Moteur', 'Isuzu 4HK1 / AI-4HK1X · 4 cylindres'], ['Capacité du godet', '0,51 à 1,20 m³'], ['Dimensions (L × l × H)', '8,79 × 2,47 × 3,22 m'], ['Réservoir', '290 à 350 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Laassed Dridi']] },
  { aliases: ['HYUNDAI 300', 'ROBEX300'], details: [['N° de parc', '60103023'], ['Marque', 'HYUNDAI'], ['Modèle', 'Robex 300 LC'], ['Type d’engin', 'Pelle hydraulique sur chenilles'], ['Poids opérationnel', '30 t'], ['Puissance moteur', '185 à 196 kW · 217 à 263 ch à 1 900 tr/min'], ['Moteur', 'Cummins QSB6.7 ou Hyundai D6AC-C / HM8.3'], ['Capacité du godet', '1,27 à 1,85 m³'], ['Dimensions (L × l × H)', '10,70 × 3,20 × 3,29 m'], ['Réservoir', '500 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte']] },
  { aliases: ['SUMITOMO SH450', 'SH450'], details: [['N° de parc', '60103020'], ['Marque', 'SUMITOMO'], ['Modèle', 'SH450'], ['Type d’engin', 'Pelle hydraulique sur chenilles'], ['Poids opérationnel', '45 t'], ['Puissance moteur', '235,4 kW · 315,7 ch à 1 950 tr/min'], ['Moteur', 'Isuzu AA-6SD1X'], ['Capacité du godet', '1,8 à 2,4 m³'], ['Dimensions (L × l × H)', '11,94 × 3,35 × 3,60 m'], ['Réservoir', '610 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte']] },
  { aliases: ['KOMATSU PC350', 'KOMATSU 300'], details: [['N° de parc', '60103027'], ['Marque', 'KOMATSU'], ['Modèle', 'PC350'], ['Type d’engin', 'Pelle hydraulique sur chenilles'], ['Poids opérationnel', '32,6 à 32,96 t'], ['Puissance moteur', '194 kW · 260 ch à 1 950 tr/min'], ['Capacité du godet', '0,52 à 2,3 m³'], ['Réservoir', '605 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte']] },
  { aliases: ['LIEBHERR R954C', 'R954C'], details: [['N° de parc', '60103021'], ['Marque', 'Liebherr'], ['Modèle', 'R 954 C-Litronic'], ['Type d’engin', 'Pelle hydraulique sur chenilles · bras long'], ['Poids opérationnel', '47,3 à 58,6 t'], ['Puissance moteur', '240 kW · 326 ch ISO / 322 ch SAE à 1 800 tr/min'], ['Moteur', 'Liebherr D 936 L · 6 cylindres · 10,5 L'], ['Capacité du godet', '1,25 à 3,50 m³'], ['Dimensions (L × l × H)', '12,15 × 3,72 × 3,90 m'], ['Réservoir', '700 à 750 L'], ['Carburant', 'Diesel'], ['Site / chantier', 'Bizerte'], ['Responsable / conducteur', 'Mounir Jouini']] },
]

function fleetIdentityForAsset(name) {
  const normalizedName = normalizeCsvHeader(name || '')
  return fleetIdentityCatalog.find(({ aliases }) => aliases.some((alias) => normalizedName.includes(normalizeCsvHeader(alias))))?.details || []
}

function parseCsvLine(line, delimiter) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = '' }
    else cell += character
  }
  cells.push(cell.trim())
  return cells
}

function resizeAssetPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('La photo n’a pas pu être lue.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Le fichier sélectionné n’est pas une image valide.'))
      image.onload = () => {
        const scale = Math.min(360 / image.width, 240 / image.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.76))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function FleetModule() {
  const [assets, setAssets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(fleetStorageKey) || '[]') } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tous les états')
  const [message, setMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState(null)

  useEffect(() => {
    localStorage.setItem(fleetStorageKey, JSON.stringify(assets))
  }, [assets])

  async function addAsset(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const photoFile = form.get('photo')
      const asset = {
        id: crypto.randomUUID(),
        name: form.get('name').trim(),
        reference: form.get('reference').trim() || '—',
        category: form.get('category'),
        park: form.get('park') || '',
        responsible: form.get('responsible').trim() || '—',
        status: form.get('status'),
        photo: photoFile?.size ? await resizeAssetPhoto(photoFile) : '',
      }
      setAssets((current) => [asset, ...current])
      event.currentTarget.reset()
      setMessage('Engin ajouté au parc matériel.')
    } catch (error) {
      setMessage(error.message)
    }
    window.setTimeout(() => setMessage(''), 3000)
  }

  async function saveAssetChanges(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const photoFile = form.get('photo')
      const changes = {
        name: form.get('name').trim(),
        reference: form.get('reference').trim() || '—',
        category: form.get('category').trim() || 'À classer',
        park: form.get('park') || '',
        responsible: form.get('responsible') || '—',
        status: form.get('status'),
        ...(photoFile?.size ? { photo: await resizeAssetPhoto(photoFile) } : {}),
      }
      setAssets((current) => current.map((asset) => asset.id === editingId ? { ...asset, ...changes } : asset))
      setEditingId(null)
      setMessage('Les informations de l’engin ont été mises à jour.')
    } catch (error) {
      setMessage(error.message)
    }
    window.setTimeout(() => setMessage(''), 3000)
  }

  async function importFleetCsv(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    try {
      const bytes = await file.arrayBuffer()
      let content
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { content = new TextDecoder('windows-1252').decode(bytes) }
      const rawLines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
      const delimiters = [';', ',', '\t']
      let headerLine = -1
      let delimiter = ';'
      for (let lineIndex = 0; lineIndex < Math.min(rawLines.length, 15) && headerLine < 0; lineIndex += 1) {
        for (const candidate of delimiters) {
          const normalized = parseCsvLine(rawLines[lineIndex], candidate).map(normalizeCsvHeader)
          if (normalized.some((cell) => assetAliases.name.includes(cell))) {
            headerLine = lineIndex
            delimiter = candidate
            break
          }
        }
      }
      if (headerLine < 0) throw new Error('Colonne de désignation introuvable. Vérifie la présence d’une colonne Engin, Désignation ou Nom.')
      const headers = parseCsvLine(rawLines[headerLine], delimiter).map(normalizeCsvHeader)
      const indexes = Object.fromEntries(Object.entries(assetAliases).map(([field, aliases]) => [field, headers.findIndex((header) => aliases.includes(header))]))
      const statusFromCsv = (value) => {
        const status = normalizeCsvHeader(value || '')
        if (/maintenance|reparation|atelier/.test(status)) return 'En maintenance'
        if (/arret|panne|horsservice|immobilise|indisponible|stoppe/.test(status)) return 'À l’arrêt'
        if (/service|actif|operationnel|disponible|fonctionnel/.test(status)) return 'En service'
        return 'À confirmer'
      }
      const imported = rawLines.slice(headerLine + 1).map((line) => {
        const cells = parseCsvLine(line, delimiter)
        const get = (field) => indexes[field] >= 0 ? (cells[indexes[field]] || '').trim() : ''
        const name = get('name')
        if (!name) return null
        const referenceValue = get('reference')
        const reference = /^(-|—|n\/a)$/i.test(referenceValue) ? '—' : referenceValue || '—'
        return { id: crypto.randomUUID(), name, reference, category: get('category') || 'À classer', park: get('park'), responsible: get('responsible') || '—', status: statusFromCsv(get('status')) }
      }).filter(Boolean)
      if (!imported.length) throw new Error('Aucun engin avec une désignation valide n’a été trouvé.')
      const keys = new Set(assets.map((asset) => normalizeCsvHeader(asset.reference === '—' ? asset.name : asset.reference)))
      const fresh = imported.filter((asset) => {
        const key = normalizeCsvHeader(asset.reference === '—' ? asset.name : asset.reference)
        if (keys.has(key)) return false
        keys.add(key)
        return true
      })
      const skipped = imported.length - fresh.length
      setAssets((current) => [...fresh, ...current])
      setImportMessage(fresh.length + ' engin' + (fresh.length === 1 ? '' : 's') + ' importé' + (fresh.length === 1 ? '' : 's') + (skipped ? ', ' + skipped + ' doublon' + (skipped === 1 ? '' : 's') + ' ignoré' + (skipped === 1 ? '' : 's') : '') + ' depuis ' + file.name + '.')
    } catch (error) {
      setImportMessage('Import impossible : ' + error.message)
    } finally {
      event.target.value = ''
    }
  }

  function updateStatus(id, status) {
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, status } : asset))
  }

  function updatePark(id, park) {
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, park } : asset))
  }

  function deleteAsset(id) {
    if (window.confirm('Supprimer cet engin du parc matériel ?')) {
      setAssets((current) => current.filter((asset) => asset.id !== id))
    }
  }

  const activeCount = assets.filter((asset) => asset.status === 'En service').length
  const maintenanceCount = assets.filter((asset) => asset.status === 'En maintenance').length
  const pendingCount = assets.filter((asset) => asset.status === 'À confirmer').length
  const editingAsset = assets.find((asset) => asset.id === editingId)
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
  const selectedIdentityDetails = selectedAsset ? fleetIdentityForAsset(selectedAsset.name) : []
  const selectedAssetPhoto = selectedAsset ? selectedAsset.photo || fleetPhotoForName(selectedAsset.name) : ''
  const selectedIdentityValue = (label) => selectedIdentityDetails.find(([field]) => field === label)?.[1]
  const selectedIdentityReference = selectedAsset?.reference && selectedAsset.reference !== '—' ? selectedAsset.reference : selectedIdentityValue('Immatriculation') || selectedIdentityValue('N° de parc') || '—'
  const selectedIdentityCategory = selectedAsset?.category && selectedAsset.category !== 'À classer' ? selectedAsset.category : selectedIdentityValue('Type d’engin') || '—'
  let savedCustomDrivers = []
  try { savedCustomDrivers = JSON.parse(localStorage.getItem('sotutrasm-custom-drivers') || '[]').filter((driver) => typeof driver === 'string') } catch { /* use the standard driver list */ }
  const driverOptions = [...new Set([...defaultFuelDrivers, ...savedCustomDrivers, ...assets.map((asset) => asset.responsible).filter((name) => name && name !== '—')])]
  const filteredAssets = assets.filter((asset) => {
    const searchText = `${asset.name} ${asset.reference} ${asset.category} ${asset.park || ''} ${asset.responsible}`.toLocaleLowerCase('fr')
    return searchText.includes(search.toLocaleLowerCase('fr')) && (statusFilter === 'Tous les états' || asset.status === statusFilter)
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return (
    <div className="fleet-page">
      <div className="fuel-title-row">
        <div><div className="eyebrow">GESTION DES ÉQUIPEMENTS</div><h1>Parc matériel</h1><p>Suivez vos engins, véhicules et leur état opérationnel.</p></div>
        <span className="local-badge"><i/> Données enregistrées dans ce navigateur</span>
      </div>
      <div className="fuel-summary fleet-summary">
        <article className="fuel-summary-card"><span>Engins enregistrés</span><strong>{assets.length}</strong></article>
        <article className="fuel-summary-card"><span>En service</span><strong>{activeCount}</strong></article>
        <article className="fuel-summary-card"><span>En maintenance</span><strong>{maintenanceCount}</strong></article>
        <article className="fuel-summary-card"><span>État à confirmer</span><strong>{pendingCount}</strong></article>
      </div>
      <section className="panel fleet-list-panel">
        <div className="panel-header fleet-list-header"><div><h2>Liste du matériel</h2><p>{filteredAssets.length} engin{filteredAssets.length === 1 ? '' : 's'} affiché{filteredAssets.length === 1 ? '' : 's'}</p></div>
          <div className="fleet-filters"><input aria-label="Rechercher dans le parc" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un engin…"/><select aria-label="Filtrer par état" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Tous les états</option>{assetStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
        </div>
        {editingAsset && <form className="fleet-edit-form" onSubmit={saveAssetChanges}>
          <div className="fleet-edit-heading"><strong>Modifier : {editingAsset.name}</strong><button type="button" onClick={() => setEditingId(null)}>Annuler</button></div>
          <div className="fleet-edit-fields">
            <label>Désignation<input name="name" defaultValue={editingAsset.name} required /></label>
            <label>Immatriculation / référence<input name="reference" defaultValue={editingAsset.reference === '—' ? '' : editingAsset.reference} /></label>
            <label>Catégorie<input name="category" defaultValue={editingAsset.category} /></label>
            <label>Parc<select name="park" defaultValue={editingAsset.park || ''} required><option value="" disabled>Choisir un parc</option>{assetParks.map((park) => <option key={park}>{park}</option>)}</select></label>
            <label>Conducteur / responsable<select name="responsible" defaultValue={editingAsset.responsible === '—' ? '' : editingAsset.responsible}><option value="">Choisir un nom (facultatif)</option>{driverOptions.map((driver) => <option key={driver}>{driver}</option>)}</select></label>
            <label>État<select name="status" defaultValue={editingAsset.status}>{assetStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>Changer la photo <span className="optional">(facultatif)</span><input name="photo" type="file" accept="image/*" /></label>
            <button type="submit" className="primary-button">Enregistrer les modifications</button>
          </div>
        </form>}
        {filteredAssets.length ? <div className="table-scroll"><table><thead><tr><th>Désignation</th><th>Parc</th><th>Référence</th><th>Catégorie</th><th>Responsable</th><th>État</th><th>Action</th></tr></thead><tbody>{filteredAssets.map((asset) => { const photo = asset.photo || fleetPhotoForName(asset.name); return <tr key={asset.id}><td><div className="asset-designation"><button type="button" className="asset-photo-button" onClick={() => setSelectedAssetId(asset.id)} aria-label={`Ouvrir la fiche identité de ${asset.name}`}>{photo ? <img src={photo} alt={`Photo de ${asset.name}`} /> : <span className="asset-photo-placeholder">▦</span>}</button><strong>{asset.name}</strong></div></td><td><select className="park-select" aria-label={`Parc de ${asset.name}`} value={asset.park || ''} onChange={(event) => updatePark(asset.id, event.target.value)}><option value="">Choisir un parc</option>{assetParks.map((park) => <option key={park}>{park}</option>)}</select></td><td>{asset.reference}</td><td>{asset.category}</td><td>{asset.responsible}</td><td><select className={`status-select ${asset.status === 'En service' ? 'status-active' : asset.status === 'En maintenance' ? 'status-maintenance' : asset.status === 'À l’arrêt' ? 'status-stopped' : 'status-pending'}`} aria-label={`État de ${asset.name}`} value={asset.status} onChange={(event) => updateStatus(asset.id, event.target.value)}>{assetStatuses.map((status) => <option key={status}>{status}</option>)}</select></td><td><div className="asset-actions"><button className="edit-asset" onClick={() => setEditingId(asset.id)}>Modifier</button><button className="delete-asset" onClick={() => deleteAsset(asset.id)} aria-label={`Supprimer ${asset.name}`}>Supprimer</button></div></td></tr>})}</tbody></table></div> : <div className="empty-history"><span>▦</span><strong>{assets.length ? 'Aucun résultat' : 'Votre parc est encore vide'}</strong><p>{assets.length ? 'Modifiez la recherche ou le filtre d’état.' : 'Ajoutez un engin avec le formulaire ci-dessous pour commencer.'}</p></div>}
      </section>
      <section className="panel fleet-form-panel">
        <div className="panel-header"><div><h2>Ajouter un engin</h2><p>Ajoutez un engin manuellement ou importez une liste CSV.</p></div><label className="import-button">Importer un CSV<input type="file" accept=".csv,text/csv" onChange={importFleetCsv} /></label></div>
        <form className="fleet-form" onSubmit={addAsset}>
          <label>Désignation<input name="name" placeholder="Ex. Pelle 03" required /></label>
          <label>Immatriculation / référence<input name="reference" placeholder="Ex. TU 1234" /></label>
          <label>Catégorie<select name="category" defaultValue="Engin de chantier"><option>Engin de chantier</option><option>Camion</option><option>Véhicule</option><option>Groupe électrogène</option><option>Compresseur</option><option>Autre</option></select></label>
          <label>Parc<select name="park" defaultValue="" required><option value="" disabled>Choisir un parc</option>{assetParks.map((park) => <option key={park}>{park}</option>)}</select></label>
          <label>Conducteur / responsable<select name="responsible" defaultValue=""><option value="">Choisir un nom (facultatif)</option>{driverOptions.map((driver) => <option key={driver}>{driver}</option>)}</select></label>
          <label>État<select name="status" defaultValue="À confirmer">{assetStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Photo de l’engin <span className="optional">(facultatif)</span><input name="photo" type="file" accept="image/*" /></label>
          <div className="form-actions"><button type="submit" className="primary-button">＋ Ajouter au parc</button></div>
        </form>
        {message && <p className="import-message" role="status">{message}</p>}
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
      </section>
      {selectedAsset && <div className="identity-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedAssetId(null) }}><article className="identity-card" role="dialog" aria-modal="true" aria-labelledby="identity-title"><button type="button" className="identity-close" aria-label="Fermer la fiche" onClick={() => setSelectedAssetId(null)}>×</button><div className="eyebrow">FICHE IDENTITÉ DE L’ENGIN</div><h2 id="identity-title">{selectedAsset.name}</h2>{selectedAssetPhoto && <img className="identity-photo" src={selectedAssetPhoto} alt={`Photo de ${selectedAsset.name}`} />}<section><h3>Informations du parc</h3><dl className="identity-details"><div><dt>Immatriculation / référence</dt><dd>{selectedIdentityReference}</dd></div><div><dt>Catégorie</dt><dd>{selectedIdentityCategory}</dd></div><div><dt>Parc</dt><dd>{selectedAsset.park || '—'}</dd></div><div><dt>Conducteur / responsable</dt><dd>{selectedAsset.responsible && selectedAsset.responsible !== '—' ? selectedAsset.responsible : selectedIdentityValue('Responsable / conducteur') || '—'}</dd></div><div><dt>État</dt><dd>{selectedAsset.status || 'À confirmer'}</dd></div></dl></section>{selectedIdentityDetails.length > 0 ? <section className="identity-technical"><h3>Caractéristiques et détails techniques</h3><dl className="identity-details">{selectedIdentityDetails.filter(([label]) => !['Responsable / conducteur', 'Immatriculation', 'Type d’engin'].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : <p className="identity-missing-details">Aucune fiche technique correspondante n’a été identifiée dans le classeur fourni.</p>}</article></div>}
    </div>
  )
}

function MonthlyConsumptionPanel({ records, baseline, range, onRangeChange }) {
  const monthsToShow = Number(range)
  const now = new Date()
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 0 })
  const series = Array.from({ length: monthsToShow }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - monthsToShow + index + 1, 1)
    const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
    const value = fuelMonthlyTotal(records, baseline, key)
    return { key, value, label: date.toLocaleDateString('fr-TN', { month: 'short' }).replace(/\./g, '').toLocaleUpperCase('fr') }
  })
  const maximum = Math.max(1, ...series.map((month) => month.value))
  const current = series[series.length - 1]

  return (
    <article className="panel consumption-panel">
      <div className="panel-header"><div><h2>Consommation par mois</h2><p>Volumes de gasoil consommés chaque mois</p></div><select aria-label="Nombre de mois affichés" value={range} onChange={(event) => onRangeChange(event.target.value)}><option value="6">6 derniers mois</option><option value="12">12 derniers mois</option></select></div>
      <div className="chart-legend"><span><i className="legend-blue"/> Consommation (L)</span><strong>{current ? numberFormat.format(current.value) : '0'} L <small>{current?.label}</small></strong></div>
      <div className="monthly-chart">{series.map((month) => <div className="monthly-column" key={month.key}><strong>{month.value ? numberFormat.format(month.value) : '—'}</strong><div className="monthly-bar-area"><div className="monthly-bar" style={{ height: (month.value ? Math.max(3, month.value / maximum * 100) : 0) + '%' }} /></div><span>{month.label}</span></div>)}</div>
      <div className="monthly-chart-note">Les nouvelles consommations s’ajoutent au mois correspondant.</div>
    </article>
  )
}

function DashboardEnrochementChart({ records }) {
  const monthLabels = { '01': 'Janv.', '02': 'Févr.', '03': 'Mars', '04': 'Avr.', '05': 'Mai', '06': 'Juin', '07': 'Juil.', '08': 'Août', '09': 'Sept.', '10': 'Oct.', '11': 'Nov.', '12': 'Déc.' }
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 3 })
  const monthlyTotals = [
    { key: 'before-2026-08', label: 'Avant août 2026', tonnes500: enrochementBeforeAugust2026Tonnes['1/500'], tonnes3T: enrochementBeforeAugust2026Tonnes['1/3T'], tonnes2540: 0, trips: null },
    ...[...new Set(records.map((record) => record.date?.slice(0, 7)).filter(Boolean))].sort().map((key) => {
      const monthRecords = records.filter((record) => record.date?.startsWith(key))
      const sumType = (type) => monthRecords.filter((record) => normalizeEnrochementType(record.type) === type).reduce((sum, record) => sum + Number(record.tonnageKg || 0), 0) / 1000
      return { key, label: `${monthLabels[key.slice(5, 7)]} ${key.slice(0, 4)}`, tonnes500: sumType('1/500'), tonnes3T: sumType('1/3T'), tonnes2540: sumType('25/40'), trips: monthRecords.length }
    })
  ]
  const maximum = Math.max(1, ...monthlyTotals.flatMap((month) => [month.tonnes500, month.tonnes3T, month.tonnes2540]))
  return <section className="panel enrochement-month-panel"><div className="panel-header"><div><h2>Tonnage par mois</h2><p>Répartition mensuelle par type d’enrochement</p></div><div className="enrochement-chart-legend"><span><i className="legend-500" />1/500</span><span><i className="legend-3t" />1/3T</span><span><i className="legend-2540" />25/40</span></div></div>
    <div className="enrochement-month-chart">{monthlyTotals.map((month) => <div className="enrochement-month-column" key={month.key}><strong>{numberFormat.format(month.tonnes500 + month.tonnes3T + month.tonnes2540)} t</strong><div className="monthly-bar-area enrochement-paired-bars"><div className="monthly-bar monthly-bar-500" title={`1/500 : ${numberFormat.format(month.tonnes500)} t`} style={{ height: Math.max(month.tonnes500 ? 3 : 0, month.tonnes500 / maximum * 100) + '%' }} /><div className="monthly-bar monthly-bar-3t" title={`1/3T : ${numberFormat.format(month.tonnes3T)} t`} style={{ height: Math.max(month.tonnes3T ? 3 : 0, month.tonnes3T / maximum * 100) + '%' }} /><div className="monthly-bar monthly-bar-2540" title={`25/40 : ${numberFormat.format(month.tonnes2540)} t`} style={{ height: Math.max(month.tonnes2540 ? 3 : 0, month.tonnes2540 / maximum * 100) + '%' }} /></div><span>{month.label}</span><small>{month.trips === null ? 'tonnage historique' : `${month.trips} voyages`}</small></div>)}</div>
  </section>
}

function splitEnrochementPlateAndDriver(value) {
  const source = (value || '').trim()
  const match = source.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  return { plate: (match ? match[1] : source).trim(), driver: match ? match[2].trim() : '' }
}

function normalizeEnrochementType(value) {
  const original = String(value || '').trim()
  const compact = original.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').toUpperCase()
  if (compact === '1/500') return '1/500'
  if (compact === '1/3T') return '1/3T'
  if (compact === '25/40') return '25/40'
  return original
}

function enrochementTripKey(record) {
  const plate = splitEnrochementPlateAndDriver(record.plate).plate
  return [record.date, record.casa, record.transport, plate, Number(record.tonnageKg), record.site]
    .map((value) => normalizeCsvHeader(String(value ?? '')))
    .join('|')
}

function normalizeEnrochementRecords(records) {
  const hasOctoberImport = records.some((record) => ['ENR10.csv', 'ENR10_corrige.csv'].includes(record.sourceFile))
  const preferCorrectedOctober = records.some((record) => record.sourceFile === 'ENR10_corrige.csv')
  const prepared = records.map((record) => {
    const normalizedType = normalizeEnrochementType(record.type)
    return normalizedType === record.type ? record : { ...record, type: normalizedType }
  }).filter((record) => {
    if (hasOctoberImport && record.sourceFile === 'enrochement.csv' && record.date?.startsWith('2026-10-')) return false
    if (preferCorrectedOctober && record.sourceFile === 'ENR10.csv') return false
    return true
  })
  const seen = new Set()
  return prepared.filter((record) => {
    const key = enrochementTripKey(record)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const enr0411SeedFlag = 'sotutrasm-imported-ENR0411-2026-11-04'
const enr0411SeedTrips = [
  ['09:30', '830709', '001161', '1/3T', '205 TU 6921', 'Mondher', 36260, '205 TU 6921 (Mondher)'],
  ['10:46', '830717', '000508', '1/500', '199 TU 9532', 'Aymen', 32440, '199 TU 9532 (Aymen)'],
  ['11:00', '830719', '004251', '1/500', '196 TU 2333', 'Ahmed', 36800, '196 TU 2333 (Ahmed)'],
  ['11:08', '830711', '000426', '1/3T', '199 TU 9526', 'Tawfik', 30720, '199 TU 9526 (Tawfik)'],
  ['11:06', '830718', '001196', '1/500', '199 TU 9524', 'Mahdi', 35620, '199 TU 9524 (Mahdi)'],
  ['11:25', '830712', '001165', '1/3T', '199 TU 9529', 'Wahbi', 28740, '199 TU 9529 (Wahbi)'],
  ['12:10', '830721', '001214', '1/500', '199 TU 9534', 'Zouhaier', 34960, '199 TU 9534 (Zouhaier)'],
  ['11:51', '830720', '000005', '1/500', '197 TU 745', 'Sami', 37120, '197 TU 745 (Sami)'],
  ['14:10', '830723', '001162', '1/3T', '205 TU 6921', 'Mondher', 35280, '205 TU 6921 (Mondher)'],
  ['14:12', 'Police', '001998', '1/500', '194 TU 2450', 'Ghazi', 37060, '194 TU 2450 (Ghazi)'],
  ['15:00', '830725', '000509', '1/500', '199 TU 9532', 'Aymen', 34240, '199 TU 9532 (Aymen)'],
  ['15:05', '830801', '001999', '1/3T', '194 TU 2450', 'Ghazi', 31520, '194 TU 2450 (Ghazi)'],
  ['15:40', '830804', '000427', '1/3T', '199 TU 9526', 'Tawfik', 31160, '199 TU 9526 (Tawfik)'],
  ['16:00', '830805', '004252', '1/500', '196 TU 2333', 'Ahmed', 36920, '196 TU 2333 (Ahmed)'],
  ['16:30', '830807', '001166', '1/3T', '199 TU 9529', 'Wahbi', 29600, '199 TU 9529 (Wahbi)'],
  ['16:31', '830809', '000006', '1/500', '197 TU 745', 'Sami', 35880, '197 TU 745 (Sami)'],
  ['16:42', '830810', '001215', '1/500', '199 TU 9534', 'Zouhaier', 34180, '199 TU 9534 (Zouhaier)'],
  ['16:44', '830811', '001005', '1/3T', '196 TU 733', 'Ghaith', 30280, '196 TU 733 (Ghaith)'],
].map(([time, casa, transport, type, plate, driver, tonnageKg, sourcePlate]) => {
  const date = '2026-11-04'
  const site = ''
  return { id: [date, casa, transport, sourcePlate, tonnageKg, site].join('|'), date, time, casa, transport, type, plate, driver, tonnageKg, site, sourceFile: 'ENR0411.csv' }
})

function loadEnrochementRecords(storageKey) {
  try {
    const loaded = JSON.parse(localStorage.getItem(storageKey) || '[]').map((record) => {
      if (record.sourceFile === 'ENR0511.csv' && record.date === '2026-05-11') {
        const correctedDate = '2026-11-05'
        const correctedId = String(record.id || '').replace(/^2026-05-11\|/, correctedDate + '|')
        return { ...record, date: correctedDate, id: correctedId }
      }
      if (record.driver !== undefined) return record
      return { ...record, ...splitEnrochementPlateAndDriver(record.plate) }
    })
    return normalizeEnrochementRecords(loaded)
  } catch { return [] }
}

function HourMeterModule() {
  const storageKey = 'sotutrasm-hourmeter-readings'
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [editingId, setEditingId] = useState(null)
  const [monthFilter, setMonthFilter] = useState('Tous les mois')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()))

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(records)) }, [records])

  const assets = (() => {
    let fleetAssets = []
    try { fleetAssets = JSON.parse(localStorage.getItem(fleetStorageKey) || '[]') } catch { /* use default asset names */ }
    return [...new Set([...defaultFuelEquipment, ...fleetAssets.map((asset) => asset.name), ...records.map((record) => record.equipment)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  })()
  const drivers = (() => {
    let fleetAssets = []
    try { fleetAssets = JSON.parse(localStorage.getItem(fleetStorageKey) || '[]') } catch { /* use default driver names */ }
    return [...new Set([...defaultFuelDrivers, ...fleetAssets.map((asset) => asset.responsible), ...records.map((record) => record.driver)].filter((name) => name && name !== '—'))].sort((a, b) => a.localeCompare(b, 'fr'))
  })()
  const chronologicallySorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.equipment.localeCompare(b.equipment) || (a.recordedAt || '').localeCompare(b.recordedAt || ''))
  const readingsWithUsage = chronologicallySorted.map((record, index) => {
    const priorInSameUnit = chronologicallySorted.slice(0, index).filter((item) => item.equipment === record.equipment && item.unit === record.unit).at(-1)
    const difference = priorInSameUnit ? Number(record.counterValue) - Number(priorInSameUnit.counterValue) : null
    return { ...record, previousValue: priorInSameUnit?.counterValue ?? null, elapsedValue: difference !== null && difference >= 0 ? difference : null, counterReset: difference !== null && difference < 0 }
  })
  const totalHours = readingsWithUsage.filter((record) => record.unit !== 'km').reduce((sum, record) => sum + (record.elapsedValue || 0), 0)
  const totalKilometers = readingsWithUsage.filter((record) => record.unit === 'km').reduce((sum, record) => sum + (record.elapsedValue || 0), 0)
  const latestReading = [...readingsWithUsage].sort((a, b) => b.date.localeCompare(a.date) || (b.recordedAt || '').localeCompare(a.recordedAt || ''))[0]
  const equipmentCount = new Set(records.map((record) => record.equipment)).size
  const months = [...new Set(records.map((record) => record.date.slice(0, 7)))].sort().reverse()
  const monthLabel = (key) => new Date(key + '-01T00:00:00').toLocaleDateString('fr-TN', { month: 'long', year: 'numeric' })
  const filtered = readingsWithUsage.filter((record) => {
    const query = [record.date, record.equipment, record.driver].join(' ').toLocaleLowerCase('fr')
    return (monthFilter === 'Tous les mois' || record.date.startsWith(monthFilter)) && query.includes(search.toLocaleLowerCase('fr'))
  }).sort((a, b) => b.date.localeCompare(a.date) || b.equipment.localeCompare(a.equipment))
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 })

  async function importStudy(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const bytes = await file.arrayBuffer()
      let content
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { content = new TextDecoder('windows-1252').decode(bytes) }
      const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
      let headerIndex = -1
      let delimiter = ';'
      let headers = []
      for (let i = 0; i < Math.min(lines.length, 12); i += 1) {
        const candidate = parseCsvLine(lines[i], ';').map(normalizeCsvHeader)
        if (candidate.includes('codeengin') && candidate.includes('marquemodele')) { headerIndex = i; headers = candidate; break }
      }
      if (headerIndex < 0) throw new Error('Colonnes Code engin et Marque / modèle introuvables.')
      const column = (key) => headers.indexOf(key)
      const columns = { code: column('codeengin'), model: column('marquemodele'), category: column('categorie'), start: column('compteur0110'), end: column('compteur3110') }
      if (columns.start < 0 || columns.end < 0) throw new Error('Les colonnes Compteur 01/10 et Compteur 31/10 sont nécessaires.')
      const yearNumber = Number(importYear)
      if (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100) throw new Error('Saisis une année valide entre 2000 et 2100.')
      const parseValue = (value) => {
        const cleaned = value.replace(/[\s\u00a0]/g, '').replace(',', '.')
        if (!cleaned) return null
        const parsed = Number(cleaned)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
      }
      const imported = []
      for (const line of lines.slice(headerIndex + 1)) {
        const cells = parseCsvLine(line, delimiter)
        const get = (index) => index < 0 ? '' : (cells[index] || '').trim()
        const rawModel = get(columns.model)
        if (!rawModel) continue
        const driverMatch = rawModel.match(/^(.*?)\s*\(\s*([^()]*)\s*\)\s*$/)
        const equipment = (driverMatch ? driverMatch[1] : rawModel).trim()
        const driver = driverMatch?.[2]?.trim() || ''
        const code = get(columns.code)
        const category = get(columns.category)
        const unit = /vehicule|camion/i.test(category.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? 'km' : 'h'
        const assetKey = code || normalizeCsvHeader(equipment)
        for (const [columnIndex, monthDay] of [[columns.start, '01'], [columns.end, '31']]) {
          const counterValue = parseValue(get(columnIndex))
          if (counterValue === null) continue
          const date = `${yearNumber}-10-${monthDay}`
          imported.push({ id: `study-bizerte-${assetKey}-${date}`, date, equipment, driver, counterValue, unit, assetCode: code, category, sourceFile: file.name, recordedAt: `${date}T12:00:00.000Z` })
        }
      }
      if (!imported.length) throw new Error('Aucun index valide trouvé dans le fichier.')
      setRecords((current) => {
        const existing = new Map(current.map((record) => [record.id, record]))
        for (const record of imported) existing.set(record.id, { ...existing.get(record.id), ...record })
        return [...existing.values()]
      })
      setMonthFilter('Tous les mois')
      setSearch('')
      setMessage(`${imported.length} relevés importés ou mis à jour pour ${yearNumber}. Les colonnes de calcul contenant #REF! ont été ignorées.`)
    } catch (error) {
      setMessage('Import impossible : ' + error.message)
    } finally {
      event.target.value = ''
    }
  }

  function saveReading(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const date = form.get('date')
    const equipment = form.get('equipment')
    const collision = records.some((record) => record.id !== editingId && record.date === date && record.equipment === equipment)
    if (collision) { setMessage('Un relevé existe déjà pour cet engin à cette date. Modifie le relevé existant.'); return }
    const values = { date, equipment, driver: form.get('driver') || '', counterValue: Number(form.get('counterValue')), unit: form.get('unit') }
    if (editingId) {
      setRecords((current) => current.map((record) => record.id === editingId ? { ...record, ...values } : record))
      setMessage('Relevé horaire modifié.')
      setEditingId(null)
    } else {
      setRecords((current) => [{ id: crypto.randomUUID(), ...values, recordedAt: new Date().toISOString() }, ...current])
      event.currentTarget.reset()
      setMessage('Relevé horaire enregistré.')
    }
    window.setTimeout(() => setMessage(''), 3500)
  }

  const editingReading = records.find((record) => record.id === editingId)
  const summary = [
    { label: 'Heures calculées', value: totalHours, unit: 'h' },
    { label: 'Kilométrage parcouru', value: totalKilometers, unit: 'km' },
    { label: 'Dernier index', value: latestReading ? latestReading.counterValue : null, unit: latestReading?.unit || '', hint: latestReading ? `${latestReading.equipment} · ${new Date(latestReading.date + 'T00:00:00').toLocaleDateString('fr-TN')}` : 'Aucun relevé saisi' },
    { label: 'Engins suivis', value: equipmentCount, unit: '' },
    { label: 'Relevés enregistrés', value: records.length, unit: '' },
  ]

  return (
    <div className="hourmeter-page">
      <div className="fuel-title-row"><div><div className="eyebrow">GESTION DU PARC MATÉRIEL</div><h1>Compteurs horaires</h1><p>Suivi des index des engins et calcul des heures entre deux relevés.</p></div><div className="hourmeter-import-tools"><label>Année de l’étude<input type="number" min="2000" max="2100" value={importYear} onChange={(event) => setImportYear(event.target.value)} /></label><label className="import-button">Importer l’étude CSV<input type="file" accept=".csv,text/csv" onChange={importStudy} /></label></div></div>
      <div className="fuel-summary hourmeter-summary">{summary.map((item) => <article className="fuel-summary-card" key={item.label}><span>{item.label}</span><strong>{item.value === null ? '—' : numberFormat.format(item.value)} {item.value !== null && item.unit && <small>{item.unit}</small>}</strong>{item.hint && <small className="summary-hint">{item.hint}</small>}</article>)}</div>
      <section className="panel hourmeter-entry-panel">
        <div className="panel-header"><div><h2>{editingReading ? 'Modifier le relevé' : 'Saisir un relevé horaire'}</h2><p>Entre l’index affiché par le compteur de l’engin.</p></div></div>
        {message && <p className="import-message" role="status">{message}</p>}
        <form className="hourmeter-form" key={editingReading?.id || 'new'} onSubmit={saveReading}>
          <label>Date du relevé<input name="date" type="date" defaultValue={editingReading?.date || new Date().toISOString().slice(0, 10)} required /></label>
          <label>Engin<select name="equipment" defaultValue={editingReading?.equipment || ''} required><option value="" disabled>Choisir un engin</option>{assets.map((asset) => <option key={asset} value={asset}>{asset}</option>)}</select></label>
          <label>Conducteur <span className="optional">(facultatif)</span><select name="driver" defaultValue={editingReading?.driver || ''}><option value="">Choisir un conducteur</option>{drivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
          <label>Unité du compteur<select name="unit" defaultValue={editingReading?.unit || 'h'}><option value="h">Heures (h)</option><option value="km">Kilomètres (km)</option></select></label>
          <label>Index compteur<input name="counterValue" type="number" min="0" step="0.1" placeholder="Ex. 1 258,4" defaultValue={editingReading?.counterValue ?? ''} required /></label>
          <div className="form-actions">{editingReading && <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Annuler</button>}<button type="submit" className="primary-button">{editingReading ? 'Enregistrer les modifications' : '＋ Enregistrer le relevé'}</button></div>
        </form>
        <p className="hourmeter-help">L’écart est calculé automatiquement à partir du relevé précédent du même engin et de la même unité.</p>
      </section>
      <section className="panel hourmeter-history-panel">
        <div className="panel-header hourmeter-history-header"><div><h2>Historique des relevés</h2><p>{filtered.length} relevé{filtered.length === 1 ? '' : 's'} affiché{filtered.length === 1 ? '' : 's'}</p></div><div className="hourmeter-filters"><select aria-label="Filtrer par mois" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option>Tous les mois</option>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select><input aria-label="Rechercher un relevé" placeholder="Rechercher un engin ou conducteur" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Code engin</th><th>Engin</th><th>Conducteur</th><th>Index compteur</th><th>Index précédent</th><th>Écart</th><th>Action</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{new Date(record.date + 'T00:00:00').toLocaleDateString('fr-TN')}</td><td>{record.assetCode || '—'}</td><td><strong>{record.equipment}</strong></td><td>{record.driver || '—'}</td><td>{numberFormat.format(record.counterValue)} {record.unit}</td><td>{record.previousValue === null ? 'Premier relevé' : numberFormat.format(record.previousValue) + ' ' + record.unit}</td><td>{record.counterReset ? <span className="hourmeter-reset">Index inférieur au précédent · vérifier le compteur</span> : record.elapsedValue === null ? '—' : <strong>{numberFormat.format(record.elapsedValue)} {record.unit}</strong>}</td><td><button className="edit-asset" onClick={() => { setEditingId(record.id); setMessage('') }}>Modifier</button></td></tr>)}</tbody></table></div> : <div className="empty-history"><span>◷</span><strong>Aucun relevé horaire</strong><p>Importe l’étude CSV ou saisis le premier index d’un engin.</p></div>}
      </section>
    </div>
  )
}

function EnrochementModule() {
  const storageKey = 'sotutrasm-enrochement-trips'
  const [records, setRecords] = useState(() => loadEnrochementRecords(storageKey))
  const [year, setYear] = useState('2026')
  const [monthFilter, setMonthFilter] = useState('Tous les mois')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [entryMessage, setEntryMessage] = useState('')
  const [editingTripId, setEditingTripId] = useState(null)
  const [historyMessage, setHistoryMessage] = useState('')
  const pageSize = 25

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [records])

  useEffect(() => {
    const normalized = normalizeEnrochementRecords(records)
    if (normalized.length !== records.length || normalized.some((record, index) => record !== records[index])) setRecords(normalized)
  }, [records])

  useEffect(() => {
    const needsDateCorrection = records.some((record) => record.sourceFile === 'ENR0511.csv' && record.date === '2026-05-11')
    const needsSite = records.some((record) => record.date === '2026-11-04' && !record.site?.trim())
    if (!needsDateCorrection && !needsSite) return
    setRecords((current) => current.map((record) => {
      let corrected = record
      if (record.sourceFile === 'ENR0511.csv' && record.date === '2026-05-11') {
        corrected = { ...corrected, date: '2026-11-05', id: String(corrected.id || '').replace(/^2026-05-11\|/, '2026-11-05|') }
      }
      if (corrected.date === '2026-11-04' && !corrected.site?.trim()) {
        corrected = { ...corrected, site: 'EPI 1', id: String(corrected.id || '').replace(/\|$/, '|EPI 1') }
      }
      return corrected
    }))
    setMonthFilter('Tous les mois')
    setPage(1)
    setMessage(needsSite && needsDateCorrection
      ? 'Dates de ENR0511.csv corrigées au 5 novembre 2026 ; site EPI 1 renseigné pour les voyages du 4 novembre.'
      : needsSite
        ? 'Site EPI 1 renseigné pour tous les voyages du 4 novembre.'
        : 'Les 23 dates de ENR0511.csv ont été corrigées au 5 novembre 2026.')
  }, [records])

  useEffect(() => {
    if (localStorage.getItem(enr0411SeedFlag)) return
    setRecords((current) => {
      const existingIds = new Set(current.map((record) => record.id))
      const newTrips = enr0411SeedTrips.filter((trip) => !existingIds.has(trip.id))
      return newTrips.length ? [...newTrips, ...current] : current
    })
    localStorage.setItem(enr0411SeedFlag, 'imported')
  }, [])

  function addTrip(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const trip = {
      date: form.get('date'),
      time: form.get('time'),
      casa: form.get('casa').trim(),
      transport: form.get('transport').trim(),
      type: form.get('type').trim(),
      plate: form.get('plate').trim(),
      driver: form.get('driver').trim(),
      tonnageKg: Number(form.get('tonnageKg')),
      site: form.get('site').trim(),
      sourceFile: 'Saisie manuelle',
    }
    trip.id = 'manual|' + crypto.randomUUID()
    setRecords((current) => [trip, ...current])
    event.currentTarget.reset()
    setMonthFilter('Tous les mois')
    setPage(1)
    setEntryMessage('Voyage ajouté à l’historique.')
    window.setTimeout(() => setEntryMessage(''), 3500)
  }

  function saveTrip(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const changes = {
      date: form.get('date'), time: form.get('time'), casa: form.get('casa').trim(),
      transport: form.get('transport').trim(), type: form.get('type').trim(), plate: form.get('plate').trim(),
      driver: form.get('driver').trim(), tonnageKg: Number(form.get('tonnageKg')), site: form.get('site').trim(),
    }
    setRecords((current) => current.map((record) => record.id === editingTripId ? { ...record, ...changes } : record))
    setEditingTripId(null)
    setHistoryMessage('Voyage modifié et enregistré.')
    window.setTimeout(() => setHistoryMessage(''), 3500)
  }

  async function importCsv(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const bytes = await file.arrayBuffer()
      let content
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { content = new TextDecoder('windows-1252').decode(bytes) }
      const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
      const delimiters = [';', ',', '\t']
      let headerIndex = -1
      let delimiter = ';'
      for (let lineIndex = 0; lineIndex < Math.min(lines.length, 10) && headerIndex < 0; lineIndex += 1) {
        for (const candidate of delimiters) {
          const headers = parseCsvLine(lines[lineIndex], candidate).map(normalizeCsvHeader)
          if (headers.includes('date') && ['tonnage', 'kg', 'poids', 'poidskg'].some((header) => headers.includes(header))) {
            headerIndex = lineIndex
            delimiter = candidate
            break
          }
        }
      }
      if (headerIndex < 0) throw new Error('Colonnes Date et Tonnage introuvables dans le CSV.')
      const headers = parseCsvLine(lines[headerIndex], delimiter).map(normalizeCsvHeader)
      const column = (names) => headers.findIndex((header) => names.includes(header))
      const columns = {
        date: column(['date']), time: column(['heure', 'horaire', 'heuredarrivee']), casa: column(['casa', 'ncasa']), transport: column(['nlatransport', 'latransport', 'transport']),
        type: column(['type']), plate: column(['plaque', 'immatriculation', 'vehicule', 'camion']), driver: column(['chauffeur', 'conducteur', 'driver']),
        tonnage: column(['tonnage', 'kg', 'poids', 'poidskg']), site: column(['site', 'chantier', 'lieu']),
      }
      const months = { jan: 1, janvier: 1, fev: 2, fevr: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, sep: 9, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 }
      const monthFirstDates = file.name === 'ENR0411.csv'
      const parsedYear = Number(year)
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) throw new Error('Saisis une année valide entre 2000 et 2100.')
      const imported = lines.slice(headerIndex + 1).map((line) => {
        const cells = parseCsvLine(line, delimiter)
        const get = (field) => columns[field] < 0 ? '' : (cells[columns[field]] || '').trim()
        const dateText = get('date').trim()
        let parsedDate = null
        const numericDate = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
        if (numericDate) {
          const first = Number(numericDate[1])
          const second = Number(numericDate[2])
          const yearText = numericDate[3]
          const dateYear = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)
          const day = monthFirstDates ? second : first
          const month = monthFirstDates ? first : second
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) parsedDate = `${dateYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        } else {
          const match = dateText.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/^(\d{1,2})[-/ ]([a-z.]+)$/)
          if (match) {
            const month = months[match[2].replace(/\./g, '')]
            const day = Number(match[1])
            if (month && day >= 1 && day <= 31) parsedDate = parsedYear + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
          }
        }
        if (!parsedDate) return null
        const tonnageText = get('tonnage').replace(/[\s\u00a0]/g, '').replace(',', '.')
        const tonnageKg = Number(tonnageText)
        if (!Number.isFinite(tonnageKg) || tonnageKg <= 0) return null
        const sourcePlate = get('plate')
        const vehicle = splitEnrochementPlateAndDriver(sourcePlate)
        const record = { date: parsedDate, time: get('time'), casa: get('casa'), transport: get('transport'), type: normalizeEnrochementType(get('type')), plate: vehicle.plate, driver: get('driver') || vehicle.driver, tonnageKg, site: get('site') }
        record.sourceFile = file.name
        record.id = enrochementTripKey(record)
        return record
      }).filter(Boolean)
      if (!imported.length) throw new Error('Aucun voyage valide trouvé dans le fichier.')
      const importedIds = new Set(imported.map(enrochementTripKey))
      setRecords((current) => normalizeEnrochementRecords([...imported, ...current.filter((record) => record.sourceFile !== file.name && !importedIds.has(enrochementTripKey(record)))]))
      setMonthFilter('Tous les mois')
      setPage(1)
      setMessage(imported.length + ' voyages importés depuis ' + file.name + ' (année attribuée : ' + parsedYear + ').')
    } catch (error) {
      setMessage('Import impossible : ' + error.message)
    } finally {
      event.target.value = ''
    }
  }

  const monthLabels = { '01': 'Janv.', '02': 'Févr.', '03': 'Mars', '04': 'Avr.', '05': 'Mai', '06': 'Juin', '07': 'Juil.', '08': 'Août', '09': 'Sept.', '10': 'Oct.', '11': 'Nov.', '12': 'Déc.' }
  const monthKeys = [...new Set(records.map((record) => record.date.slice(0, 7)))].sort()
  const filteredRecords = records.filter((record) => {
    const searchText = [record.date, record.casa, record.transport, record.type, record.plate, record.driver, record.site].join(' ').toLocaleLowerCase('fr')
    return (monthFilter === 'Tous les mois' || record.date.startsWith(monthFilter)) && searchText.includes(search.toLocaleLowerCase('fr'))
  }).sort((a, b) => b.date.localeCompare(a.date) || b.casa.localeCompare(a.casa))
  const totalTonnageByTypeSinceStart = (type) => Number(enrochementBeforeAugust2026Tonnes[type] || 0) + records.filter((record) => record.type === type).reduce((sum, record) => sum + record.tonnageKg, 0) / 1000
  const monthlySummaryRows = [...new Set(records.map((record) => record.date?.slice(0, 7)).filter(Boolean))].sort().reverse().map((key) => {
    const monthRecords = records.filter((record) => record.date.startsWith(key))
    const tonnesByType = (type) => monthRecords.filter((record) => normalizeEnrochementType(record.type) === type).reduce((sum, record) => sum + Number(record.tonnageKg || 0), 0) / 1000
    return { key, label: `${monthLabels[key.slice(5, 7)]} ${key.slice(0, 4)}`, tonnes500: tonnesByType('1/500'), tonnes3T: tonnesByType('1/3T'), tonnes2540: tonnesByType('25/40'), totalTonnes: monthRecords.reduce((sum, record) => sum + Number(record.tonnageKg || 0), 0) / 1000, trips500: monthRecords.filter((record) => normalizeEnrochementType(record.type) === '1/500').length, trips3T: monthRecords.filter((record) => normalizeEnrochementType(record.type) === '1/3T').length, trips2540: monthRecords.filter((record) => normalizeEnrochementType(record.type) === '25/40').length, trips: monthRecords.length }
  })
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize)
  const editingTrip = records.find((record) => record.id === editingTripId)
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 3 })
  const overallTonnage = Object.values(enrochementBeforeAugust2026Tonnes).reduce((sum, value) => sum + value, 0) + records.reduce((sum, record) => sum + record.tonnageKg, 0) / 1000
  const monthlyTotals = [
    { key: 'before-2026-08', label: 'Avant août 2026', trips: null, tonnes500: enrochementBeforeAugust2026Tonnes['1/500'], tonnes3T: enrochementBeforeAugust2026Tonnes['1/3T'], tonnes2540: 0 },
    ...[...new Set(records.map((record) => record.date.slice(0, 7)))].sort().map((key) => {
      const monthRecords = records.filter((record) => record.date.startsWith(key))
      return { key, label: `${monthLabels[key.slice(5, 7)]} ${key.slice(0, 4)}`, trips: monthRecords.length, tonnes500: monthRecords.filter((record) => record.type === '1/500').reduce((sum, record) => sum + record.tonnageKg, 0) / 1000, tonnes3T: monthRecords.filter((record) => record.type === '1/3T').reduce((sum, record) => sum + record.tonnageKg, 0) / 1000, tonnes2540: monthRecords.filter((record) => record.type === '25/40').reduce((sum, record) => sum + record.tonnageKg, 0) / 1000 }
    })
  ]
  const maxMonthlyTonnes = Math.max(1, ...monthlyTotals.flatMap((month) => [month.tonnes500, month.tonnes3T, month.tonnes2540]))
  const typeOptions = [...new Set(['1/500', '1/3T', ...records.map((record) => record.type).filter(Boolean)])]
  const plateOptions = [...new Set(records.map((record) => record.plate).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const driverOptions = [...new Set(records.map((record) => record.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const siteOptions = [...new Set(records.map((record) => record.site).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const typeMap = new Map()
  const siteTypeMap = new Map()
  for (const record of records) {
    const type = record.type || 'Non renseigné'
    const typeStats = typeMap.get(type) || { type, trips: 0, tonnageKg: 0 }
    typeStats.trips += 1
    typeStats.tonnageKg += record.tonnageKg
    typeMap.set(type, typeStats)
  }
  for (const [type, tonnes] of Object.entries(enrochementBeforeAugust2026Tonnes)) {
    const typeStats = typeMap.get(type) || { type, trips: 0, tonnageKg: 0 }
    typeStats.tonnageKg += tonnes * 1000
    typeMap.set(type, typeStats)
  }
  for (const record of filteredRecords) {
    const type = record.type || 'Non renseigné'
    const site = record.site?.trim() || 'Site non renseigné'
    const siteKey = normalizeCsvHeader(site) + '|' + type
    const siteStats = siteTypeMap.get(siteKey) || { site, type, trips: 0, tonnageKg: 0 }
    siteStats.trips += 1
    siteStats.tonnageKg += record.tonnageKg
    siteTypeMap.set(siteKey, siteStats)
  }
  const typeSummary = [...typeMap.values()].sort((a, b) => a.type.localeCompare(b.type, 'fr'))
  const siteTypeSummary = [...siteTypeMap.values()].sort((a, b) => a.site.localeCompare(b.site, 'fr') || a.type.localeCompare(b.type, 'fr'))

  return (
    <div className="enrochement-page">
      <div className="fuel-title-row enrochement-title-row">
        <div className="enrochement-title-copy"><div className="eyebrow">GESTION DES OPÉRATIONS</div><h1>Enrochement</h1><p>Suivi des voyages, tonnages, transporteurs et sites.</p></div>
        <div className="enrochement-total-group">
          <div className="enrochement-total-card"><span>Total enrochement</span><strong>{numberFormat.format(overallTonnage)} <small>t</small></strong></div>
          <div className="enrochement-total-card"><span>Total 1/500</span><strong>{numberFormat.format(totalTonnageByTypeSinceStart('1/500'))} <small>t</small></strong></div>
          <div className="enrochement-total-card"><span>Total 1/3T</span><strong>{numberFormat.format(totalTonnageByTypeSinceStart('1/3T'))} <small>t</small></strong></div>
          <div className="enrochement-total-card"><span>Total 25/40</span><strong>{numberFormat.format(totalTonnageByTypeSinceStart('25/40'))} <small>t</small></strong></div>
        </div>
      </div>
      {records.length > 0 && <div className="enrochement-month-summaries">
        {monthlySummaryRows.map((month) => <section className="enrochement-month-summary-group" key={month.key}><h2>{month.label}</h2><div className="fuel-summary enrochement-summary">
          <article className="fuel-summary-card"><span>1/500</span><strong>{numberFormat.format(month.tonnes500)} <small>t</small></strong><small className="summary-hint">{month.trips500} voyages</small></article>
          <article className="fuel-summary-card"><span>1/3T</span><strong>{numberFormat.format(month.tonnes3T)} <small>t</small></strong><small className="summary-hint">{month.trips3T} voyages</small></article>
          <article className="fuel-summary-card"><span>25/40</span><strong>{numberFormat.format(month.tonnes2540)} <small>t</small></strong><small className="summary-hint">{month.trips2540} voyage{month.trips2540 === 1 ? '' : 's'}</small></article>
          <article className="fuel-summary-card"><span>Total</span><strong>{numberFormat.format(month.totalTonnes)} <small>t</small></strong><small className="summary-hint">{month.trips} voyages</small></article>
        </div></section>)}
        <section className="enrochement-month-summary-group"><h2>Avant août 2026</h2><div className="fuel-summary enrochement-summary">
          <article className="fuel-summary-card"><span>1/500</span><strong>{numberFormat.format(enrochementBeforeAugust2026Tonnes['1/500'])} <small>t</small></strong><small className="summary-hint">Historique</small></article>
          <article className="fuel-summary-card"><span>1/3T</span><strong>{numberFormat.format(enrochementBeforeAugust2026Tonnes['1/3T'])} <small>t</small></strong><small className="summary-hint">Historique</small></article>
          <article className="fuel-summary-card"><span>25/40</span><strong>0 <small>t</small></strong><small className="summary-hint">Historique non fourni</small></article>
          <article className="fuel-summary-card"><span>Total</span><strong>{numberFormat.format(Object.values(enrochementBeforeAugust2026Tonnes).reduce((sum, value) => sum + value, 0))} <small>t</small></strong><small className="summary-hint">Historique</small></article>
        </div></section>
      </div>}
      <div className="enrochement-import-tools"><label>Année utilisée si absente du fichier<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label><span>Les dates avec une année indiquée dans le CSV la conservent.</span></div>
      {message && <p className="import-message" role="status">{message}</p>}
      {records.length ? <>
        <section className="panel enrochement-month-panel"><div className="panel-header"><div><h2>Tonnage par mois</h2><p>{monthlyTotals.length} périodes · historique avant août inclus</p></div><div className="enrochement-chart-legend"><span><i className="legend-500" />1/500</span><span><i className="legend-3t" />1/3T</span><span><i className="legend-2540" />25/40</span></div></div>
          <div className="enrochement-month-chart">{monthlyTotals.map((month) => <div className="enrochement-month-column" key={month.key}><strong>{numberFormat.format(month.tonnes500 + month.tonnes3T + month.tonnes2540)} t</strong><div className="monthly-bar-area enrochement-paired-bars"><div className="monthly-bar monthly-bar-500" title={`1/500 : ${numberFormat.format(month.tonnes500)} t`} aria-label={`1/500 : ${numberFormat.format(month.tonnes500)} tonnes`} style={{ height: Math.max(month.tonnes500 ? 3 : 0, month.tonnes500 / maxMonthlyTonnes * 100) + '%' }} /><div className="monthly-bar monthly-bar-3t" title={`1/3T : ${numberFormat.format(month.tonnes3T)} t`} aria-label={`1/3T : ${numberFormat.format(month.tonnes3T)} tonnes`} style={{ height: Math.max(month.tonnes3T ? 3 : 0, month.tonnes3T / maxMonthlyTonnes * 100) + '%' }} /><div className="monthly-bar monthly-bar-2540" title={`25/40 : ${numberFormat.format(month.tonnes2540)} t`} aria-label={`25/40 : ${numberFormat.format(month.tonnes2540)} tonnes`} style={{ height: Math.max(month.tonnes2540 ? 3 : 0, month.tonnes2540 / maxMonthlyTonnes * 100) + '%' }} /></div><span>{month.label}</span><small>{month.trips === null ? 'tonnage historique' : `${month.trips} voyages`}</small></div>)}</div>
        </section>
        <section className="panel enrochement-type-panel">
          <div className="panel-header"><div><h2>Voyages et tonnage par type d’enrochement</h2><p>Le tonnage inclut les références antérieures à août 2026; les voyages comptés sont ceux enregistrés dans l’application.</p></div></div>
          <div className="enrochement-type-grid">{typeSummary.map((item) => <article className="enrochement-type-card" key={item.type}><div><span className="enrochement-type-chip">{item.type}</span><small>{item.trips} voyages enregistrés</small></div><strong>{numberFormat.format(item.tonnageKg / 1000)} <small>t</small></strong></article>)}</div>
        </section>
        <section className="panel enrochement-site-panel">
          <div className="panel-header"><div><h2>Quantités par site et par type</h2><p>Répartition des voyages et tonnages selon le chantier.</p></div></div>
          {siteTypeSummary.length ? <div className="table-scroll"><table><thead><tr><th>Site</th><th>Type d’enrochement</th><th>Voyages</th><th>Tonnage total</th></tr></thead><tbody>{siteTypeSummary.map((item) => <tr key={item.site + '|' + item.type}><td><strong>{item.site}</strong></td><td><span className="enrochement-type-chip">{item.type}</span></td><td>{item.trips}</td><td>{numberFormat.format(item.tonnageKg / 1000)} t <small className="source-kg">({numberFormat.format(item.tonnageKg)} kg)</small></td></tr>)}</tbody></table></div> : <div className="empty-history"><strong>Aucun site dans les données filtrées</strong></div>}
        </section>
      </> : null}
      <section className="panel enrochement-entry-panel">
        <div className="panel-header"><div><h2>Saisir un voyage</h2><p>Ajoute un voyage directement à l’historique d’enrochement.</p></div></div>
        <form className="enrochement-entry-form" onSubmit={addTrip}>
          <label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
          <label>Heure <span className="optional">(facultatif)</span><input name="time" type="time" /></label>
          <label>Ticket Casa<input name="casa" placeholder="N° ticket Casa" /></label>
          <label>LA Transport<input name="transport" placeholder="N° ticket transport" /></label>
          <label>Type<input name="type" list="enrochement-types" placeholder="Ex. 1/500" required /><datalist id="enrochement-types">{typeOptions.map((type) => <option key={type} value={type} />)}</datalist></label>
          <label>Plaque d’immatriculation<select name="plate" defaultValue="" required><option value="" disabled>Choisir une plaque</option>{plateOptions.map((plate) => <option key={plate} value={plate}>{plate}</option>)}</select></label>
          <label>Conducteur<select name="driver" defaultValue=""><option value="">Choisir un conducteur (facultatif)</option>{driverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
          <label>Tonnage (kg)<input name="tonnageKg" type="number" min="1" step="1" placeholder="Ex. 32540" required /></label>
          <label>Site<input name="site" list="enrochement-sites" placeholder="Nom du site" required /><datalist id="enrochement-sites">{siteOptions.map((site) => <option key={site} value={site} />)}</datalist></label>
          <div className="form-actions"><button type="submit" className="primary-button">＋ Enregistrer le voyage</button><label className="import-button">Importer le CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label></div>
        </form>
        {entryMessage && <p className="import-message" role="status">{entryMessage}</p>}
      </section>
      {records.length ? <section className="panel enrochement-table-panel"><div className="panel-header enrochement-table-header"><div><h2>Historique des voyages</h2><p>{filteredRecords.length} voyage{filteredRecords.length === 1 ? '' : 's'} affiché{filteredRecords.length === 1 ? '' : 's'}</p></div><div className="enrochement-filters"><select aria-label="Filtrer par mois" value={monthFilter} onChange={(event) => { setMonthFilter(event.target.value); setPage(1) }}><option>Tous les mois</option>{monthKeys.map((key) => <option value={key} key={key}>{monthLabels[key.slice(5, 7)]} {key.slice(0, 4)}</option>)}</select><input aria-label="Rechercher un voyage" placeholder="Plaque, ticket, site…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div></div>
          {historyMessage && <p className="import-message" role="status">{historyMessage}</p>}
          {editingTrip && <form className="enrochement-edit-form" key={editingTrip.id} onSubmit={saveTrip}>
            <div className="fleet-edit-heading"><strong>Modifier le voyage du {new Date(editingTrip.date + 'T00:00:00').toLocaleDateString('fr-TN')}</strong><button type="button" onClick={() => setEditingTripId(null)}>Annuler</button></div>
            <div className="enrochement-entry-form">
              <label>Date<input name="date" type="date" defaultValue={editingTrip.date} required /></label>
              <label>Heure<input name="time" type="time" defaultValue={editingTrip.time || ''} /></label>
              <label>Ticket Casa<input name="casa" defaultValue={editingTrip.casa || ''} /></label>
              <label>LA Transport<input name="transport" defaultValue={editingTrip.transport || ''} /></label>
              <label>Type<select name="type" defaultValue={editingTrip.type} required>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label>Plaque d’immatriculation<select name="plate" defaultValue={editingTrip.plate || ''} required><option value="">Choisir une plaque</option>{plateOptions.map((plate) => <option key={plate} value={plate}>{plate}</option>)}</select></label>
              <label>Conducteur<select name="driver" defaultValue={editingTrip.driver || ''}><option value="">Aucun conducteur</option>{driverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
              <label>Tonnage (kg)<input name="tonnageKg" type="number" min="1" step="1" defaultValue={editingTrip.tonnageKg} required /></label>
              <label>Site<input name="site" list="enrochement-sites" defaultValue={editingTrip.site} required /><datalist id="enrochement-sites">{siteOptions.map((site) => <option key={site} value={site} />)}</datalist></label>
              <div className="form-actions"><button type="submit" className="primary-button">Enregistrer les modifications</button></div>
            </div>
          </form>}
          <div className="table-scroll"><table><thead><tr><th>Date</th><th>Heure</th><th>Casa</th><th>LA Transport</th><th>Type</th><th>Plaque</th><th>Conducteur</th><th>Tonnage</th><th>Site</th><th>Action</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td>{new Date(record.date + 'T00:00:00').toLocaleDateString('fr-TN')}</td><td>{record.time || '—'}</td><td>{record.casa || '—'}</td><td>{record.transport || '—'}</td><td>{record.type || '—'}</td><td><strong>{record.plate || '—'}</strong></td><td>{record.driver || '—'}</td><td>{numberFormat.format(record.tonnageKg / 1000)} t <small className="source-kg">({numberFormat.format(record.tonnageKg)} kg)</small></td><td>{record.site || '—'}</td><td><button className="edit-asset" onClick={() => setEditingTripId(record.id)}>Modifier</button></td></tr>)}</tbody></table></div>
          <div className="table-pagination"><span>Page {page} sur {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Précédent</button><button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</button></div></div>
        </section> : !records.length ? <section className="panel enrochement-empty"><div className="enrochement-icon">◩</div><h2>Importe le fichier des voyages</h2><p>Le CSV contient 622 lignes de transport, avec les tickets Casa et transporteur, le type, la plaque, le tonnage et le site.</p><div className="enrochement-next-step">Tonnage total du fichier : 22 167,018 tonnes. Les dates seront attribuées à l’année choisie ci-dessus.</div></section> : null}
    </div>
  )
}

function CloudLogin({ onSuccess }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try { await onSuccess(login, password) } catch (cause) { setError(cause.message || 'Connexion impossible.') } finally { setLoading(false) }
  }
  return (
    <main className="demo-login-screen">
      <form className="demo-login-card" onSubmit={submit}>
        <div className="demo-login-brand"><img src={`${import.meta.env.BASE_URL}headerlogo.png`} alt="Logo SOTUTRASM" /><div><strong>SOTUTRASM</strong><span>BRAIN365</span></div></div>
        <div className="demo-login-eyebrow">ESPACE DE TRAVAIL PARTAGÉ</div>
        <h1>Connexion</h1>
        <p className="demo-login-intro">Connecte-toi pour accéder aux données partagées de SOTUTRASM BRAIN 365.</p>
        <label>Adresse e-mail<input name="username" type="email" autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} required /></label>
        <label>Mot de passe<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="demo-login-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
        <small>Compte partagé sécurisé par Supabase.</small>
      </form>
    </main>
  )
}

function CloudBootstrap({ session, onInitialized, onLogout }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initialize = async () => {
    setBusy(true)
    setError('')
    try { await initializeCloudFromThisDevice(session); await onInitialized() } catch (cause) { setError(cause.message || 'Initialisation impossible.') } finally { setBusy(false) }
  }
  return <main className="demo-login-screen"><section className="demo-login-card cloud-bootstrap-card">
    <div className="demo-login-brand"><img src={`${import.meta.env.BASE_URL}headerlogo.png`} alt="Logo SOTUTRASM" /><div><strong>SOTUTRASM</strong><span>BRAIN365</span></div></div>
    <div className="demo-login-eyebrow">INITIALISATION DU PARTAGE</div><h1>Aucune donnée partagée</h1>
    <p className="demo-login-intro">Le compte est connecté, mais l’espace Supabase est encore vide. Depuis le PC qui contient les données de référence, clique ci-dessous pour envoyer les données de gestion de ce navigateur dans l’espace partagé.</p>
    <button type="button" onClick={initialize} disabled={busy}>{busy ? 'Initialisation…' : 'Initialiser avec les données de ce PC'}</button>
    {error && <p className="demo-login-error" role="alert">{error}</p>}
    <button type="button" className="cloud-secondary-button" onClick={onLogout}>Se déconnecter</button>
  </section></main>
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [cloudSession, setCloudSession] = useState(null)
  const [syncStatus, setSyncStatus] = useState('online')

  const loadSessionData = async (session) => {
    const data = await loadCloudState(session)
    const hasCloudData = Object.keys(data).length > 0
    if (hasCloudData) applyCloudState(data)
    setCloudSession(session)
    setAuthStatus(hasCloudData ? 'ready' : 'needsInit')
  }

  useEffect(() => {
    let active = true
    restoreSession().then(async (session) => {
      if (!active) return
      if (!session) { setAuthStatus('login'); return }
      try { await loadSessionData(session) } catch (cause) {
        if (active) { clearCloudSession(); setAuthStatus('login') }
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (authStatus !== 'ready' || !cloudSession) return undefined
    return startLocalStorageSync(cloudSession, setSyncStatus)
  }, [authStatus, cloudSession])

  const handleLogin = async (login, password) => {
    const session = await signIn(login, password)
    try { await loadSessionData(session) } catch (cause) { clearCloudSession(); setAuthStatus('login'); throw cause }
  }
  const logout = () => { clearCloudSession(); setCloudSession(null); setAuthStatus('login') }
  const finishInitialization = async () => {
    const data = await loadCloudState(cloudSession)
    applyCloudState(data)
    setAuthStatus('ready')
  }

  if (authStatus === 'checking') return <main className="demo-login-screen"><p>Connexion à l’espace partagé…</p></main>
  if (authStatus === 'login') return <CloudLogin onSuccess={handleLogin} />
  if (authStatus === 'needsInit') return <CloudBootstrap session={cloudSession} onInitialized={finishInitialization} onLogout={logout} />
  return <DashboardApp session={cloudSession} onLogout={logout} syncStatus={syncStatus} />
}

function DashboardApp({ session, onLogout, syncStatus }) {
  const [activePage, setActivePage] = useState('Vue générale')
  const [backupImportStatus, setBackupImportStatus] = useState('')
  const [backupImporting, setBackupImporting] = useState(false)
  const chantierOptions = ['Bizerte', 'Sidi Bousaid', 'Sidi Abdelhamid', 'Monastir']
  const [activeSite, setActiveSite] = useState(() => {
    const savedSite = localStorage.getItem('sotutrasm-active-site')
    return chantierOptions.includes(savedSite) ? savedSite : 'Bizerte'
  })
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [monthRange, setMonthRange] = useState('12')
  const dashboardRecords = loadFuelRecords()
  const dashboardBaseline = readReservoirBaseline()
  const dashboardDeliveries = (() => { try { return JSON.parse(localStorage.getItem(deliveryStorageKey) || '[]') } catch { return [] } })()
  const dashboardEnrochementRecords = loadEnrochementRecords('sotutrasm-enrochement-trips')
  const today = new Date()
  const currentMonthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0')
  const parsedBaselineTime = Date.parse(dashboardBaseline.baselineAt || '')
  const baselineTime = Number.isFinite(parsedBaselineTime) ? parsedBaselineTime : Date.now()
  const currentMonthlyConsumption = Number(dashboardBaseline.monthlyConsumption?.[currentMonthKey] ?? confirmedMonthlyFuelTotals[currentMonthKey] ?? 0) + dashboardRecords.filter((record) => !record.sourceFile && record.date?.startsWith(currentMonthKey) && record.recordedAt && Date.parse(record.recordedAt) >= baselineTime).reduce((sum, record) => sum + Number(record.liters || 0), 0)
  const currentStock = Math.max(0, Number(dashboardBaseline.liters || 0) + dashboardDeliveries.filter((delivery) => Date.parse(delivery.recordedAt) >= baselineTime).reduce((sum, delivery) => sum + Number(delivery.liters || 0), 0) - dashboardRecords.filter((record) => !record.sourceFile && record.recordedAt && Date.parse(record.recordedAt) >= baselineTime).reduce((sum, record) => sum + Number(record.liters || 0), 0))
  const stockLevelClass = currentStock > 6000 ? 'stock-level-high' : currentStock >= 4000 ? 'stock-level-medium' : 'stock-level-low'
  const latestPumpIndexRecord = [...dashboardRecords].filter((record) => record.pumpIndex !== null && record.pumpIndex !== '' && Number.isFinite(Number(record.pumpIndex))).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.recordedAt || 0) - Date.parse(a.recordedAt || 0))[0]
  const numberFormat = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 3 })
  const dashboardTypeTotal = (type) => Number(enrochementBeforeAugust2026Tonnes[type] || 0) + dashboardEnrochementRecords.filter((record) => normalizeEnrochementType(record.type) === type).reduce((sum, record) => sum + Number(record.tonnageKg || 0), 0) / 1000
  const dashboardOverallTonnage = Object.values(enrochementBeforeAugust2026Tonnes).reduce((sum, value) => sum + value, 0) + dashboardEnrochementRecords.reduce((sum, record) => sum + Number(record.tonnageKg || 0), 0) / 1000

  const importBackupFile = async (event) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBackupImporting(true)
    setBackupImportStatus('Import de la sauvegarde…')
    try {
      const backup = JSON.parse(await file.text())
      await importCloudBackup(session, backup)
      window.location.reload()
    } catch (error) {
      setBackupImportStatus(error.message || 'Import impossible.')
    } finally {
      setBackupImporting(false)
      input.value = ''
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}headerlogo.png`} alt="Logo SOTUTRASM" /></div>
          <div><strong>SOTUTRASM</strong><span>BRAIN 365</span><small className="brand-credit">Developed by <b>SALIM-B</b> 2026 ©</small></div>
        </div>
        <div className="workspace-label">CHANTIER</div>
        <div className="workspace-selector">
          <button type="button" className="workspace" aria-haspopup="listbox" aria-expanded={siteMenuOpen} onClick={() => setSiteMenuOpen((open) => !open)}><span className="workspace-dot" />{activeSite}<span className="chevron">{siteMenuOpen ? '⌃' : '⌄'}</span></button>
          {siteMenuOpen && <div className="workspace-menu" role="listbox" aria-label="Choisir un chantier">{chantierOptions.filter((site) => site !== activeSite).map((site) => <button type="button" role="option" aria-selected="false" key={site} onClick={() => { setActiveSite(site); localStorage.setItem('sotutrasm-active-site', site); setSiteMenuOpen(false) }}>{site}</button>)}</div>}
        </div>
        <nav aria-label="Navigation principale">
          <div className="nav-caption">MENU PRINCIPAL</div>
          {navItems.map((item) => (
            <button key={item.label} className={`nav-item ${activePage === item.label ? 'selected' : ''}`} onClick={() => setActivePage(item.label)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.label === 'Rapports' && <span className="nav-arrow">›</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <label className="cloud-import-button">{backupImporting ? 'Import en cours…' : 'Importer une sauvegarde locale'}<input type="file" accept="application/json,.json" disabled={backupImporting} onChange={importBackupFile} /></label>
          {backupImportStatus && <small className="cloud-import-status" role="status">{backupImportStatus}</small>}
          <div className="profile"><div className="avatar">SB</div><div className="profile-copy"><strong>Salim Boukhari</strong><span>Administrateur</span></div><button className="more" aria-label="Se déconnecter" onClick={onLogout}>↪</button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">SOTUTRASM <span>/</span> <b>{activePage}</b></div>
          <div className="top-actions"><span className={`cloud-sync-status ${syncStatus}`}><i />{syncStatus === 'syncing' ? 'Synchronisation…' : syncStatus === 'error' ? 'Synchronisation en erreur' : 'Données partagées'}</span><span className="today">Mercredi 4 novembre 2026</span><button className="icon-button" aria-label="Notifications">♧<i /></button><div className="avatar small">SB</div></div>
        </header>

        {activePage === 'Carburant' ? <FuelModule /> : activePage === 'Parc matériel' ? <FleetModule /> : activePage === 'Enrochement' ? <EnrochementModule /> : activePage === 'Compteurs horaires' ? <HourMeterModule /> : <div className="page-content">
          <section className="welcome-row"><div className="welcome-copy"><div><div className="eyebrow">TABLEAU DE BORD</div><h1>Bonjour Chef</h1><p>Voici le résumé de votre activité aujourd'hui.</p></div><BizerteWeather /></div><button className="primary-button" onClick={() => setActivePage('Rapports')}><span>＋</span> Nouveau rapport</button></section>

          <section className="metric-grid" aria-label="Indicateurs clés">
            <article className="metric-card"><div className="metric-heading"><span>Consommation carburant</span><span className="metric-icon fuel">◉</span></div><div className="metric-value">{new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 0 }).format(currentMonthlyConsumption)} <small>L</small></div><div className="metric-foot"><span className="trend neutral">Mois en cours</span></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Reste dans le réservoir</span><span className="metric-icon stock">◉</span></div><div className={`metric-value ${stockLevelClass}`}>{numberFormat.format(currentStock)} <small>L</small></div><div className="metric-foot"><span className="trend neutral">Stock calculé</span></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Dernier index pompe</span><span className="metric-icon pump">↗</span></div><div className="metric-value">{latestPumpIndexRecord ? numberFormat.format(latestPumpIndexRecord.pumpIndex) : '—'} <small>{latestPumpIndexRecord ? 'L' : ''}</small></div><div className="metric-foot"><span>{latestPumpIndexRecord ? new Date(`${latestPumpIndexRecord.date}T00:00:00`).toLocaleDateString('fr-TN') : 'À renseigner'}</span></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Total enrochement</span><span className="metric-icon enrochement">◈</span></div><div className="metric-value">{numberFormat.format(dashboardOverallTonnage)} <small>t</small></div><div className="metric-foot"><span className="trend neutral">Tous types</span></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Total 1/500</span><span className="metric-icon type500">▦</span></div><div className="metric-value">{numberFormat.format(dashboardTypeTotal('1/500'))} <small>t</small></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Total 1/3T</span><span className="metric-icon type3t">▦</span></div><div className="metric-value">{numberFormat.format(dashboardTypeTotal('1/3T'))} <small>t</small></div></article>
            <article className="metric-card"><div className="metric-heading"><span>Total 25/40</span><span className="metric-icon type2540">▦</span></div><div className="metric-value">{numberFormat.format(dashboardTypeTotal('25/40'))} <small>t</small></div></article>
          </section>

          <section className="content-grid">
            <MonthlyConsumptionPanel records={dashboardRecords} baseline={dashboardBaseline} range={monthRange} onRangeChange={setMonthRange} />
            <DashboardEnrochementChart records={dashboardEnrochementRecords} />
          </section>
          <footer className="footer"><span>© 2026 SOTUTRASM BRAIN 365</span><span>Plateforme de gestion des opérations</span><span><i/> Système opérationnel</span></footer>
        </div>}
      </main>
    </div>
  )
}

export default App

