// Canonical festival and observance domain model.
//
// A festival is not a work/rest schedule. Schedules answer whether a civil
// date is worked or rested and may span several days; festivals identify the
// actual cultural or statutory observance date. This catalog provides the
// deterministic built-in layer for Gregorian, lunar, solar-term, and rule-
// based observances, while subscribed festival records are merged by a stable
// canonical festivalId without losing provenance.

var BUILTIN_SOURCE_ID = "builtin-festival-catalog"

var FESTIVALS = {
  "cn.new-years-day": {
    names: { "zh-Hans": "元旦", "zh-Hant": "元旦", "en": "New Year's Day" },
    calendar: "gregorian",
    category: "statutory-holiday",
    statutory: true,
    priority: 140
  },
  "cn.spring-festival": {
    names: { "zh-Hans": "春节", "zh-Hant": "春節", "en": "Chinese New Year" },
    calendar: "lunar",
    category: "statutory-holiday",
    statutory: true,
    priority: 150
  },
  "cn.lantern-festival": {
    names: { "zh-Hans": "元宵节", "zh-Hant": "元宵節", "en": "Lantern Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 105
  },
  "cn.longtaitou": {
    names: { "zh-Hans": "龙抬头", "zh-Hant": "龍抬頭", "en": "Dragon Head-Raising Day" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 80
  },
  "cn.shangsi-festival": {
    names: { "zh-Hans": "上巳节", "zh-Hant": "上巳節", "en": "Shangsi Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 75
  },
  "cn.qingming-festival": {
    names: { "zh-Hans": "清明节", "zh-Hant": "清明節", "en": "Qingming Festival" },
    calendar: "solar-term",
    category: "statutory-holiday",
    statutory: true,
    priority: 140
  },
  "cn.labor-day": {
    names: { "zh-Hans": "劳动节", "zh-Hant": "勞動節", "en": "Labour Day" },
    calendar: "gregorian",
    category: "statutory-holiday",
    statutory: true,
    priority: 140
  },
  "cn.dragon-boat-festival": {
    names: { "zh-Hans": "端午节", "zh-Hant": "端午節", "en": "Dragon Boat Festival" },
    calendar: "lunar",
    category: "statutory-holiday",
    statutory: true,
    priority: 140
  },
  "cn.qixi-festival": {
    names: { "zh-Hans": "七夕节", "zh-Hant": "七夕節", "en": "Qixi Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 90
  },
  "cn.ghost-festival": {
    names: { "zh-Hans": "中元节", "zh-Hant": "中元節", "en": "Ghost Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 85
  },
  "cn.mid-autumn-festival": {
    names: { "zh-Hans": "中秋节", "zh-Hant": "中秋節", "en": "Mid-Autumn Festival" },
    calendar: "lunar",
    category: "statutory-holiday",
    statutory: true,
    priority: 140
  },
  "cn.double-ninth-festival": {
    names: { "zh-Hans": "重阳节", "zh-Hant": "重陽節", "en": "Double Ninth Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 90
  },
  "cn.laba-festival": {
    names: { "zh-Hans": "腊八节", "zh-Hant": "臘八節", "en": "Laba Festival" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 75
  },
  "cn.little-new-year": {
    names: { "zh-Hans": "小年", "zh-Hant": "小年", "en": "Little New Year" },
    calendar: "lunar",
    category: "traditional-festival",
    statutory: false,
    priority: 80
  },
  "cn.new-years-eve": {
    names: { "zh-Hans": "除夕", "zh-Hant": "除夕", "en": "Chinese New Year's Eve" },
    calendar: "lunar-rule",
    category: "traditional-festival",
    statutory: false,
    priority: 145
  },
  "cn.national-day": {
    names: { "zh-Hans": "国庆节", "zh-Hant": "國慶節", "en": "National Day" },
    calendar: "gregorian",
    category: "statutory-holiday",
    statutory: true,
    priority: 145
  }
}

var LUNAR_KEY_TO_ID = {
  "1-1": "cn.spring-festival",
  "1-15": "cn.lantern-festival",
  "2-2": "cn.longtaitou",
  "3-3": "cn.shangsi-festival",
  "5-5": "cn.dragon-boat-festival",
  "7-7": "cn.qixi-festival",
  "7-15": "cn.ghost-festival",
  "8-15": "cn.mid-autumn-festival",
  "9-9": "cn.double-ninth-festival",
  "12-8": "cn.laba-festival",
  "12-23": "cn.little-new-year"
}

var GREGORIAN_RULES = [
  { month: 1, day: 1, festivalId: "cn.new-years-day" },
  { month: 5, day: 1, festivalId: "cn.labor-day" },
  { month: 10, day: 1, festivalId: "cn.national-day" }
]

// The Model.js solar-term array is zero-based and Qingming is index 6.
var SOLAR_TERM_TO_ID = { "6": "cn.qingming-festival" }

var FESTIVAL_ID_ALIASES = {
  "cn.new-year": "cn.new-years-day",
  "cn.new-year-day": "cn.new-years-day",
  "cn.qingming": "cn.qingming-festival",
  "cn.labor": "cn.labor-day",
  "cn.national": "cn.national-day"
}

var OFFICIAL_TITLE_TO_ID = {
  "元旦": "cn.new-years-day",
  "元旦节": "cn.new-years-day",
  "春節": "cn.spring-festival",
  "春节": "cn.spring-festival",
  "清明": "cn.qingming-festival",
  "清明節": "cn.qingming-festival",
  "清明节": "cn.qingming-festival",
  "勞動節": "cn.labor-day",
  "劳动节": "cn.labor-day",
  "端午節": "cn.dragon-boat-festival",
  "端午节": "cn.dragon-boat-festival",
  "中秋節": "cn.mid-autumn-festival",
  "中秋节": "cn.mid-autumn-festival",
  "國慶節": "cn.national-day",
  "国庆节": "cn.national-day"
}

var CATEGORY_LABELS = {
  "statutory-holiday": { "zh-Hans": "法定节日", "zh-Hant": "法定節日", "en": "Statutory holiday" },
  "traditional-festival": { "zh-Hans": "传统节日", "zh-Hant": "傳統節日", "en": "Traditional festival" },
  "subscribed-festival": { "zh-Hans": "订阅节日", "zh-Hant": "訂閱節日", "en": "Subscribed festival" }
}

var CALENDAR_LABELS = {
  "gregorian": { "zh-Hans": "公历", "zh-Hant": "公曆", "en": "Gregorian" },
  "lunar": { "zh-Hans": "农历", "zh-Hant": "農曆", "en": "Lunar" },
  "lunar-rule": { "zh-Hans": "农历规则", "zh-Hant": "農曆規則", "en": "Lunar rule" },
  "solar-term": { "zh-Hans": "节气", "zh-Hant": "節氣", "en": "Solar term" }
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function number(value, fallback) {
  var parsed = Number(value)
  return isFinite(parsed) ? parsed : fallback
}

function normalizedLanguage(language) {
  return language === "zh-Hant" || language === "en" ? language : "zh-Hans"
}

function localized(map, language, fallback) {
  var lang = normalizedLanguage(language)
  return map && map[lang] ? String(map[lang]) : String(fallback || "")
}

function cloneObject(value) {
  var out = {}
  if (!value || typeof value !== "object") return out
  for (var key in value) out[key] = value[key]
  return out
}

function cloneRecord(record) {
  var out = {}
  if (!record || typeof record !== "object") return out
  for (var key in record) out[key] = record[key]
  out.payload = cloneObject(record.payload)
  return out
}

function normalizeFestivalId(value) {
  var id = String(value || "").trim()
  if (!id) return ""
  return FESTIVAL_ID_ALIASES[id] || id
}

function definitionFor(festivalId) {
  return FESTIVALS[normalizeFestivalId(festivalId)] || null
}

function titleForId(festivalId, language) {
  var definition = definitionFor(festivalId)
  return definition ? localized(definition.names, language, festivalId) : String(festivalId || "")
}

function recordPriority(record) {
  return number(record && record.priority, 0)
}

function compareRecords(left, right) {
  var priorityDelta = recordPriority(right) - recordPriority(left)
  if (priorityDelta !== 0) return priorityDelta
  var leftTitle = String(left && left.title || "")
  var rightTitle = String(right && right.title || "")
  if (leftTitle < rightTitle) return -1
  if (leftTitle > rightTitle) return 1
  var leftId = String(left && left.id || "")
  var rightId = String(right && right.id || "")
  if (leftId < rightId) return -1
  if (leftId > rightId) return 1
  return 0
}

function dateKey(cell) {
  if (cell && cell.key) return String(cell.key)
  if (!cell) return ""
  var month = Number(cell.month) + 1
  var day = Number(cell.day)
  return String(cell.year) + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day
}

function recordForDefinition(festivalId, cell, language) {
  var id = normalizeFestivalId(festivalId)
  var definition = definitionFor(id)
  if (!definition) return null
  var key = dateKey(cell)
  return {
    id: "builtin:" + id + ":" + key,
    sourceId: BUILTIN_SOURCE_ID,
    kind: "festival",
    title: localized(definition.names, language, id),
    priority: definition.priority,
    payload: {
      festivalId: id,
      calendar: definition.calendar,
      category: definition.category,
      statutory: definition.statutory === true,
      builtin: true,
      observanceDate: key
    }
  }
}

function recordsForDate(cell, lunarInfo, language) {
  if (!cell) return []
  var records = []
  var month = Number(cell.month) + 1
  var day = Number(cell.day)

  for (var i = 0; i < GREGORIAN_RULES.length; i++) {
    var rule = GREGORIAN_RULES[i]
    if (rule.month === month && rule.day === day)
      records.push(recordForDefinition(rule.festivalId, cell, language))
  }

  if (lunarInfo) {
    var lunarId = LUNAR_KEY_TO_ID[String(lunarInfo.festivalKey || "")]
    if (lunarId) records.push(recordForDefinition(lunarId, cell, language))
    if (lunarInfo.isEve) records.push(recordForDefinition("cn.new-years-eve", cell, language))
    var termId = SOLAR_TERM_TO_ID[String(lunarInfo.solarTermIndex)]
    if (termId) records.push(recordForDefinition(termId, cell, language))
  }

  var filtered = []
  for (var j = 0; j < records.length; j++) if (records[j]) filtered.push(records[j])
  filtered.sort(compareRecords)
  return filtered
}

function festivalId(record) {
  var payload = record && record.payload ? record.payload : {}
  return normalizeFestivalId(payload.festivalId)
}

function festivalKey(record) {
  var canonical = festivalId(record)
  if (canonical) return "festival:" + canonical
  return "record:" + String(record && record.sourceId || "") + ":" + String(record && record.id || "")
}

function provenanceRecord(record) {
  var payload = record && record.payload ? record.payload : {}
  return {
    sourceId: String(record && record.sourceId || ""),
    id: String(record && record.id || ""),
    title: String(record && record.title || ""),
    priority: recordPriority(record),
    calendar: String(payload.calendar || ""),
    category: String(payload.category || ""),
    builtin: payload.builtin === true || String(record && record.sourceId || "").indexOf("builtin-") === 0
  }
}

function mergeRecords(builtin, subscribed) {
  var groups = {}
  var all = array(builtin).concat(array(subscribed))

  for (var i = 0; i < all.length; i++) {
    var record = all[i]
    if (!record || record.kind && record.kind !== "festival") continue
    var key = festivalKey(record)
    if (!groups[key]) groups[key] = []
    groups[key].push(cloneRecord(record))
  }

  var merged = []
  for (var key in groups) {
    var records = groups[key]
    records.sort(compareRecords)
    var primary = cloneRecord(records[0])
    var canonical = festivalId(primary)
    var provenance = []
    var provenanceSeen = {}
    var sourceIds = []
    var sourceSeen = {}
    var statutory = false
    var hasBuiltin = false
    var calendar = String(primary.payload.calendar || "")
    var category = String(primary.payload.category || "")

    for (var j = 0; j < records.length; j++) {
      var item = records[j]
      var itemPayload = item.payload || {}
      statutory = statutory || itemPayload.statutory === true
      hasBuiltin = hasBuiltin || itemPayload.builtin === true || String(item.sourceId || "").indexOf("builtin-") === 0
      if (!calendar && itemPayload.calendar) calendar = String(itemPayload.calendar)
      if (!category && itemPayload.category) category = String(itemPayload.category)

      var provenanceItem = provenanceRecord(item)
      var provenanceKey = provenanceItem.sourceId + "\u0000" + provenanceItem.id
      if (!provenanceSeen[provenanceKey]) {
        provenanceSeen[provenanceKey] = true
        provenance.push(provenanceItem)
      }
      if (!sourceSeen[provenanceItem.sourceId]) {
        sourceSeen[provenanceItem.sourceId] = true
        sourceIds.push(provenanceItem.sourceId)
      }
    }

    if (canonical) primary.payload.festivalId = canonical
    primary.payload.calendar = calendar
    primary.payload.category = category || "subscribed-festival"
    primary.payload.statutory = statutory
    primary.payload.hasBuiltin = hasBuiltin
    primary.provenance = provenance
    primary.sourceIds = sourceIds
    primary.mergedCount = records.length
    merged.push(primary)
  }

  merged.sort(compareRecords)
  return merged
}

function categoryLabel(record, language) {
  var payload = record && record.payload ? record.payload : {}
  var category = String(payload.category || "subscribed-festival")
  return localized(CATEGORY_LABELS[category] || CATEGORY_LABELS["subscribed-festival"], language, category)
}

function calendarLabel(record, language) {
  var payload = record && record.payload ? record.payload : {}
  var calendar = String(payload.calendar || "")
  return calendar ? localized(CALENDAR_LABELS[calendar], language, calendar) : ""
}

function sourceLabel(sourceId, language) {
  var id = String(sourceId || "")
  if (id.indexOf("builtin-") === 0)
    return normalizedLanguage(language) === "en" ? "Built-in" : (normalizedLanguage(language) === "zh-Hant" ? "內建" : "内置")
  return id
}

function metadataLine(record, language) {
  if (!record) return ""
  var lang = normalizedLanguage(language)
  var parts = [categoryLabel(record, lang)]
  var calendar = calendarLabel(record, lang)
  if (calendar) parts.push(calendar)

  var sources = []
  var seen = {}
  var provenance = array(record.provenance)
  if (provenance.length === 0) provenance = [provenanceRecord(record)]
  for (var i = 0; i < provenance.length; i++) {
    var label = sourceLabel(provenance[i].sourceId, lang)
    if (label && !seen[label]) {
      seen[label] = true
      sources.push(label)
    }
  }
  if (sources.length === 1 && (sources[0] === "内置" || sources[0] === "內建" || sources[0] === "Built-in")) {
    parts.push(sources[0])
  } else if (sources.length > 0) {
    var prefix = lang === "en" ? "Source: " : (lang === "zh-Hant" ? "來源：" : "来源：")
    parts.push(prefix + sources.join(lang === "en" ? ", " : "、"))
  }
  return parts.join(" · ")
}

function normalizeOfficialTitle(value) {
  var title = String(value || "").replace(/\s+/g, "")
  return title.replace(/(假期|假日|放假|補班|补班|調休|调休)$/g, "")
}

function canonicalHolidayIdForSchedule(schedule) {
  if (!schedule) return ""
  var candidates = array(schedule.candidates)
  var candidate = candidates.length > 0 ? candidates[0] : schedule
  var payload = candidate && candidate.payload ? candidate.payload : {}
  if (String(payload.scope || "") !== "official") return ""
  return normalizeFestivalId(OFFICIAL_TITLE_TO_ID[normalizeOfficialTitle(schedule.title)] || "")
}

function containsFestivalId(records, id) {
  var canonical = normalizeFestivalId(id)
  if (!canonical) return false
  var list = array(records)
  for (var i = 0; i < list.length; i++) if (festivalId(list[i]) === canonical) return true
  return false
}

if (typeof module !== "undefined") {
  module.exports = {
    BUILTIN_SOURCE_ID: BUILTIN_SOURCE_ID,
    FESTIVALS: FESTIVALS,
    normalizedLanguage: normalizedLanguage,
    normalizeFestivalId: normalizeFestivalId,
    definitionFor: definitionFor,
    titleForId: titleForId,
    recordsForDate: recordsForDate,
    festivalId: festivalId,
    mergeRecords: mergeRecords,
    categoryLabel: categoryLabel,
    calendarLabel: calendarLabel,
    metadataLine: metadataLine,
    canonicalHolidayIdForSchedule: canonicalHolidayIdForSchedule,
    containsFestivalId: containsFestivalId
  }
}
