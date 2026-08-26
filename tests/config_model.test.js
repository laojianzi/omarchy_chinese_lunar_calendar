const assert = require('assert')
const Config = require('../subscriptions/ConfigModel.js')

const migrated = Config.normalizeConfig({
  schemaVersion: 1,
  sources: [{
    id: 'official',
    name: 'Official',
    adapter: 'holiday-cn-json',
    urlTemplate: Config.DEFAULT_HOLIDAY_URL
  }]
})
assert.strictEqual(migrated.autoUpdate, true)
assert.strictEqual(migrated.refreshOnStartup, true)
assert.strictEqual(migrated.refreshOnOpen, true)
assert.strictEqual(migrated.checkIntervalMinutes, 60)
assert.strictEqual(migrated.sources[0].refreshHours, 24)

const withPreset = Config.defaultConfig()
const secondHoliday = Config.presetSource('cn-official', withPreset)
assert.strictEqual(secondHoliday.id, 'cn-official-2')
assert.strictEqual(Config.validateSource(secondHoliday, withPreset, ''), '')

const duplicate = Config.defaultHolidaySource()
assert.strictEqual(Config.validateSource(duplicate, withPreset, ''), 'duplicate-id')

const invalidTemplate = Config.setSourceAddress(Config.defaultHolidaySource(), 'https://example.com/holidays.json')
assert.strictEqual(Config.validateSource(invalidTemplate, { schemaVersion: 1, sources: [] }, ''), 'year-placeholder-required')

const missingHost = Config.defaultTypedSource()
missingHost.id = 'missing-host'
assert.strictEqual(Config.validateSource(missingHost, { schemaVersion: 1, sources: [] }, ''), 'invalid-address')

const typed = Config.defaultTypedSource()
typed.id = 'team'
typed.url = 'webcal://calendar.example.com/private?token=secret'
const normalizedTyped = Config.normalizeSource(typed, 0)
assert.strictEqual(normalizedTyped.url, 'https://calendar.example.com/private?token=secret')
assert(!Config.redactAddress('https://user:token@example.com/private?secret=1').includes('token'))
assert(!Config.redactAddress('https://user:token@example.com/private?secret=1').includes('secret'))

let edited = Config.upsertSource(withPreset, normalizedTyped, '')
assert.strictEqual(edited.sources.length, 2)
edited = Config.setSourceEnabled(edited, 'team', false)
assert.strictEqual(edited.sources[1].enabled, false)
edited = Config.removeSource(edited, 'team')
assert.strictEqual(edited.sources.length, 1)

console.log('config model tests passed')
