const assert = require('assert')
const Native = require('../subscriptions/NativeSettings.js')

const config = {
  schemaVersion: 1,
  autoUpdate: false,
  refreshOnStartup: false,
  refreshOnOpen: true,
  checkIntervalMinutes: 30,
  sources: [{
    id: 'cn-official',
    name: 'Official',
    enabled: true,
    adapter: 'holiday-cn-json',
    urlTemplate: 'https://example.test/{year}.json',
    refreshHours: 72,
    priority: 100
  }]
}

const settings = Native.settingsFromConfig(config)
assert.strictEqual(settings.subscriptionAutoUpdate, false)
assert.strictEqual(settings.subscriptionRefreshOnStartup, false)
assert.strictEqual(settings.subscriptionCheckIntervalMinutes, 30)
assert.strictEqual(settings.subscriptionOfficialUrlTemplate, 'https://example.test/{year}.json')
assert.strictEqual(settings.subscriptionOfficialRefreshHours, 72)

const changed = Native.applyToConfig(config, {
  subscriptionAutoUpdate: true,
  subscriptionRefreshOnStartup: true,
  subscriptionRefreshOnOpen: false,
  subscriptionCheckIntervalMinutes: 90,
  subscriptionOfficialEnabled: false,
  subscriptionOfficialUrlTemplate: 'https://mirror.test/{year}.json',
  subscriptionOfficialRefreshHours: 12
})
assert.strictEqual(changed.autoUpdate, true)
assert.strictEqual(changed.refreshOnStartup, true)
assert.strictEqual(changed.refreshOnOpen, false)
assert.strictEqual(changed.checkIntervalMinutes, 90)
assert.strictEqual(changed.sources[0].enabled, false)
assert.strictEqual(changed.sources[0].urlTemplate, 'https://mirror.test/{year}.json')
assert.strictEqual(changed.sources[0].refreshHours, 12)

const empty = Native.applyToConfig({ schemaVersion: 1, sources: [] }, {
  subscriptionOfficialEnabled: true
})
assert.strictEqual(empty.sources.length, 1)
assert.strictEqual(empty.sources[0].id, 'cn-official')
assert.strictEqual(empty.sources[0].urlTemplate, Native.DEFAULT_HOLIDAY_URL)

const merged = Native.mergeIntoEntry({ language: 'zh-Hans' }, Native.settingsFromConfig(config), 'garyliu.lunar-calendar')
assert.strictEqual(merged.id, 'garyliu.lunar-calendar')
assert.strictEqual(merged.language, 'zh-Hans')
assert.strictEqual(merged.subscriptionAutoUpdate, false)
assert.strictEqual(Native.differs(merged, Native.settingsFromConfig(config)), false)

console.log('native settings tests passed')
