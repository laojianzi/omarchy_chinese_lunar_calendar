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

function builtinFestivalRecords(lunarInfo, language, model) {
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

function festivalKey(record) {
  var payload = record && record.payload ? record.payload : {}
  return String(payload.festivalId || record.id || (record.sourceId + ":" + record.title))
}

function mergeFestivals(builtin, subscribed) {
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

function effectiveDayType(cell, schedule) {
  if (schedule) {
    if (schedule.status === "off") return "official-off"
    if (schedule.status === "work") return "makeup-work"
    if (schedule.status === "conflict") return "schedule-conflict"
  }
  return cell.weekend ? "weekend" : "weekday"
}

function projectDay(cell, snapshot, language, showJieqi, model) {
  var bucket = bucketFor(snapshot, cell.key)
  var lunarInfo = model.computeLunarInfo(cell.year, cell.month + 1, cell.day)
  var festivals = mergeFestivals(
    builtinFestivalRecords(lunarInfo, language, model),
    bucket.festivals
  )
  var schedule = resolveSchedule(bucket.schedule)
  var events = sortEvents(bucket.events)

  var projected = {}
  for (var key in cell) projected[key] = cell[key]

  projected.lunar = lunarInfo
  projected.schedule = schedule
  projected.festivals = festivals
  projected.events = events
  projected.presentation = {
    effectiveDayType: effectiveDayType(cell, schedule),
    caption: chooseCaption(festivals, lunarInfo, language, showJieqi, model),
    badgeText: schedule ? schedule.badge : "",
    badgeRole: schedule ? schedule.status : "",
    eventCount: events.length,
    eventDotCount: Math.min(3, events.length)
  }
  return projected
}

function projectWeeks(baseWeeks, snapshot, language, showJieqi, model) {
  var projectedWeeks = []
  var weeks = array(baseWeeks)

  for (var w = 0; w < weeks.length; w++) {
    var days = []
    var baseDays = array(weeks[w].days)
    for (var d = 0; d < baseDays.length; d++)
      days.push(projectDay(baseDays[d], snapshot, language, showJieqi, model))
    projectedWeeks.push({ week: weeks[w].week, days: days })
  }

  return projectedWeeks
}

if (typeof module !== "undefined") {
  module.exports = {
    bucketFor: bucketFor,
    builtinFestivalRecords: builtinFestivalRecords,
    mergeFestivals: mergeFestivals,
    resolveSchedule: resolveSchedule,
    projectDay: projectDay,
    projectWeeks: projectWeeks
  }
}
