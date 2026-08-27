// Bridge between Omarchy's native bar-widget settings and the typed
// subscription config stored outside shell.json. Only non-secret quick settings
// are mirrored here; arbitrary private feed URLs remain in the advanced editor.

var DEFAULT_HOLIDAY_URL = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json"

var KEYS = [
  "subscriptionAutoUpdate",
  "subscriptionRefreshOnStartup",
  "subscriptionRefreshOnOpen",
  "subscriptionCheckIntervalMinutes",
  "subscriptionOfficialEnabled",
  "subscriptionOfficialUrlTemplate",
  "subscriptionOfficialRefreshHours"
]

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value))
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

function findOfficialIndex(sources) {
  var list = Array.isArray(sources) ? sources : []
  for (var i = 0; i < list.length; i++)
    if (String(list[i] && list[i].id || "") === "cn-official") return i
  for (var j = 0; j < list.length; j++)
    if (String(list[j] && list[j].adapter || "") === "holiday-cn-json") return j
  return -1
}

function settingsFromConfig(raw) {
  var config = raw && typeof raw === "object" ? raw : {}
  var sources = Array.isArray(config.sources) ? config.sources : []
  var index = findOfficialIndex(sources)
  var official = index >= 0 ? sources[index] || {} : null

  return {
    subscriptionAutoUpdate: config.autoUpdate !== false,
    subscriptionRefreshOnStartup: config.refreshOnStartup !== false,
    subscriptionRefreshOnOpen: config.refreshOnOpen !== false,
    subscriptionCheckIntervalMinutes: finiteNumber(config.checkIntervalMinutes, 60, 15, 1440),
    subscriptionOfficialEnabled: official ? official.enabled !== false : false,
    subscriptionOfficialUrlTemplate: official
      ? String(official.urlTemplate || DEFAULT_HOLIDAY_URL)
      : DEFAULT_HOLIDAY_URL,
    subscriptionOfficialRefreshHours: official
      ? finiteNumber(official.refreshHours, 24, 1, 168)
      : 24
  }
}

function applyToConfig(raw, settings) {
  var config = raw && typeof raw === "object" ? clone(raw) : { schemaVersion: 1, sources: [] }
  if (!Array.isArray(config.sources)) config.sources = []
  config.schemaVersion = 1

  var current = settingsFromConfig(config)
  var input = settings && typeof settings === "object" ? settings : {}
  config.autoUpdate = boolValue(input.subscriptionAutoUpdate, current.subscriptionAutoUpdate)
  config.refreshOnStartup = boolValue(input.subscriptionRefreshOnStartup, current.subscriptionRefreshOnStartup)
  config.refreshOnOpen = boolValue(input.subscriptionRefreshOnOpen, current.subscriptionRefreshOnOpen)
  config.checkIntervalMinutes = finiteNumber(
    input.subscriptionCheckIntervalMinutes,
    current.subscriptionCheckIntervalMinutes,
    15,
    1440
  )

  var enabled = boolValue(input.subscriptionOfficialEnabled, current.subscriptionOfficialEnabled)
  var urlTemplate = String(input.subscriptionOfficialUrlTemplate || current.subscriptionOfficialUrlTemplate || DEFAULT_HOLIDAY_URL).trim()
  var refreshHours = finiteNumber(
    input.subscriptionOfficialRefreshHours,
    current.subscriptionOfficialRefreshHours,
    1,
    168
  )

  var index = findOfficialIndex(config.sources)
  if (index < 0 && enabled) {
    config.sources.push({
      id: "cn-official",
      name: "中国法定节假日",
      enabled: true,
      adapter: "holiday-cn-json",
      urlTemplate: urlTemplate,
      refreshHours: refreshHours,
      priority: 100
    })
    index = config.sources.length - 1
  }

  if (index >= 0) {
    var source = config.sources[index] || {}
    source.id = String(source.id || "cn-official")
    source.name = String(source.name || "中国法定节假日")
    source.adapter = "holiday-cn-json"
    source.enabled = enabled
    source.urlTemplate = urlTemplate
    source.refreshHours = refreshHours
    if (!isFinite(Number(source.priority))) source.priority = 100
    delete source.url
    config.sources[index] = source
  }

  return config
}

function differs(settings, values) {
  var input = settings && typeof settings === "object" ? settings : {}
  var expected = values && typeof values === "object" ? values : {}
  for (var i = 0; i < KEYS.length; i++) {
    var key = KEYS[i]
    if (JSON.stringify(input[key]) !== JSON.stringify(expected[key])) return true
  }
  return false
}

function mergeIntoEntry(settings, values, moduleName) {
  var entry = { id: String(moduleName || "") }
  var input = settings && typeof settings === "object" ? settings : {}
  for (var key in input) if (key !== "id") entry[key] = input[key]
  var expected = values && typeof values === "object" ? values : {}
  for (var i = 0; i < KEYS.length; i++) entry[KEYS[i]] = expected[KEYS[i]]
  return entry
}

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_HOLIDAY_URL: DEFAULT_HOLIDAY_URL,
    KEYS: KEYS,
    settingsFromConfig: settingsFromConfig,
    applyToConfig: applyToConfig,
    differs: differs,
    mergeIntoEntry: mergeIntoEntry
  }
}
