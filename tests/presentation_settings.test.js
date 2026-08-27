const assert = require('assert')
const Presentation = require('../subscriptions/PresentationSettings.js')

assert.strictEqual(Presentation.normalizeColorSetting(''), 'auto')
assert.strictEqual(Presentation.normalizeColorSetting(' AUTO '), 'auto')
assert.strictEqual(Presentation.normalizeColorSetting('#c62828'), '#C62828')
assert.strictEqual(Presentation.normalizeColorSetting('red'), 'auto')
assert.strictEqual(Presentation.isValidColorSetting('#123ABC'), true)
assert.strictEqual(Presentation.isValidColorSetting('#1234'), false)

assert.strictEqual(Presentation.resolveColor('auto', 'rest', false), '#C62828')
assert.strictEqual(Presentation.resolveColor('auto', 'rest', true), '#F87171')
assert.strictEqual(Presentation.resolveColor('#112233', 'work', false), '#112233')
assert.notStrictEqual(
  Presentation.resolveColor('auto', 'work', false),
  Presentation.resolveColor('auto', 'work', true)
)

assert.strictEqual(Presentation.isDarkRgb(0.05, 0.05, 0.05), true)
assert.strictEqual(Presentation.isDarkRgb(0.95, 0.95, 0.95), false)
assert.strictEqual(Presentation.contrastTextForRgb(0.05, 0.05, 0.05), '#FFFFFF')
assert.strictEqual(Presentation.contrastTextForRgb(0.95, 0.95, 0.95), '#111827')

console.log('presentation settings tests passed')
