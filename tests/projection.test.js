const assert = require('assert')
const Projection = require('../subscriptions/Projection.js')

const model = {
  computeLunarInfo(year, month, day) {
    if (year === 2026 && month === 2 && day === 17) {
      return { lunarYear: 2026, lunarMonth: 1, lunarDay: 1, isLeap: false, festivalKey: '1-1', isEve: false, solarTermIndex: null }
    }
    return { lunarYear: 2026, lunarMonth: 1, lunarDay: day, isLeap: false, festivalKey: null, isEve: false, solarTermIndex: null }
  },
  langConfig() {
    return {
      festivals: { '1-1': '春节' },
      eveName: '除夕',
      solarTerms: [],
      leapWord: '闰',
      monthNames: ['正'],
      monthWord: '月',
      dayNames: Array.from({ length: 30 }, (_, i) => `初${i + 1}`)
    }
  }
}

const cell = {
  key: '2026-02-17',
  year: 2026,
  month: 1,
  day: 17,
  weekday: 2,
  inMonth: true,
  weekend: false,
  today: false
}

const snapshot = {
  schemaVersion: 1,
  byDate: {
    '2026-02-17': {
      schedule: [
        { id: 'off', sourceId: 'official', kind: 'schedule', title: '春节', priority: 100, payload: { status: 'off' } }
      ],
      festivals: [
        { id: 'remote-spring', sourceId: 'remote', kind: 'festival', title: '春节活动', priority: 50, payload: { festivalId: 'cn.spring-festival' } }
      ],
      events: [
        { id: 'dinner', sourceId: 'personal', kind: 'event', title: '家庭聚餐', priority: 0, span: { mode: 'datetime', start: '2026-02-17T18:00:00+08:00', end: '2026-02-17T20:00:00+08:00' } }
      ]
    }
  }
}

const projected = Projection.projectDay(cell, snapshot, 'zh-Hans', true, model)
assert.strictEqual(projected.schedule.status, 'off')
assert.strictEqual(projected.presentation.badgeText, '休')
assert.strictEqual(projected.presentation.effectiveDayType, 'official-off')
assert.strictEqual(projected.presentation.caption, '春节')
assert.strictEqual(projected.events.length, 1)
assert.strictEqual(projected.presentation.eventDotCount, 1)
assert.strictEqual(projected.festivals.length, 1, 'canonical festival id deduplicates local and remote records')

const saturdayCell = { ...cell, key: '2026-02-14', day: 14, weekday: 6, weekend: true }
const saturdaySnapshot = {
  schemaVersion: 1,
  byDate: {
    '2026-02-14': {
      schedule: [{ id: 'work', kind: 'schedule', title: '春节补班', priority: 100, payload: { status: 'work' } }],
      festivals: [],
      events: []
    }
  }
}

const workSaturday = Projection.projectDay(saturdayCell, saturdaySnapshot, 'zh-Hans', true, model)
assert.strictEqual(workSaturday.presentation.effectiveDayType, 'makeup-work')
assert.strictEqual(workSaturday.presentation.badgeText, '班')

const overriddenSaturday = Projection.projectDay(
  saturdayCell,
  saturdaySnapshot,
  'zh-Hans',
  true,
  { saturdayIsRest: true },
  model
)
assert.strictEqual(overriddenSaturday.schedule.status, 'off')
assert.strictEqual(overriddenSaturday.schedule.weekendOverride, true)
assert.strictEqual(overriddenSaturday.schedule.overriddenSchedule.status, 'work')
assert.strictEqual(overriddenSaturday.presentation.effectiveDayType, 'weekend-off')
assert.strictEqual(overriddenSaturday.presentation.badgeText, '休')

const sunday = Projection.projectDay(
  { ...cell, key: '2026-02-15', day: 15, weekday: 0, weekend: true },
  { schemaVersion: 1, byDate: {} },
  'zh-Hans',
  true,
  { sundayIsRest: true },
  model
)
assert.strictEqual(sunday.schedule.status, 'off')
assert.strictEqual(sunday.schedule.title, '周日休息')
assert.strictEqual(sunday.presentation.badgeText, '休')

const conflict = Projection.resolveSchedule([
  { id: 'a', priority: 100, payload: { status: 'off' } },
  { id: 'b', priority: 100, payload: { status: 'work' } }
])
assert.strictEqual(conflict.status, 'conflict')
assert.strictEqual(conflict.badge, '!')

console.log('projection tests passed')
