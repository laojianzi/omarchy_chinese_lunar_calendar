
// Pure subscription-config helpers shared by the QML settings UI and Node
// tests. The transport helper performs the authoritative validation before it
// writes; these helpers keep the editor responsive and generate the same
// canonical shape without exposing private feed URLs on a process command line.

var DEFAULT_HOLIDAY_URL = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json"

var REFRESH_OPTIONS = [
  { value: "1", hours: 1 },
  { value: "6", hours: 6 },
  { value: "12", hours: 12 },
  { value: "24", hours: 24 },
  { value: "72", hours: 72 },
  { value: "168", hours: 168 }
]

var CHECK_OPTIONS = [
  { value: "15", minutes: 15 },
  { value: "30", minutes: 30 },
  { value: "60", minutes: 60 },
  { value: "360", minutes: 360 },
  { value: "720", minutes: 720 },
  { value: "1440", minutes: 1440 }
]

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value))
}

function defaultHolidaySource() {
  return {
    id: "cn-official",
    name: "中国法定节假日",
    enabled: true,
    adapter: "holiday-cn-json",
    urlTemplate: DEFAULT_HOLIDAY_URL,
    refreshHours: 24,
    priority: 100
  }
}

function defaultTypedSource() {
  return {
    id: "typed-feed",
    name: "Typed calendar feed",
    enabled: true,
    adapter: "calendar-feed-v1",
    url: "https://",
    refreshHours: 6,
    priority: 20
  }
}

function defaultConfig() {
  return {
    schemaVersion: 1,
    autoUpdate: true,
    refreshOnStartup: true,
    refreshOnOpen: true,
    checkIntervalMinutes: 60,
    sources: [defaultHolidaySource()]
  }
}

function finiteNumber(value, fallback, minimum, maximum) {
  var parsed = Number(value)
  if (!isFinite(parsed)) parsed = Number(fallback)
  if (!isFinite(parsed)) parsed = 0
  if (minimum !== undefined && parsed < minimum) parsed = minimum
  if (maximum !== undefined && parsed > maximum) parsed = maximum
  return parsed
}

function boolValue(value, fallback) {
  return value === undefined || value === null ? !!fallback : value !== false
}

function normalizeWebcal(value) {
  var text = String(value || "").trim()
  return text.indexOf("webcal://") === 0 ? "https://" + text.substr(9) : text
}

function normalizeSource(raw, index) {
  var source = raw && typeof raw === "object" ? raw : {}
  var adapter = String(source.adapter || "calendar-feed-v1")
  if (adapter !== "holiday-cn-json" && adapter !== "calendar-feed-v1") adapter = "calendar-feed-v1"

  var fallbackId = adapter === "holiday-cn-json" ? "cn-official" : "typed-feed-" + String((index || 0) + 1)
  var normalized = {
    id: String(source.id || fallbackId).trim(),
    name: String(source.name || source.id || fallbackId).trim(),
    enabled: boolValue(source.enabled, true),
    adapter: adapter,
    refreshHours: finiteNumber(source.refreshHours, adapter === "holiday-cn-json" ? 24 : 6, 0.1, 8760),
    priority: finiteNumber(source.priority, adapter === "holiday-cn-json" ? 100 : 20, -10000, 10000)
  }

  if (adapter === "holiday-cn-json")
    normalized.urlTemplate = normalizeWebcal(source.urlTemplate || DEFAULT_HOLIDAY_URL)
  else
    normalized.url = normalizeWebcal(source.url || "https://")

  return normalized
}

function normalizeConfig(raw) {
  var input = raw && typeof raw === "object" ? raw : {}
  var sources = Array.isArray(input.sources) ? input.sources : []
  var normalizedSources = []
  for (var i = 0; i < sources.length; i++) normalizedSources.push(normalizeSource(sources[i], i))

  return {
    schemaVersion: 1,
    autoUpdate: boolValue(input.autoUpdate, true),
    refreshOnStartup: boolValue(input.refreshOnStartup, true),
    refreshOnOpen: boolValue(input.refreshOnOpen, true),
    checkIntervalMinutes: finiteNumber(input.checkIntervalMinutes, 60, 15, 1440),
    sources: normalizedSources
  }
}

function slugify(value) {
  var text = String(value || "source").toLowerCase()
  text = text.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return text || "source"
}

function uniqueSourceId(config, preferred, ignoredId) {
  var base = slugify(preferred)
  var used = {}
  var sources = config && Array.isArray(config.sources) ? config.sources : []
  for (var i = 0; i < sources.length; i++) {
    var id = String(sources[i] && sources[i].id || "")
    if (id && id !== ignoredId) used[id] = true
  }
  if (!used[base]) return base
  for (var suffix = 2; suffix < 1000; suffix++)
    if (!used[base + "-" + suffix]) return base + "-" + suffix
  return base + "-" + Date.now()
}

function sourceAddress(source) {
  if (!source) return ""
  return source.adapter === "holiday-cn-json"
    ? String(source.urlTemplate || "")
    : String(source.url || "")
}

function setSourceAddress(source, address) {
  var next = normalizeSource(source, 0)
  if (next.adapter === "holiday-cn-json") {
    next.urlTemplate = normalizeWebcal(address)
    delete next.url
  } else {
    next.url = normalizeWebcal(address)
    delete next.urlTemplate
  }
  return next
}

function redactAddress(value) {
  var text = String(value || "")
  var match = text.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]+)([^?#]*)/)
  if (!match) return text.length > 64 ? text.substr(0, 61) + "…" : text
  var authority = match[2]
  var at = authority.lastIndexOf("@")
  if (at >= 0) authority = "••••@" + authority.substr(at + 1)
  var path = match[3] || ""
  var compact = match[1] + authority + path
  return compact.length > 72 ? compact.substr(0, 69) + "…" : compact
}

function adapterCapabilities(adapter) {
  return adapter === "holiday-cn-json" ? ["schedule"] : ["schedule", "festival", "event"]
}

function validateAddress(source) {
  var address = normalizeWebcal(sourceAddress(source))
  if (!address) return "address-required"
  if (address.indexOf("https://") !== 0 && address.indexOf("file://") !== 0) return "https-required"
  if (address.length > 4096 || /[\r\n]/.test(address)) return "invalid-address"
  if (address.indexOf("https://") === 0 && !/^https:\/\/[^/?#\s]+/.test(address)) return "invalid-address"
  if (address.indexOf("file://") === 0 && address.length <= 7) return "invalid-address"
  if (source.adapter === "holiday-cn-json" && address.indexOf("{year}") < 0) return "year-placeholder-required"
  return ""
}

function validateSource(source, config, originalId) {
  var normalized = normalizeSource(source, 0)
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(normalized.id)) return "invalid-id"
  if (!normalized.name || normalized.name.length > 200) return "invalid-name"
  var sources = config && Array.isArray(config.sources) ? config.sources : []
  for (var i = 0; i < sources.length; i++) {
    var otherId = String(sources[i] && sources[i].id || "")
    if (otherId === normalized.id && otherId !== String(originalId || "")) return "duplicate-id"
  }
  return validateAddress(normalized)
}

function upsertSource(config, source, originalId) {
  var next = normalizeConfig(config)
  var normalized = normalizeSource(source, next.sources.length)
  var replaced = false
  for (var i = 0; i < next.sources.length; i++) {
    if (String(next.sources[i].id) === String(originalId || normalized.id)) {
      next.sources[i] = normalized
      replaced = true
      break
    }
  }
  if (!replaced) next.sources.push(normalized)
  return next
}

function removeSource(config, sourceId) {
  var next = normalizeConfig(config)
  var kept = []
  for (var i = 0; i < next.sources.length; i++)
    if (String(next.sources[i].id) !== String(sourceId)) kept.push(next.sources[i])
  next.sources = kept
  return next
}

function setSourceEnabled(config, sourceId, enabled) {
  var next = normalizeConfig(config)
  for (var i = 0; i < next.sources.length; i++) {
    if (String(next.sources[i].id) === String(sourceId)) {
      next.sources[i].enabled = !!enabled
      break
    }
  }
  return next
}

function presetSource(presetId, config) {
  var source = presetId === "cn-official" ? defaultHolidaySource() : defaultTypedSource()
  source.id = uniqueSourceId(config || defaultConfig(), source.id, "")
  return source
}

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_HOLIDAY_URL: DEFAULT_HOLIDAY_URL,
    REFRESH_OPTIONS: REFRESH_OPTIONS,
    CHECK_OPTIONS: CHECK_OPTIONS,
    clone: clone,
    defaultHolidaySource: defaultHolidaySource,
    defaultTypedSource: defaultTypedSource,
    defaultConfig: defaultConfig,
    normalizeWebcal: normalizeWebcal,
    normalizeSource: normalizeSource,
    normalizeConfig: normalizeConfig,
    uniqueSourceId: uniqueSourceId,
    sourceAddress: sourceAddress,
    setSourceAddress: setSourceAddress,
    redactAddress: redactAddress,
    adapterCapabilities: adapterCapabilities,
    validateAddress: validateAddress,
    validateSource: validateSource,
    upsertSource: upsertSource,
    removeSource: removeSource,
    setSourceEnabled: setSourceEnabled,
    presetSource: presetSource
  }
}
