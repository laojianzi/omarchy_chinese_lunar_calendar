// Typed calendar-record projection for the month grid.
//
// Transport adapters normalize every source into one of three semantic kinds:
//   schedule  - changes the effective work/rest state of a civil date
//   festival  - cultural label; never implies a day off by itself
//   event     - user/calendar occurrence; shown as dots and in day details
//
// QML passes the existing Model.js namespace into projectWeeks(), keeping this
// module independent of the lunar implementation and directly testable in Node.

var EMPTY_BUCKET = { schedule: [], festivals: [], events: [] }

var FESTIVAL_IDS = {
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

var DEFAULT_FESTIVAL_CATALOG = null
if (typeof module !== "undefined" && typeof require === "function")
  DEFAULT_FESTIVAL_CATALOG = require("./FestivalCatalog.js")

function resolvedFestivalCatalog(catalog) {
  var provider = catalog || DEFAULT_FESTIVAL_CATALOG
  if (!provider || typeof provider.recordsForDate !== "function" || typeof provider.mergeRecords !== "function")
    return null
  return provider
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function number(value, fallback) {
  var parsed = Number(value)
  return isFinite(parsed) ? parsed : fallback
}

function copyRecord(record) {
  var out = {}
  for (var key in record) out[key] = record[key]
  return out
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

function bucketFor(snapshot, key) {
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.byDate) return EMPTY_BUCKET
  var bucket = snapshot.byDate[key]
  if (!bucket) return EMPTY_BUCKET
  return {
    schedule: array(bucket.schedule),
    festivals: array(bucket.festivals),
    events: array(bucket.events)
  }
}

function legacyBuiltinFestivalRecords(lunarInfo, language, model) {
  if (!lunarInfo || !model) return []
  var cfg = model.langConfig(language)
  var records = []

  if (lunarInfo.festivalKey && cfg.festivals[lunarInfo.festivalKey]) {
    records.push({
      id: "builtin:" + (FESTIVAL_IDS[lunarInfo.festivalKey] || lunarInfo.festivalKey),
      sourceId: "builtin-lunar",
      kind: "festival",
      title: cfg.festivals[lunarInfo.festivalKey],
      priority: 100,
      payload: {
        festivalId: FESTIVAL_IDS[lunarInfo.festivalKey] || lunarInfo.festivalKey,
        calendar: "lunar"
      }
    })
  }

  if (lunarInfo.isEve) {
    records.push({
      id: "builtin:cn.new-years-eve",
      sourceId: "builtin-lunar",
      kind: "festival",
      title: cfg.eveName,
      priority: 110,
      payload: {
        festivalId: "cn.new-years-eve",
        calendar: "lunar-rule"
      }
    })
  }

  return records
}

function builtinFestivalRecords(cell, lunarInfo, language, model, catalog) {
  var provider = resolvedFestivalCatalog(catalog)
  if (provider) return provider.recordsForDate(cell, lunarInfo, language)
  return legacyBuiltinFestivalRecords(lunarInfo, language, model)
}

function festivalKey(record) {
  var payload = record && record.payload ? record.payload : {}
  return String(payload.festivalId || record.id || (record.sourceId + ":" + record.title))
}

function legacyMergeFestivals(builtin, subscribed) {
  var merged = []
  var byKey = {}
  var all = array(builtin).concat(array(subscribed))

  for (var i = 0; i < all.length; i++) {
    var record = all[i]
    if (!record || record.kind && record.kind !== "festival") continue
    var key = festivalKey(record)
    var previous = byKey[key]
    if (!previous || recordPriority(record) > recordPriority(previous)) byKey[key] = record
  }

  for (var id in byKey) merged.push(copyRecord(byKey[id]))
  merged.sort(compareRecords)
  return merged
}

function mergeFestivals(builtin, subscribed, catalog) {
  var provider = resolvedFestivalCatalog(catalog)
  if (provider) return provider.mergeRecords(builtin, subscribed)
  return legacyMergeFestivals(builtin, subscribed)
}

function scheduleStatus(record) {
  var payload = record && record.payload ? record.payload : {}
  var status = String(payload.status || record.status || "")
  return status === "off" || status === "work" ? status : ""
}

function resolveSchedule(records) {
  var candidates = []
  var list = array(records)

  for (var i = 0; i < list.length; i++) {
    var status = scheduleStatus(list[i])
    if (!status) continue
    var record = copyRecord(list[i])
    record.resolvedStatus = status
    candidates.push(record)
  }

  if (candidates.length === 0) return null
  candidates.sort(compareRecords)

  var topPriority = recordPriority(candidates[0])
  var top = []
  for (var j = 0; j < candidates.length; j++) {
    if (recordPriority(candidates[j]) !== topPriority) break
    top.push(candidates[j])
  }

  var status = top[0].resolvedStatus
  var conflict = false
  for (var k = 1; k < top.length; k++) {
    if (top[k].resolvedStatus !== status) {
      conflict = true
      break
    }
  }

  return {
    status: conflict ? "conflict" : status,
    title: String(top[0].title || ""),
    badge: conflict ? "!" : (status === "off" ? "休" : "班"),
    sourceId: String(top[0].sourceId || ""),
    conflict: conflict,
    candidates: top
  }
}

function lunarFallbackCaption(info, language, showJieqi, model) {
  if (!info || !model) return ""
  var cfg = model.langConfig(language)

  if (showJieqi && info.solarTermIndex !== null && info.solarTermIndex !== undefined)
    return cfg.solarTerms[info.solarTermIndex]
  if (info.lunarDay === 1)
    return (info.isLeap ? cfg.leapWord : "") + cfg.monthNames[info.lunarMonth - 1] + cfg.monthWord
  return cfg.dayNames[info.lunarDay - 1]
}

function chooseCaption(festivals, lunarInfo, language, showJieqi, model) {
  if (festivals.length > 0) return String(festivals[0].title || "")
  return lunarFallbackCaption(lunarInfo, language, showJieqi, model)
}

function festivalIdForRecord(record, catalog) {
  var provider = resolvedFestivalCatalog(catalog)
  if (provider && typeof provider.festivalId === "function") return provider.festivalId(record)
  var payload = record && record.payload ? record.payload : {}
  return String(payload.festivalId || "")
}

function containsFestivalId(records, festivalId, catalog) {
  var provider = resolvedFestivalCatalog(catalog)
  if (provider && typeof provider.containsFestivalId === "function")
    return provider.containsFestivalId(records, festivalId)
  var id = String(festivalId || "")
  var list = array(records)
  for (var i = 0; i < list.length; i++) if (festivalIdForRecord(list[i], catalog) === id) return true
  return false
}

function eventStartKey(record) {
  var span = record && record.span ? record.span : {}
  return String(span.start || "")
}

function sortEvents(events) {
  var out = []
  var list = array(events)
  for (var i = 0; i < list.length; i++) {
    if (!list[i] || list[i].kind && list[i].kind !== "event") continue
    out.push(copyRecord(list[i]))
  }
  out.sort(function(left, right) {
    var startLeft = eventStartKey(left)
    var startRight = eventStartKey(right)
    if (startLeft < startRight) return -1
    if (startLeft > startRight) return 1
    return compareRecords(left, right)
  })
  return out
}

function projectionArgs(options, model, catalog) {
  if (!model && options && typeof options.computeLunarInfo === "function")
    return { options: {}, model: options, catalog: resolvedFestivalCatalog(catalog) }
  return {
    options: options && typeof options === "object" ? options : {},
    model: model,
    catalog: resolvedFestivalCatalog(catalog)
  }
}

// Saturday/Sunday settings describe the ordinary weekly schedule. They are
// the base state only; a date-specific subscribed schedule is authoritative
// for that date and is applied afterwards.
function baseRestEnabled(cell, options) {
  if (!cell) return false
  if (cell.weekday === 6) return options.saturdayIsRest !== false
  if (cell.weekday === 0) return options.sundayIsRest !== false
  return false
}

function weeklyRestTitle(cell, language) {
  var saturday = cell && cell.weekday === 6
  if (language === "en") return saturday ? "Saturday rest" : "Sunday rest"
  if (language === "zh-Hant") return saturday ? "週六休息" : "週日休息"
  return saturday ? "周六休息" : "周日休息"
}

function baseWeekPolicy(cell, options, language) {
  var isRest = baseRestEnabled(cell, options || {})
  return {
    isRest: isRest,
    dayType: isRest ? "rest" : "work",
    weekday: cell ? cell.weekday : -1,
    title: isRest ? weeklyRestTitle(cell, language) : "",
    sourceId: "builtin-weekly-schedule"
  }
}

// The transition is deliberately explicit: a subscribed 班 record on a base
// rest day is make-up work (rest -> work), while a subscribed 休 record on a
// base workday creates a holiday (work -> rest).
function scheduleTransition(basePolicy, schedule) {
  if (!schedule) return basePolicy.isRest ? "base-rest" : "base-work"
  if (schedule.status === "conflict") return "conflict"
  var from = basePolicy.isRest ? "rest" : "work"
  var to = schedule.status === "off" ? "rest" : "work"
  return from + "-to-" + to
}

function effectiveDayType(basePolicy, schedule) {
  if (schedule) {
    if (schedule.status === "conflict") return "schedule-conflict"
    if (schedule.status === "off")
      return basePolicy.isRest ? "scheduled-rest" : "official-off"
    if (schedule.status === "work")
      return basePolicy.isRest ? "makeup-work" : "scheduled-work"
  }
  return basePolicy.isRest ? "regular-rest" : "weekday"
}

function effectiveBadge(basePolicy, schedule) {
  if (schedule) {
    return {
      text: String(schedule.badge || ""),
      role: String(schedule.status || ""),
      origin: "subscription"
    }
  }
  if (basePolicy.isRest) return { text: "休", role: "off", origin: "base-week" }
  return { text: "", role: "", origin: "none" }
}

// The month grid is a visible civil-date window. Leading/trailing dates from
// adjacent months receive the same projection as current-month dates; this
// metadata is only a presentation hint for de-emphasis.
function monthScope(cell) {
  return cell && cell.inMonth === false ? "adjacent-month" : "current-month"
}

function projectDay(cell, snapshot, language, showJieqi, options, model, catalog) {
  var args = projectionArgs(options, model, catalog)
  var projectionOptions = args.options
  var calendarModel = args.model
  var bucket = bucketFor(snapshot, cell.key)
  var lunarInfo = calendarModel.computeLunarInfo(cell.year, cell.month + 1, cell.day)
  var festivals = mergeFestivals(
    builtinFestivalRecords(cell, lunarInfo, language, calendarModel, args.catalog),
    bucket.festivals,
    args.catalog
  )
  var basePolicy = baseWeekPolicy(cell, projectionOptions, language)
  var schedule = resolveSchedule(bucket.schedule)
  var relatedFestivalId = ""
  if (schedule && args.catalog && typeof args.catalog.canonicalHolidayIdForSchedule === "function") {
    relatedFestivalId = args.catalog.canonicalHolidayIdForSchedule(schedule)
    if (relatedFestivalId) schedule.relatedFestivalId = relatedFestivalId
  }
  var transition = scheduleTransition(basePolicy, schedule)
  var badge = effectiveBadge(basePolicy, schedule)
  var events = sortEvents(bucket.events)

  var projected = {}
  for (var key in cell) projected[key] = cell[key]

  projected.lunar = lunarInfo
  projected.basePolicy = basePolicy
  projected.schedule = schedule
  projected.festivals = festivals
  projected.events = events
  var scope = monthScope(cell)
  projected.presentation = {
    monthScope: scope,
    isAdjacentMonth: scope === "adjacent-month",
    baseDayType: basePolicy.dayType,
    effectiveDayType: effectiveDayType(basePolicy, schedule),
    scheduleTransition: transition,
    scheduleOrigin: badge.origin,
    changesBase: transition === "rest-to-work" || transition === "work-to-rest",
    caption: chooseCaption(festivals, lunarInfo, language, showJieqi, calendarModel),
    festivalCount: festivals.length,
    primaryFestivalId: festivals.length > 0 ? festivalIdForRecord(festivals[0], args.catalog) : "",
    scheduleRelatedFestivalId: relatedFestivalId,
    scheduleHasVisibleFestival: containsFestivalId(festivals, relatedFestivalId, args.catalog),
    badgeText: badge.text,
    badgeRole: badge.role,
    eventCount: events.length,
    eventDotCount: Math.min(3, events.length)
  }
  return projected
}

function projectWeeks(baseWeeks, snapshot, language, showJieqi, options, model, catalog) {
  var args = projectionArgs(options, model, catalog)
  var projectedWeeks = []
  var weeks = array(baseWeeks)

  for (var w = 0; w < weeks.length; w++) {
    var days = []
    var baseDays = array(weeks[w].days)
    for (var d = 0; d < baseDays.length; d++)
      days.push(projectDay(baseDays[d], snapshot, language, showJieqi, args.options, args.model, args.catalog))
    projectedWeeks.push({ week: weeks[w].week, days: days })
  }

  return projectedWeeks
}

if (typeof module !== "undefined") {
  module.exports = {
    bucketFor: bucketFor,
    builtinFestivalRecords: builtinFestivalRecords,
    mergeFestivals: mergeFestivals,
    festivalIdForRecord: festivalIdForRecord,
    containsFestivalId: containsFestivalId,
    resolveSchedule: resolveSchedule,
    baseWeekPolicy: baseWeekPolicy,
    scheduleTransition: scheduleTransition,
    effectiveDayType: effectiveDayType,
    monthScope: monthScope,
    projectDay: projectDay,
    projectWeeks: projectWeeks
  }
}
