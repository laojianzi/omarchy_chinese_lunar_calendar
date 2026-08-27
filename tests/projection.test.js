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

const weekdayCell = {
  key: '2026-02-17',
  year: 2026,
  month: 1,
  day: 17,
  weekday: 2,
  inMonth: true,
  weekend: false,
  today: false
}

const holidaySnapshot = {
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

// Old call shape remains supported: the model can still occupy the options slot.
const holiday = Projection.projectDay(weekdayCell, holidaySnapshot, 'zh-Hans', true, model)
assert.strictEqual(holiday.basePolicy.isRest, false)
assert.strictEqual(holiday.schedule.status, 'off')
assert.strictEqual(holiday.presentation.badgeText, '休')
assert.strictEqual(holiday.presentation.scheduleTransition, 'work-to-rest')
assert.strictEqual(holiday.presentation.changesBase, true)
assert.strictEqual(holiday.presentation.effectiveDayType, 'official-off')
assert.strictEqual(holiday.presentation.caption, '春节')
assert.strictEqual(holiday.events.length, 1)
assert.strictEqual(holiday.presentation.eventDotCount, 1)
assert.strictEqual(holiday.festivals.length, 1, 'canonical festival id deduplicates local and remote records')

const saturdayCell = { ...weekdayCell, key: '2026-02-14', day: 14, weekday: 6, weekend: true }
const workSnapshot = {
  schemaVersion: 1,
  byDate: {
    '2026-02-14': {
      schedule: [
        { id: 'work', sourceId: 'official', kind: 'schedule', title: '春节补班', priority: 100, payload: { status: 'work' } }
      ],
      festivals: [],
      events: []
    }
  }
}

// Base weekly rest is visible when there is no date-specific schedule.
const regularSaturdayRest = Projection.projectDay(
  saturdayCell,
  { schemaVersion: 1, byDate: {} },
  'zh-Hans',
  true,
  { saturdayIsRest: true, sundayIsRest: true },
  model
)
assert.strictEqual(regularSaturdayRest.basePolicy.isRest, true)
assert.strictEqual(regularSaturdayRest.schedule, null)
assert.strictEqual(regularSaturdayRest.presentation.badgeText, '休')
assert.strictEqual(regularSaturdayRest.presentation.badgeRole, 'off')
assert.strictEqual(regularSaturdayRest.presentation.scheduleOrigin, 'base-week')
assert.strictEqual(regularSaturdayRest.presentation.scheduleTransition, 'base-rest')
assert.strictEqual(regularSaturdayRest.presentation.effectiveDayType, 'regular-rest')

// A date-specific 班 record has higher precedence and turns base rest into work.
const makeupSaturday = Projection.projectDay(
  saturdayCell,
  workSnapshot,
  'zh-Hans',
  true,
  { saturdayIsRest: true, sundayIsRest: true },
  model
)
assert.strictEqual(makeupSaturday.basePolicy.isRest, true)
assert.strictEqual(makeupSaturday.schedule.status, 'work')
assert.strictEqual(makeupSaturday.presentation.badgeText, '班')
assert.strictEqual(makeupSaturday.presentation.scheduleOrigin, 'subscription')
assert.strictEqual(makeupSaturday.presentation.scheduleTransition, 'rest-to-work')
assert.strictEqual(makeupSaturday.presentation.changesBase, true)
assert.strictEqual(makeupSaturday.presentation.effectiveDayType, 'makeup-work')

// A subscribed 休 record also wins, but agrees with the base rest state.
const subscribedSaturdayRest = Projection.projectDay(
  saturdayCell,
  {
    schemaVersion: 1,
    byDate: {
      '2026-02-14': {
        schedule: [
          { id: 'off', sourceId: 'official', kind: 'schedule', title: '春节', priority: 100, payload: { status: 'off' } }
        ],
        festivals: [],
        events: []
      }
    }
  },
  'zh-Hans',
  true,
  { saturdayIsRest: true },
  model
)
assert.strictEqual(subscribedSaturdayRest.schedule.status, 'off')
assert.strictEqual(subscribedSaturdayRest.presentation.scheduleTransition, 'rest-to-rest')
assert.strictEqual(subscribedSaturdayRest.presentation.effectiveDayType, 'scheduled-rest')
assert.strictEqual(subscribedSaturdayRest.presentation.badgeText, '休')

// Disabling the base Saturday rule makes an empty Saturday an ordinary workday.
const configuredWorkSaturday = Projection.projectDay(
  saturdayCell,
  { schemaVersion: 1, byDate: {} },
  'zh-Hans',
  true,
  { saturdayIsRest: false, sundayIsRest: true },
  model
)
assert.strictEqual(configuredWorkSaturday.basePolicy.isRest, false)
assert.strictEqual(configuredWorkSaturday.presentation.badgeText, '')
assert.strictEqual(configuredWorkSaturday.presentation.scheduleTransition, 'base-work')
assert.strictEqual(configuredWorkSaturday.presentation.effectiveDayType, 'weekday')

// Explicit work on a base workday is retained as a schedule record but is not
// misclassified as make-up work because no rest state was cancelled.
const scheduledWorkSaturday = Projection.projectDay(
  saturdayCell,
  workSnapshot,
  'zh-Hans',
  true,
  { saturdayIsRest: false },
  model
)
assert.strictEqual(scheduledWorkSaturday.presentation.badgeText, '班')
assert.strictEqual(scheduledWorkSaturday.presentation.scheduleTransition, 'work-to-work')
assert.strictEqual(scheduledWorkSaturday.presentation.changesBase, false)
assert.strictEqual(scheduledWorkSaturday.presentation.effectiveDayType, 'scheduled-work')

// Missing options use the product defaults: Saturday and Sunday are base rest.
assert.strictEqual(Projection.baseWeekPolicy(saturdayCell, {}, 'zh-Hans').isRest, true)
assert.strictEqual(
  Projection.baseWeekPolicy({ ...saturdayCell, weekday: 0 }, {}, 'zh-Hans').isRest,
  true
)

const conflict = Projection.resolveSchedule([
  { id: 'a', priority: 100, payload: { status: 'off' } },
  { id: 'b', priority: 100, payload: { status: 'work' } }
])
assert.strictEqual(conflict.status, 'conflict')
assert.strictEqual(conflict.badge, '!')

const conflictedSaturday = Projection.projectDay(
  saturdayCell,
  {
    schemaVersion: 1,
    byDate: {
      '2026-02-14': {
        schedule: [
          { id: 'a', priority: 100, payload: { status: 'off' } },
          { id: 'b', priority: 100, payload: { status: 'work' } }
        ],
        festivals: [],
        events: []
      }
    }
  },
  'zh-Hans',
  true,
  { saturdayIsRest: true },
  model
)
assert.strictEqual(conflictedSaturday.presentation.badgeText, '!')
assert.strictEqual(conflictedSaturday.presentation.scheduleTransition, 'conflict')
assert.strictEqual(conflictedSaturday.presentation.effectiveDayType, 'schedule-conflict')

// Leading/trailing dates are part of the visible 42-day window. Projection must
// preserve all semantic layers even when the date belongs to an adjacent month.
const trailingSeptemberSaturday = {
  ...saturdayCell,
  key: '2026-09-05',
  year: 2026,
  month: 8,
  day: 5,
  inMonth: false
}
const adjacentSnapshot = {
  schemaVersion: 1,
  byDate: {
    '2026-09-05': {
      schedule: [
        { id: 'september-work', sourceId: 'official', kind: 'schedule', title: '调休补班', priority: 100, payload: { status: 'work' } }
      ],
      festivals: [
        { id: 'adjacent-festival', sourceId: 'remote', kind: 'festival', title: '纪念日', priority: 20, payload: { festivalId: 'custom.adjacent' } }
      ],
      events: [
        { id: 'adjacent-event', sourceId: 'personal', kind: 'event', title: '跨月事件', priority: 0, span: { mode: 'date', start: '2026-09-05', endExclusive: '2026-09-06' } }
      ]
    }
  }
}
const adjacentProjected = Projection.projectDay(
  trailingSeptemberSaturday,
  adjacentSnapshot,
  'zh-Hans',
  true,
  { saturdayIsRest: true, sundayIsRest: true },
  model
)
assert.strictEqual(adjacentProjected.presentation.monthScope, 'adjacent-month')
assert.strictEqual(adjacentProjected.presentation.isAdjacentMonth, true)
assert.strictEqual(adjacentProjected.schedule.status, 'work')
assert.strictEqual(adjacentProjected.presentation.badgeText, '班')
assert.strictEqual(adjacentProjected.presentation.scheduleTransition, 'rest-to-work')
assert.strictEqual(adjacentProjected.events.length, 1)
assert.strictEqual(adjacentProjected.presentation.eventDotCount, 1)
assert.strictEqual(adjacentProjected.festivals[0].title, '纪念日')

// An adjacent-month weekend without a subscribed override still keeps the base
// weekly rest badge instead of becoming visually empty.
const adjacentBaseRest = Projection.projectDay(
  { ...trailingSeptemberSaturday, key: '2026-09-06', day: 6, weekday: 0 },
  { schemaVersion: 1, byDate: {} },
  'zh-Hans',
  true,
  { saturdayIsRest: true, sundayIsRest: true },
  model
)
assert.strictEqual(adjacentBaseRest.presentation.monthScope, 'adjacent-month')
assert.strictEqual(adjacentBaseRest.presentation.badgeText, '休')
assert.strictEqual(adjacentBaseRest.presentation.scheduleOrigin, 'base-week')

// Cross-year cells use the same date-key lookup and must not lose subscribed
// state at the December/January boundary.
const januaryCrossYear = Projection.projectDay(
  {
    ...weekdayCell,
    key: '2027-01-01',
    year: 2027,
    month: 0,
    day: 1,
    weekday: 5,
    inMonth: false
  },
  {
    schemaVersion: 1,
    byDate: {
      '2027-01-01': {
        schedule: [
          { id: 'new-year-off', sourceId: 'official', kind: 'schedule', title: '元旦', priority: 100, payload: { status: 'off' } }
        ],
        festivals: [],
        events: []
      }
    }
  },
  'zh-Hans',
  true,
  { saturdayIsRest: true, sundayIsRest: true },
  model
)
assert.strictEqual(januaryCrossYear.presentation.monthScope, 'adjacent-month')
assert.strictEqual(januaryCrossYear.presentation.badgeText, '休')
assert.strictEqual(januaryCrossYear.presentation.effectiveDayType, 'official-off')

console.log('projection tests passed')
