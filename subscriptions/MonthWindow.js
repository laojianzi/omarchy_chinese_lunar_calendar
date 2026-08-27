// Presentation policy for the fixed 6x7 month viewport.
//
// Every visible cell is a real civil date. `inMonth` changes visual emphasis
// only; it must never suppress schedule badges, festival captions, event dots,
// or interaction for leading/trailing dates from adjacent months.

var CURRENT_MONTH = "current-month"
var ADJACENT_MONTH = "adjacent-month"

function presentation(day) {
  return day && day.presentation && typeof day.presentation === "object"
    ? day.presentation
    : {}
}

function scopeForDay(day) {
  var info = presentation(day)
  if (info.monthScope === CURRENT_MONTH || info.monthScope === ADJACENT_MONTH)
    return info.monthScope
  return day && day.inMonth === false ? ADJACENT_MONTH : CURRENT_MONTH
}

function badgeText(day) {
  return String(presentation(day).badgeText || "")
}

function badgeRole(day) {
  return String(presentation(day).badgeRole || "")
}

function eventCount(day) {
  var value = Number(presentation(day).eventDotCount || 0)
  return isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function emphasisForDay(day) {
  var scope = scopeForDay(day)
  var adjacent = scope === ADJACENT_MONTH
  var today = !!(day && day.today)
  var badge = badgeText(day)
  var role = badgeRole(day)
  var events = eventCount(day)
  var full = !adjacent || today
  var highAttention = role === "conflict"

  return {
    scope: scope,
    adjacent: adjacent,
    showBadge: badge !== "",
    showEvents: events > 0,
    dateOpacity: full ? 1.0 : (highAttention ? 0.96 : (badge !== "" ? 0.82 : 0.52)),
    captionOpacity: full ? 0.68 : 0.46,
    badgeOpacity: full ? 1.0 : (highAttention ? 1.0 : 0.88),
    eventOpacity: full ? 0.90 : 0.72
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    CURRENT_MONTH: CURRENT_MONTH,
    ADJACENT_MONTH: ADJACENT_MONTH,
    scopeForDay: scopeForDay,
    emphasisForDay: emphasisForDay
  }
}
