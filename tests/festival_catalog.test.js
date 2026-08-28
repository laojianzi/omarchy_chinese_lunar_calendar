const assert = require('assert')
const FestivalCatalog = require('../subscriptions/FestivalCatalog.js')

function cell(year, month, day, key) {
  return { year, month: month - 1, day, key: key || `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}

function lunar(overrides = {}) {
  return {
    festivalKey: null,
    isEve: false,
    solarTermIndex: null,
    ...overrides
  }
}

const newYear = FestivalCatalog.recordsForDate(cell(2026, 1, 1), lunar(), 'zh-Hans')
assert.strictEqual(newYear.length, 1)
assert.strictEqual(FestivalCatalog.festivalId(newYear[0]), 'cn.new-years-day')
assert.strictEqual(newYear[0].title, '元旦')
assert.strictEqual(newYear[0].payload.calendar, 'gregorian')
assert.strictEqual(newYear[0].payload.statutory, true)

const labor = FestivalCatalog.recordsForDate(cell(2026, 5, 1), lunar(), 'zh-Hant')
assert.strictEqual(labor[0].title, '勞動節')
assert.strictEqual(FestivalCatalog.festivalId(labor[0]), 'cn.labor-day')

const national = FestivalCatalog.recordsForDate(cell(2026, 10, 1), lunar(), 'en')
assert.strictEqual(national[0].title, 'National Day')
assert.strictEqual(FestivalCatalog.festivalId(national[0]), 'cn.national-day')
assert.strictEqual(FestivalCatalog.recordsForDate(cell(2026, 10, 2), lunar(), 'zh-Hans').length, 0)

const qingming = FestivalCatalog.recordsForDate(cell(2026, 4, 5), lunar({ solarTermIndex: 6 }), 'zh-Hans')
assert.strictEqual(qingming[0].title, '清明节')
assert.strictEqual(qingming[0].payload.calendar, 'solar-term')
assert.strictEqual(FestivalCatalog.festivalId(qingming[0]), 'cn.qingming-festival')

const spring = FestivalCatalog.recordsForDate(cell(2026, 2, 17), lunar({ festivalKey: '1-1' }), 'zh-Hans')
assert.strictEqual(spring[0].title, '春节')
assert.strictEqual(FestivalCatalog.festivalId(spring[0]), 'cn.spring-festival')

const eve = FestivalCatalog.recordsForDate(cell(2026, 2, 16), lunar({ isEve: true }), 'zh-Hans')
assert.strictEqual(eve[0].title, '除夕')
assert.strictEqual(FestivalCatalog.festivalId(eve[0]), 'cn.new-years-eve')

const remoteNational = {
  id: 'remote-national',
  sourceId: 'company',
  kind: 'festival',
  title: '中华人民共和国国庆纪念日',
  priority: 200,
  payload: { festivalId: 'cn.national-day', calendar: 'gregorian' }
}
const merged = FestivalCatalog.mergeRecords(national, [remoteNational])
assert.strictEqual(merged.length, 1)
assert.strictEqual(merged[0].title, '中华人民共和国国庆纪念日')
assert.strictEqual(merged[0].mergedCount, 2)
assert.strictEqual(merged[0].payload.statutory, true)
assert.strictEqual(merged[0].payload.hasBuiltin, true)
assert.deepStrictEqual(merged[0].sourceIds.sort(), ['builtin-festival-catalog', 'company'])
assert.ok(FestivalCatalog.metadataLine(merged[0], 'zh-Hans').includes('法定节日'))
assert.ok(FestivalCatalog.metadataLine(merged[0], 'zh-Hans').includes('公历'))
assert.ok(FestivalCatalog.metadataLine(merged[0], 'zh-Hans').includes('company'))

const officialSchedule = {
  title: '国庆节假期',
  candidates: [{ payload: { scope: 'official' } }]
}
assert.strictEqual(FestivalCatalog.canonicalHolidayIdForSchedule(officialSchedule), 'cn.national-day')
assert.strictEqual(
  FestivalCatalog.canonicalHolidayIdForSchedule({ title: '国庆节', candidates: [{ payload: { scope: 'personal' } }] }),
  ''
)
assert.strictEqual(FestivalCatalog.titleForId('cn.new-year', 'zh-Hans'), '元旦')

console.log('festival catalog tests passed')
