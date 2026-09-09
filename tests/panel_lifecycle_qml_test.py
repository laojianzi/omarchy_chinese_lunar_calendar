#!/usr/bin/env python3
"""Run actual Panel.qml lifecycle methods in Qt's QML engine (headless).

Requires PySide6-Essentials (CI pins the version). This tests real read-only
QML properties and Qt.callLater; it is NOT a Hyprland/layer-shell desktop test.
"""
import os
import pathlib
import subprocess
import sys

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from PySide6.QtCore import QCoreApplication, QTimer, QUrl
from PySide6.QtQml import QQmlComponent, QQmlEngine

REPO = pathlib.Path(__file__).resolve().parents[1]
methods = subprocess.check_output(
    ['node', str(REPO / 'tests/panel_lifecycle.test.js'), '--emit-qml'],
    text=True, timeout=10,
)
qml = r'''
import QtQml
QtObject {
    id: root
    property bool done: false
    property string failure: ""
    property int cycles: 0
    property bool failCleanup: false
    property bool editingLife: false
    property bool showingOptions: false
    property bool showingDayDetails: false
    property bool showingSubscriptionSettings: false
    property var subscriptionStore: null
    property var barIdentity: root
    property QtObject bar: facade
    readonly property bool opened: controller.open
    // Bindings model downstream consumers of the logical state, not real windows.
    readonly property bool primaryInputEnabled: opened
    readonly property bool dismissInputEnabled: opened
    property QtObject controller: QtObject {
        property bool open: false
        property int hideCount: 0
        function show() { open = true }
        function hide() { hideCount++; open = false }
    }
    property QtObject facade: QtObject {
        property bool _suppressed: false
        readonly property bool centerHoverRevealSuppressed: _suppressed
        property bool throwOnCall: false
        property var calls: []
        function setCenterHoverRevealSuppressed(value) {
            if (throwOnCall) throw new Error("host setter failed")
            root.check(typeof value === "boolean", "setter must receive bool")
            _suppressed = value
            calls = calls.concat([value])
        }
        function switchPanelFrom(owner, direction) {
            root.check(owner === root.barIdentity && direction === 1, "handoff identity")
            root.close()
            return true
        }
    }
    property QtObject readonlyWithoutSetter: QtObject {
        readonly property bool centerHoverRevealSuppressed: true
    }
    property QtObject nonCallableSetter: QtObject {
        readonly property bool centerHoverRevealSuppressed: true
        property bool setCenterHoverRevealSuppressed: true
    }
    function refresh() {}
    function cancelEditingLife() {
        if (root.failCleanup) throw new Error("cleanup failed")
        root.editingLife = false
    }
    function closeOptions() { root.showingOptions = false }
    function closeDayDetails() { root.showingDayDetails = false }
    function closeSubscriptionSettings() { root.showingSubscriptionSettings = false }
    function check(value, message) { if (!value) throw new Error(message) }
    function attempt(fn) {
        try { fn() } catch (error) { root.failure = String(error); root.done = true }
    }

__METHODS__

    function synchronousTests() {
        // Red control: confirm the facade really rejects writes in Qt, not JS only.
        var rejected = false
        try { facade.centerHoverRevealSuppressed = true } catch (error) {
            rejected = String(error).indexOf("read-only") !== -1
        }
        check(rejected, "Qt must reject the direct readonly write")
        controller.show()
        facade.setCenterHoverRevealSuppressed(true)
        editingLife = true
        showingOptions = true
        showingDayDetails = true
        showingSubscriptionSettings = true
        close()
        check(!opened && !primaryInputEnabled && !dismissInputEnabled, "controller must release state")
        check(!facade.centerHoverRevealSuppressed, "false must reach the public setter")
        check(!editingLife && !showingOptions && !showingDayDetails && !showingSubscriptionSettings,
              "all overlays must reset")

        var optionalBars = [null, readonlyWithoutSetter, nonCallableSetter]
        for (var i = 0; i < optionalBars.length; i++) {
            bar = optionalBars[i]
            controller.show()
            close()
            check(!opened, "missing optional API must not block close")
        }
        check(readonlyWithoutSetter.centerHoverRevealSuppressed, "no legacy property mutation")
        bar = facade

        facade.throwOnCall = true
        controller.show()
        var setterError = false
        try { close() } catch (error) { setterError = String(error).indexOf("host setter failed") !== -1 }
        check(setterError && !opened, "finally must release state and propagate the host error")
        facade.throwOnCall = false
        editingLife = true
        failCleanup = true
        controller.show()
        var cleanupError = false
        try { close() } catch (error) { cleanupError = String(error).indexOf("cleanup failed") !== -1 }
        check(cleanupError && !opened, "finally must release state and propagate cleanup error")
        failCleanup = false
        editingLife = false
        close()

        open()
        Qt.callLater(function() { root.attempt(afterOpen) })
    }
    function afterOpen() {
        check(opened && facade.centerHoverRevealSuppressed, "real callLater after show")
        close()
        open()
        close()
        Qt.callLater(function() { root.attempt(afterEarlyClose) })
    }
    function afterEarlyClose() {
        check(!opened && !facade.centerHoverRevealSuppressed, "pending open must not undo close")
        open()
        close()
        open()
        Qt.callLater(function() { root.attempt(afterRapidReopen) })
    }
    function afterRapidReopen() {
        check(opened && facade.centerHoverRevealSuppressed, "rapid reopen final state")
        close()
        open()
        check(switchPanel(1), "panel switching delegates to host")
        Qt.callLater(function() { root.attempt(afterSwitch) })
    }
    function afterSwitch() {
        check(!opened && !facade.centerHoverRevealSuppressed, "old callback after handoff")
        nextCycle()
    }
    function nextCycle() {
        if (cycles === 20) { done = true; return }
        open()
        Qt.callLater(function() { root.attempt(function() {
            check(opened && facade.centerHoverRevealSuppressed, "cycle open")
            close()
            check(!opened && !facade.centerHoverRevealSuppressed, "cycle close")
            root.cycles++
            Qt.callLater(function() { root.attempt(nextCycle) })
        }) })
    }
    Component.onCompleted: attempt(synchronousTests)
}
'''.replace('__METHODS__', methods)

app = QCoreApplication([])
engine = QQmlEngine()
component = QQmlComponent(engine)
component.setData(qml.encode(), QUrl('file:///panel-lifecycle-contract.qml'))
if component.isError():
    raise SystemExit('\n'.join(error.toString() for error in component.errors()))
root = component.create()
if root is None:
    raise SystemExit('\n'.join(error.toString() for error in component.errors()))
poll = QTimer()
poll.setInterval(10)
poll.timeout.connect(lambda: app.quit() if root.property('done') else None)
poll.start()
QTimer.singleShot(5000, app.quit)
app.exec()
if not root.property('done'):
    raise SystemExit('FAIL: QML lifecycle test timed out')
if root.property('failure'):
    raise SystemExit('FAIL: ' + root.property('failure'))
print('PASS: actual Panel.qml methods, real Qt readonly facade and event loop; 20 cycles')
