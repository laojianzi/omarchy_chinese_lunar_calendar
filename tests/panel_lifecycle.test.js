const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const repo = path.resolve(__dirname, '..')
const panelSource = fs.readFileSync(path.join(repo, 'Panel.qml'), 'utf8')
const barSource = fs.readFileSync(path.join(repo, 'BarWidget.qml'), 'utf8')

// Extract the actual root-level QML methods, not a duplicate implementation.
// Root methods have two-space indentation; nested blocks are further indented.
// A shape change fails loudly so a fixture cannot silently diverge from QML.
function method(source, name) {
  const matches = [...source.matchAll(new RegExp(
    '^  function ' + name + '\\([^\\n]*\\) \\{\\r?\\n[\\s\\S]*?^  \\}', 'gm'
  ))]
  assert.equal(matches.length, 1, `expected one root method: ${name}`)
  return matches[0][0]
}
const names = ['open', 'close', 'toggle', 'switchPanel', 'setCenterHoverRevealSuppressed']
const methods = names.map(name => method(panelSource, name)).join('\n')

function facade(withSetter = true) {
  const calls = []
  let suppressed = false
  const bar = { calls }
  Object.defineProperty(bar, 'centerHoverRevealSuppressed', {
    enumerable: true,
    get() { return suppressed }
  })
  if (withSetter) {
    bar.setCenterHoverRevealSuppressed = function (value) {
      assert.equal(this, bar, 'public method must retain its receiver')
      assert.equal(typeof value, 'boolean')
      suppressed = value
      calls.push(value)
    }
  }
  return bar
}

function harness(bar = facade()) {
  const queue = []
  const trace = []
  const root = {
    bar,
    barIdentity: { id: 'calendar-widget' },
    opened: false,
    editingLife: false,
    showingOptions: false,
    showingDayDetails: false,
    showingSubscriptionSettings: false,
    subscriptionStore: { refreshIfStale(reason) { trace.push('refresh:' + reason) } }
  }
  const cleanup = {
    cancelEditingLife: 'editingLife', closeOptions: 'showingOptions',
    closeDayDetails: 'showingDayDetails', closeSubscriptionSettings: 'showingSubscriptionSettings'
  }
  for (const [name, flag] of Object.entries(cleanup)) {
    root[name] = () => { trace.push(name); root[flag] = false }
  }
  root.controller = {
    show() { trace.push('show'); root.opened = true },
    hide() { trace.push('hide'); root.opened = false }
  }
  const context = vm.createContext({
    root,
    refresh() { trace.push('refresh') },
    Qt: { callLater(callback) { queue.push(callback) } }
  })
  vm.runInContext('"use strict";\n' + methods, context, { filename: 'Panel.qml methods' })
  for (const name of names) root[name] = context[name]
  return {
    root, trace, queue,
    flush() {
      let count = 0
      while (queue.length) {
        assert.ok(++count < 1000, 'unexpected delayed callback loop')
        queue.shift()()
      }
    }
  }
}

function run() {
  // The original failure mode is real in this strict harness, not a writable mock.
  const readonly = facade()
  assert.throws(() => vm.runInNewContext(
    '"use strict"; bar.centerHoverRevealSuppressed = false', { bar: readonly }
  ), /TypeError|read.only|only a getter/)

  const normal = harness(readonly)
  normal.root.open()
  assert.equal(normal.root.opened, true)
  assert.deepEqual(readonly.calls, [], 'hover suppression is deferred until after handoff')
  normal.flush()
  assert.equal(readonly.centerHoverRevealSuppressed, true)
  normal.root.close()
  assert.equal(normal.root.opened, false)
  assert.deepEqual(readonly.calls, [true, false])
  assert.equal(normal.trace.at(-1), 'hide')

  // Optional API absence is allowed, including read-only/writable legacy views.
  for (const bar of [null, undefined, {}, facade(false),
    { centerHoverRevealSuppressed: true },
    { setCenterHoverRevealSuppressed: true }]) {
    const test = harness()
    test.root.bar = bar
    test.root.open()
    test.flush()
    assert.doesNotThrow(() => test.root.close())
    assert.equal(test.root.opened, false)
    if (bar && Object.hasOwn(bar, 'centerHoverRevealSuppressed')
        && !Object.hasOwn(bar, 'setCenterHoverRevealSuppressed')) {
      assert.equal(bar.centerHoverRevealSuppressed, Object.getOwnPropertyDescriptor(
        bar, 'centerHoverRevealSuppressed').get ? false : true)
    }
  }

  const overlays = harness()
  for (const flag of ['editingLife', 'showingOptions', 'showingDayDetails', 'showingSubscriptionSettings'])
    overlays.root[flag] = true
  overlays.root.open()
  overlays.flush()
  overlays.root.close()
  assert.deepEqual(overlays.trace.slice(-5), [
    'cancelEditingLife', 'closeOptions', 'closeDayDetails', 'closeSubscriptionSettings', 'hide'
  ])
  for (const flag of ['editingLife', 'showingOptions', 'showingDayDetails', 'showingSubscriptionSettings'])
    assert.equal(overlays.root[flag], false)

  // A broken optional host method must not strand the input-owning controller.
  const broken = harness()
  const failure = new Error('host setter failed')
  broken.root.bar.setCenterHoverRevealSuppressed = () => { throw failure }
  broken.root.opened = true
  assert.throws(() => broken.root.close(), error => error === failure)
  assert.equal(broken.root.opened, false)
  assert.equal(broken.trace.at(-1), 'hide', 'finally must run without swallowing the error')

  for (const [methodName, flag] of Object.entries({
    cancelEditingLife: 'editingLife', closeOptions: 'showingOptions',
    closeDayDetails: 'showingDayDetails', closeSubscriptionSettings: 'showingSubscriptionSettings'
  })) {
    const test = harness()
    const error = new Error(methodName + ' failed')
    test.root.opened = true
    test.root[flag] = true
    test.root[methodName] = () => { throw error }
    assert.throws(() => test.root.close(), caught => caught === error)
    assert.equal(test.root.opened, false)
  }

  const early = harness()
  early.root.open()
  early.root.close()
  early.flush()
  assert.deepEqual(early.root.bar.calls, [false], 'closed panel must not re-suppress hover')

  const rapid = harness()
  rapid.root.open()
  rapid.root.close()
  rapid.root.open()
  rapid.flush()
  assert.equal(rapid.root.opened, true)
  assert.equal(rapid.root.bar.centerHoverRevealSuppressed, true)
  rapid.root.close()
  rapid.flush()
  assert.equal(rapid.root.bar.centerHoverRevealSuppressed, false)
  assert.doesNotThrow(() => rapid.root.close(), 'close is idempotent')
  for (let i = 0; i < 50; i++) {
    rapid.root.toggle()
    rapid.flush()
    assert.equal(rapid.root.opened, true)
    rapid.root.toggle()
    rapid.flush()
    assert.equal(rapid.root.opened, false)
    assert.equal(rapid.root.bar.centerHoverRevealSuppressed, false)
  }

  const switching = harness()
  switching.root.bar.switchPanelFrom = function (owner, direction) {
    assert.equal(owner, switching.root.barIdentity)
    assert.equal(direction, 1)
    switching.root.close()
    return true
  }
  switching.root.open()
  assert.equal(switching.root.switchPanel(1), true)
  switching.flush()
  assert.equal(switching.root.opened, false)
  assert.deepEqual(switching.root.bar.calls, [false], 'old delayed open cannot affect next popout')
  const noSwitch = harness(null)
  assert.equal(noSwitch.root.switchPanel(1), false)

  // Repeated-click and shell hide routes share Panel.close through the widget.
  const target = harness()
  const widgetContext = vm.createContext({ panelLoader: { item: target.root } })
  vm.runInContext(['open', 'close', 'togglePanel'].map(name => method(barSource, name)).join('\n'), widgetContext)
  widgetContext.open()
  target.flush()
  widgetContext.close()
  assert.equal(target.root.opened, false)
  widgetContext.togglePanel()
  widgetContext.togglePanel()
  target.flush()
  assert.equal(target.root.opened, false)
  widgetContext.panelLoader.item = null
  assert.doesNotThrow(() => widgetContext.close())
  assert.match(panelSource, /onCloseRequested: root\.close\(\)/, 'keyboard close remains wired')
  assert.doesNotMatch(panelSource, /\.centerHoverRevealSuppressed\s*=(?!=)/,
    'never write a bar facade property directly')
  console.log('panel lifecycle tests passed (actual QML method bodies)')
}

if (process.argv.includes('--emit-qml')) process.stdout.write(methods)
else run()
