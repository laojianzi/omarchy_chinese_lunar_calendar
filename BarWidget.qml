import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model
import "subscriptions" as Subscriptions
import "subscriptions/NativeSettings.js" as NativeSettings

// Date/time label for the bar, and the host for the lunar calendar popup.
//
// Left click reveals the calendar, right click walks the common label
// formats, and middle click opens the timezone picker — same behavior as
// the built-in Clock widget this one is based on.
BarWidget {
  id: root
  moduleName: "garyliu.lunar-calendar"

  property date displayDate: clock.date

  Subscriptions.SubscriptionStore {
    id: subscriptionStore
  }

  property bool nativeSettingsReady: false
  property bool syncingNativeSettings: false

  function syncNativeSettingsFromStore() {
    if (!subscriptionStore.configLoaded) return
    var values = NativeSettings.settingsFromConfig(subscriptionStore.config)
    root.nativeSettingsReady = true
    if (!NativeSettings.differs(root.settings, values)) return

    root.syncingNativeSettings = true
    var entry = NativeSettings.mergeIntoEntry(root.settings, values, root.moduleName)
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
    root.syncingNativeSettings = false
  }

  function applyNativeSettingsToStore() {
    if (!root.nativeSettingsReady || root.syncingNativeSettings || !subscriptionStore.configLoaded) return
    if (subscriptionStore.busy) {
      nativeSettingsApplyTimer.restart()
      return
    }
    subscriptionStore.applyWidgetSettings(root.settings)
  }

  // Read from the same shell.json entry the Panel writes language to, so
  // the bar label follows the Options panel's language choice rather than
  // the system locale.
  readonly property string language: Model.normalizedLanguage(setting("language", null), Model.defaultLanguage(Qt.locale().name))

  readonly property string configuredFormat: vertical
    ? setting("verticalFormat", "HH\n—\nmm")
    : setting("format", "dddd HH:mm")
  readonly property string configuredAltFormat: vertical
    ? setting("verticalFormatAlt", "dd\nMMM\n'W'ww\n''yy")
    : setting("formatAlt", "d MMMM 'W'ww yyyy")

  readonly property var formatRing: Model.clockFormatRing(configuredFormat, configuredAltFormat, Model.clockFormats(vertical))

  // What the bar shows is what shell.json stores, so a cycled format is the
  // format from then on rather than something that reverts on restart.
  readonly property string activeFormat: configuredFormat
  readonly property string displayText: formatted(displayDate)
  readonly property var verticalLines: displayText.split("\n")

  function refresh() {
    displayDate = new Date()
    subscriptionStore.refreshIfStale("manual")
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  function cycleFormat() {
    var current = String(configuredFormat)
    var next = Model.nextClockFormat(formatRing, current)
    if (next === "" || next === current) return

    var entry = { id: root.moduleName }
    for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key]
    entry[vertical ? "verticalFormat" : "format"] = next

    // Applied locally first so the label changes on the click itself; the
    // shell.json write comes back through the bar as the same value.
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function formatted(date) {
    var fmt = activeFormat.replace(/ww/g, Model.isoWeekLiteral(date.getFullYear(), date.getMonth(), date.getDate()))
    fmt = Model.localizeWeekdayToken(fmt, root.language)
    return Qt.formatDateTime(date, fmt)
  }

  // ---- Calendar popup. Shape contract for shell.summon/hide/toggle
  //      routing: Bar.findPanelWidget requires open/close/opened on the
  //      bar-widget root.
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function toggleWeekStart() {
    if (panelLoader.item) panelLoader.item.toggleWeekStart()
  }

  function openSubscriptionSettings() {
    if (!panelLoader.item) return
    panelLoader.item.open()
    panelLoader.item.openSubscriptionSettings()
  }

  readonly property real openPanelIndicatorWidth: button.labelWidth
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("subscriptionStore" in target) target.subscriptionStore = subscriptionStore
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: {
    injectPanel()
    if (root.nativeSettingsReady && !root.syncingNativeSettings)
      nativeSettingsApplyTimer.restart()
  }

  Connections {
    target: subscriptionStore

    function onConfigLoadedChanged() {
      if (subscriptionStore.configLoaded) root.syncNativeSettingsFromStore()
    }

    function onConfigRevisionChanged() {
      root.syncNativeSettingsFromStore()
    }

    function onBusyChanged() {
      if (!subscriptionStore.busy && nativeSettingsApplyTimer.running)
        nativeSettingsApplyTimer.restart()
    }
  }

  Timer {
    id: nativeSettingsApplyTimer
    interval: 120
    repeat: false
    onTriggered: root.applyNativeSettingsToStore()
  }

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: root.displayDate = date
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "garyliu.lunar-calendar"

    function refresh(): void { root.broadcast("refresh") }
    function cycleFormat(): void { root.cycleFormat() }
    function toggleWeekStart(): void { root.toggleWeekStart() }
    function subscriptions(): void { root.openSubscriptionSettings() }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.vertical ? "" : root.displayText
    labelVisible: !root.vertical
    hasVisualContent: root.vertical ? root.verticalLines.length > 0 : text !== ""
    fixedHeight: root.vertical ? root.verticalLines.length * Style.bar.iconSlot : -1
    horizontalMargin: 8.75
    verticalPadding: 8.75

    onPressed: function(b) {
      if (b === Qt.RightButton) root.cycleFormat()
      else if (b === Qt.MiddleButton) { if (root.bar) root.bar.run("omarchy-menu-timezone") }
      else root.togglePanel()
    }

    Column {
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.verticalLines

        OpticalGlyph {
          required property string modelData
          width: button.width
          height: Style.bar.iconSlot
          text: modelData
          fontFamily: button.fontFamily
          fontSize: modelData.length > 3
            ? button.fontSize * 0.9
            : button.fontSize
          color: button.foreground
        }
      }
    }
  }
}
