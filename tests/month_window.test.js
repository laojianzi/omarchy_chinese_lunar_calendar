const assert = require('assert')
const MonthWindow = require('../subscriptions/MonthWindow.js')

function day(overrides = {}) {
  return {
    inMonth: true,
    today: false,
    presentation: {
      monthScope: 'current-month',
      badgeText: '',
      badgeRole: '',
      eventDotCount: 0
    },
    ...overrides
  }
}

const current = MonthWindow.emphasisForDay(day())
assert.strictEqual(current.scope, 'current-month')
assert.strictEqual(current.adjacent, false)
assert.strictEqual(current.showBadge, false)
assert.strictEqual(current.showEvents, false)
assert.strictEqual(current.dateOpacity, 1)
assert.strictEqual(current.captionOpacity, 0.68)

const adjacentPlain = MonthWindow.emphasisForDay(day({
  inMonth: false,
  presentation: {
    monthScope: 'adjacent-month',
    badgeText: '',
    badgeRole: '',
    eventDotCount: 0
  }
}))
assert.strictEqual(adjacentPlain.adjacent, true)
assert.strictEqual(adjacentPlain.showBadge, false)
assert.strictEqual(adjacentPlain.dateOpacity, 0.52)
assert.strictEqual(adjacentPlain.captionOpacity, 0.46)

const adjacentSchedule = MonthWindow.emphasisForDay(day({
  inMonth: false,
  presentation: {
    monthScope: 'adjacent-month',
    badgeText: '班',
    badgeRole: 'work',
    eventDotCount: 0
  }
}))
assert.strictEqual(adjacentSchedule.showBadge, true)
assert.strictEqual(adjacentSchedule.dateOpacity, 0.82)
assert.strictEqual(adjacentSchedule.badgeOpacity, 0.88)

const adjacentEvents = MonthWindow.emphasisForDay(day({
  inMonth: false,
  presentation: {
    monthScope: 'adjacent-month',
    badgeText: '',
    badgeRole: '',
    eventDotCount: 2
  }
}))
assert.strictEqual(adjacentEvents.showEvents, true)
assert.strictEqual(adjacentEvents.eventOpacity, 0.72)

const adjacentConflict = MonthWindow.emphasisForDay(day({
  inMonth: false,
  presentation: {
    monthScope: 'adjacent-month',
    badgeText: '!',
    badgeRole: 'conflict',
    eventDotCount: 0
  }
}))
assert.strictEqual(adjacentConflict.dateOpacity, 0.96)
assert.strictEqual(adjacentConflict.badgeOpacity, 1)

const adjacentToday = MonthWindow.emphasisForDay(day({
  inMonth: false,
  today: true,
  presentation: {
    monthScope: 'adjacent-month',
    badgeText: '休',
    badgeRole: 'off',
    eventDotCount: 1
  }
}))
assert.strictEqual(adjacentToday.dateOpacity, 1)
assert.strictEqual(adjacentToday.badgeOpacity, 1)
assert.strictEqual(adjacentToday.eventOpacity, 0.9)

// Older snapshots without monthScope remain compatible.
assert.strictEqual(
  MonthWindow.scopeForDay({ inMonth: false, presentation: {} }),
  'adjacent-month'
)

console.log('month window tests passed')
