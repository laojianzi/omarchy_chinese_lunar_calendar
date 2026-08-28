import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model
import "subscriptions/Projection.js" as Projection
import "subscriptions/FestivalCatalog.js" as FestivalCatalog
import "subscriptions/PresentationSettings.js" as PresentationSettings
import "components" as Components

// The lunar calendar's popup: a month grid with ISO week numbers, a lunar
// date + jieqi readout under the hero date, and small wrappable lunar/jieqi
// captions under each grid day — otherwise the same hero-over-detail
// composition, month navigation, week-start toggle, and memento-mori life
// bar as the built-in Clock panel this one is based on.
//
// An Options overlay (gear button, top-right of the hero) lets the language
// (Simplified/Traditional Chinese or English), the week-start day, and the
// jieqi caption each be toggled independently.
Panel {
  id: root
  moduleName: "garyliu.lunar-calendar"
  ipcTarget: "garyliu.lunar-calendar"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var subscriptionStore: null
  readonly property var barIdentity: hostWidget || root

  // ---- Today.
  property date today: new Date()
  readonly property string todayKey: Model.keyForDate(today)

  property int viewYear: today.getFullYear()
  property int viewMonth: today.getMonth()

  readonly property date viewDate: new Date(viewYear, viewMonth, 1)
  readonly property bool viewingCurrentMonth: viewYear === today.getFullYear() && viewMonth === today.getMonth()

  readonly property real yearDone: Model.yearProgress(today.getFullYear(), today.getMonth(), today.getDate())
  readonly property int yearDonePercent: Model.yearProgressPercent(today.getFullYear(), today.getMonth(), today.getDate())

  readonly property int birthYear: Model.parseBirthYear(setting("birthYear", 0), today.getFullYear())
  readonly property int age: Model.ageFromBirthYear(birthYear, today.getFullYear())
  readonly property int lifeExpectancy: Model.parseLifeExpectancy(setting("lifeExpectancy", 0))
  readonly property real lifeDone: Model.lifeProgress(age, lifeExpectancy)
  readonly property int lifeDonePercent: Model.lifeProgressPercent(age, lifeExpectancy)
  property bool editingLife: false

  readonly property int weekStart: Model.normalizedWeekStart(setting("weekStartDay", null), Qt.locale().firstDayOfWeek)
  readonly property string nextWeekStartLabel: Qt.locale().dayName(Model.toggledWeekStart(weekStart), Locale.LongFormat)
  readonly property var weekdays: Model.weekdayOrder(weekStart)

  // ---- Lunar calendar options.
  readonly property string language: Model.normalizedLanguage(setting("language", null), Model.defaultLanguage(Qt.locale().name))
  readonly property bool showJieqi: setting("showJieqi", true) !== false
  readonly property bool showSubscriptions: setting("showSubscriptions", true) !== false
  readonly property bool saturdayIsRest: setting("saturdayIsRest", true) !== false
  readonly property bool sundayIsRest: setting("sundayIsRest", true) !== false
  readonly property string restBadgeColorSetting: PresentationSettings.normalizeColorSetting(setting("restBadgeColor", "auto"))
  readonly property string workBadgeColorSetting: PresentationSettings.normalizeColorSetting(setting("workBadgeColor", "auto"))
  readonly property bool darkPopupTheme: PresentationSettings.isDarkRgb(
    Color.popups.background.r,
    Color.popups.background.g,
    Color.popups.background.b
  )
  readonly property color restBadgeFill: PresentationSettings.resolveColor(root.restBadgeColorSetting, "rest", root.darkPopupTheme)
  readonly property color workBadgeFill: PresentationSettings.resolveColor(root.workBadgeColorSetting, "work", root.darkPopupTheme)
  readonly property color conflictBadgeFill: PresentationSettings.resolveColor("auto", "conflict", root.darkPopupTheme)
  readonly property var langCfg: Model.langConfig(root.language)
  property bool showingOptions: false
  property bool showingDayDetails: false
  property bool showingSubscriptionSettings: false
  property string selectedDayKey: ""
  property var selectedDay: null
  property string badgeColorError: ""

  // The store replaces the entire snapshot object after an atomic file update,
  // so this binding re-projects the month without exposing transport concerns
  // to individual day delegates.
  readonly property var subscriptionSnapshot: showSubscriptions && subscriptionStore
    ? subscriptionStore.snapshot
    : ({ schemaVersion: 1, byDate: {} })
  readonly property var weeks: Projection.projectWeeks(
      Model.monthGrid(viewYear, viewMonth, weekStart, todayKey),
      root.subscriptionSnapshot,
      root.language,
      root.showJieqi,
      ({
        saturdayIsRest: root.saturdayIsRest,
        sundayIsRest: root.sundayIsRest
      }),
      Model,
      FestivalCatalog
    )

  onWeeksChanged: {
    if (!root.showingDayDetails || !root.selectedDayKey) return
    var refreshed = root.findProjectedDay(root.selectedDayKey)
    if (refreshed) root.selectedDay = refreshed
  }

  readonly property var todayLunarInfo: Model.computeLunarInfo(today.getFullYear(), today.getMonth() + 1, today.getDate())
  readonly property string lunarHeroText: Model.lunarHeroLabel(todayLunarInfo, root.language)
  readonly property string jieqiHeroText: root.showJieqi ? Model.jieqiLabel(todayLunarInfo, root.language) : ""

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  // Wide enough, and tall enough for a two-line wrapped caption, that long
  // English labels ("Awakening of Insects") wrap inside their own cell
  // instead of overlapping the neighboring day.
  readonly property int cellWidth: Style.space(64)
  readonly property int cellHeight: Style.space(60)
  readonly property int cellSpacing: Style.space(2)
  readonly property int weekColumnWidth: Style.space(32)
  readonly property int gutterWidth: Style.space(14)

  function open() {
    refresh()
    if (root.subscriptionStore) root.subscriptionStore.refreshIfStale("open")
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    if (root.editingLife) root.cancelEditingLife()
    if (root.showingOptions) root.closeOptions()
    if (root.showingDayDetails) root.closeDayDetails()
    if (root.showingSubscriptionSettings) root.closeSubscriptionSettings()
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function refresh() {
    root.today = new Date()
    root.goToToday()
  }

  function goToToday() {
    root.viewYear = today.getFullYear()
    root.viewMonth = today.getMonth()
  }

  function moveMonth(delta) {
    var next = Model.stepMonth(viewYear, viewMonth, delta)
    root.viewYear = next.year
    root.viewMonth = next.month
  }

  function moveYear(delta) {
    moveMonth(delta * 12)
  }

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]

    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function setWeekStart(day) {
    var next = Model.normalizedWeekStart(day, root.weekStart)
    if (next === root.weekStart) return
    persistSettings({ weekStartDay: Model.weekStartSettingName(next) })
  }

  function startEditingLife() {
    root.editingLife = true
    Qt.callLater(function() {
      bornField.text = root.birthYear > 0 ? String(root.birthYear) : ""
      expectancyField.text = String(root.lifeExpectancy)
      bornField.selectAll()
      bornField.forceActiveFocus()
    })
  }

  function cancelEditingLife() {
    root.editingLife = false
    Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() })
  }

  function handleLifeKey(event, other) {
    if (event.key === Qt.Key_Escape) {
      root.cancelEditingLife()
      event.accepted = true
    } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      root.commitLife()
      event.accepted = true
    } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
      other.selectAll()
      other.forceActiveFocus()
      event.accepted = true
    }
  }

  function clearLife() {
    if (root.birthYear <= 0) return
    persistSettings({ birthYear: 0 })
  }

  function commitLife() {
    var born = Model.parseBirthYear(bornField.text, today.getFullYear())
    var span = Model.parseLifeExpectancy(expectancyField.text)
    if (born !== root.birthYear || span !== root.lifeExpectancy)
      persistSettings({ birthYear: born, lifeExpectancy: span })
    cancelEditingLife()
  }

  function toggleWeekStart() {
    setWeekStart(Model.toggledWeekStart(root.weekStart))
  }

  // ---- Options overlay.
  function openOptions() {
    root.showingOptions = true
    root.badgeColorError = ""
    Qt.callLater(function() {
      if (restBadgeColorField) restBadgeColorField.text = root.restBadgeColorSetting
      if (workBadgeColorField) workBadgeColorField.text = root.workBadgeColorSetting
      if (optionsFocus) optionsFocus.forceActiveFocus()
    })
  }

  function closeOptions() {
    root.showingOptions = false
    Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() })
  }

  function setLanguage(value) {
    var next = Model.normalizedLanguage(value, root.language)
    if (next === root.language) return
    persistSettings({ language: next })
  }

  function setShowJieqi(value) {
    persistSettings({ showJieqi: !!value })
  }

  function setShowSubscriptions(value) {
    persistSettings({ showSubscriptions: !!value })
  }

  function setSaturdayIsRest(value) {
    persistSettings({ saturdayIsRest: !!value })
  }

  function setSundayIsRest(value) {
    persistSettings({ sundayIsRest: !!value })
  }

  function badgeColorSetting(key) {
    return key === "restBadgeColor" ? root.restBadgeColorSetting : root.workBadgeColorSetting
  }

  function commitBadgeColor(key, field) {
    var value = String(field ? field.text : "").trim()
    if (!PresentationSettings.isValidColorSetting(value)) {
      root.badgeColorError = root.language === "en"
        ? "Use auto or a #RRGGBB color."
        : (root.language === "zh-Hant" ? "請輸入 auto 或 #RRGGBB 色彩。" : "请输入 auto 或 #RRGGBB 颜色。")
      if (field) field.text = root.badgeColorSetting(key)
      return
    }
    var normalized = PresentationSettings.normalizeColorSetting(value)
    var next = ({})
    next[key] = normalized
    root.persistSettings(next)
    root.badgeColorError = ""
    if (field) field.text = normalized
  }

  function resetBadgeColors() {
    root.persistSettings({ restBadgeColor: "auto", workBadgeColor: "auto" })
    root.badgeColorError = ""
    if (restBadgeColorField) restBadgeColorField.text = "auto"
    if (workBadgeColorField) workBadgeColorField.text = "auto"
  }

  function openSubscriptionSettings() {
    root.showingOptions = false
    root.showingSubscriptionSettings = true
    Qt.callLater(function() {
      if (subscriptionSettingsOverlay) subscriptionSettingsOverlay.resetFromStore()
      if (subscriptionSettingsFocus) subscriptionSettingsFocus.forceActiveFocus()
    })
  }

  function closeSubscriptionSettings() {
    root.showingSubscriptionSettings = false
    Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() })
  }

  function findProjectedDay(key) {
    for (var w = 0; w < root.weeks.length; w++) {
      var days = root.weeks[w].days || []
      for (var d = 0; d < days.length; d++)
        if (days[d].key === key) return days[d]
    }
    return null
  }

  function openDayDetails(day) {
    root.selectedDayKey = day ? String(day.key || "") : ""
    root.selectedDay = day
    root.showingDayDetails = day !== null
    Qt.callLater(function() { if (dayDetailsFocus) dayDetailsFocus.forceActiveFocus() })
  }

  function closeDayDetails() {
    root.showingDayDetails = false
    root.selectedDayKey = ""
    root.selectedDay = null
    Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() })
  }

  function weekdayLabel(weekday) {
    return String(Qt.locale().dayName(weekday, Locale.ShortFormat)).replace(/\.$/, "").toUpperCase()
  }

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: {
      if (Model.keyForDate(clock.date) === String(root.todayKey)) return
      var followToday = root.viewingCurrentMonth
      root.today = clock.date
      if (followToday) root.goToToday()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(560))
    contentHeight: panel.fittedContentHeight(calendarColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.editingLife || root.showingOptions || root.showingDayDetails || root.showingSubscriptionSettings
      onMoveRequested: function(dx, dy) {
        if (dx !== 0) root.moveMonth(dx)
        if (dy !== 0) root.moveYear(dy)
      }
      onActivateRequested: root.goToToday()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (t === "[") root.moveMonth(-1)
        else if (t === "]") root.moveMonth(1)
        else if (t === "{") root.moveYear(-1)
        else if (t === "}") root.moveYear(1)
        else if (t === "t" || t === "T") root.goToToday()
        else if (t === "w" || t === "W") root.toggleWeekStart()
        else if (t === "o" || t === "O") root.openOptions()
      }

      Flickable {
        id: calendarScroll
        anchors.fill: parent
        contentWidth: calendarColumn.width
        contentHeight: calendarColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height || contentWidth > width

        Column {
          id: calendarColumn
          width: Math.max(calendarScroll.width, gridColumn.width)
          spacing: Style.space(8)

          // ---- Hero: today, centered, with the options gear at its
          //      top-right corner and the lunar date + jieqi underneath.
          Item {
            width: parent.width
            height: heroRow.height

            Row {
              id: heroRow
              anchors.horizontalCenter: parent.horizontalCenter
              spacing: Style.space(22)

              Text {
                anchors.baseline: heroDate.baseline
                text: "󰃭"
                color: heroMouse.containsMouse
                  ? Style.hoverStateColor(root.contentForeground, Color.accent)
                  : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: 48
              }

              Text {
                id: heroDate
                anchors.verticalCenter: parent.verticalCenter
                text: Model.gregorianHeroLabel(root.today.getMonth() + 1, root.today.getDate(), root.today.getDay(), root.language)
                color: heroMouse.containsMouse
                  ? Style.hoverStateColor(root.contentForeground, Color.accent)
                  : root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: 52
                font.bold: true
              }
            }

            MouseArea {
              id: heroMouse
              x: heroRow.x
              y: heroRow.y
              width: heroRow.width
              height: heroRow.height
              enabled: !root.viewingCurrentMonth
              hoverEnabled: enabled
              cursorShape: Qt.PointingHandCursor
              onClicked: root.goToToday()

              PanelToolTip {
                visible: heroMouse.containsMouse
                text: "Back to today"
                fontFamily: root.contentFontFamily
              }
            }

            PanelActionButton {
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.rightMargin: Style.space(10)
              anchors.topMargin: Style.space(2)
              iconText: "⚙"
              tooltipText: root.langCfg.optionsButtonTooltip
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.openOptions()
            }
          }

          // ---- Lunar date + jieqi, directly under the solar hero date.
          //      Stacked vertically and word-wrapped so long English labels
          //      never overlap the hero date or spill past the panel edge.
          Item {
            width: parent.width
            height: lunarHeroColumn.implicitHeight
            visible: root.lunarHeroText !== ""

            Column {
              id: lunarHeroColumn
              anchors.horizontalCenter: parent.horizontalCenter
              width: Math.min(parent.width, gridColumn.width + Style.space(40))
              spacing: Style.space(2)

              Text {
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: root.lunarHeroText
                color: Qt.darker(root.contentForeground, 1.3)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.body
              }

              Text {
                visible: root.jieqiHeroText !== ""
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: root.jieqiHeroText
                color: Style.selectedStateColor(root.contentForeground, Color.accent)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.body
                font.bold: true
              }
            }
          }

          // ---- Year progress.
          Item {
            width: parent.width
            height: yearBlock.y + yearBlock.height

            Item {
              id: yearBlock
              y: Style.space(6)
              anchors.horizontalCenter: parent.horizontalCenter
              width: gridColumn.width
              height: Math.max(yearLabel.implicitHeight, Style.space(10))

              TapHandler {
                enabled: !root.editingLife
                onDoubleTapped: root.startEditingLife()
              }

              Row {
                visible: root.editingLife
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(10)

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: "BORN"
                  color: Qt.darker(root.contentForeground, 1.5)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.letterSpacing: 1
                }

                TextField {
                  id: bornField
                  width: Style.space(70)
                  anchors.verticalCenter: parent.verticalCenter
                  placeholderText: "year"
                  foreground: root.contentForeground
                  font.family: root.contentFontFamily
                  inputMethodHints: Qt.ImhDigitsOnly

                  Keys.onPressed: function(event) { root.handleLifeKey(event, expectancyField) }
                }

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  anchors.verticalCenterOffset: 0
                  leftPadding: Style.space(6)
                  text: "LIVE TO"
                  color: Qt.darker(root.contentForeground, 1.5)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.letterSpacing: 1
                }

                TextField {
                  id: expectancyField
                  width: Style.space(60)
                  anchors.verticalCenter: parent.verticalCenter
                  placeholderText: "90"
                  foreground: root.contentForeground
                  font.family: root.contentFontFamily
                  inputMethodHints: Qt.ImhDigitsOnly

                  Keys.onPressed: function(event) { root.handleLifeKey(event, bornField) }
                }
              }

              Text {
                id: yearLabel
                visible: !root.editingLife
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                text: root.today.getFullYear()
                color: Qt.darker(root.contentForeground, 1.5)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
                font.letterSpacing: 1
              }

              Text {
                id: yearPercent
                visible: !root.editingLife
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                text: root.yearDonePercent + "%"
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }

              Rectangle {
                id: yearTrack
                visible: !root.editingLife
                anchors.left: yearLabel.right
                anchors.right: yearPercent.left
                anchors.leftMargin: Style.space(12)
                anchors.rightMargin: Style.space(12)
                anchors.verticalCenter: parent.verticalCenter
                height: Style.space(6)
                radius: Style.cornerRadius > 0 ? height / 2 : 0
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)

                Rectangle {
                  width: Math.round(parent.width * root.yearDone)
                  height: parent.height
                  radius: parent.radius
                  color: Style.selectedStateColor(root.contentForeground, Color.accent)

                  Behavior on width { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
                }
              }
            }
          }

          // ---- Memento mori.
          Item {
            visible: root.birthYear > 0
            width: parent.width
            height: visible ? lifeBlock.height : 0

            Item {
              id: lifeBlock
              anchors.horizontalCenter: parent.horizontalCenter
              width: gridColumn.width
              height: Math.max(lifeLabel.implicitHeight, Style.space(10))

              Text {
                id: lifeLabel
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                text: "LIFE"
                color: Qt.darker(root.contentForeground, 1.5)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
                font.letterSpacing: 1
              }

              Text {
                id: lifePercent
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                text: root.lifeDonePercent + "%"
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }

              Rectangle {
                anchors.left: lifeLabel.right
                anchors.right: lifePercent.left
                anchors.leftMargin: Style.space(12)
                anchors.rightMargin: Style.space(12)
                anchors.verticalCenter: parent.verticalCenter
                height: Style.space(6)
                radius: Style.cornerRadius > 0 ? height / 2 : 0
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)

                Rectangle {
                  width: Math.round(parent.width * root.lifeDone)
                  height: parent.height
                  radius: parent.radius
                  color: Style.selectedStateColor(root.contentForeground, Color.accent)

                  Behavior on width { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
                }
              }

              TapHandler {
                onDoubleTapped: root.clearLife()
              }

              MouseArea {
                id: lifeMouse
                anchors.fill: parent
                hoverEnabled: true
                acceptedButtons: Qt.NoButton

                PanelToolTip {
                  visible: lifeMouse.containsMouse
                  text: "Memento Mori"
                  fontFamily: root.contentFontFamily
                }
              }
            }
          }

          // ---- Month grid: week numbers down a gutter on the left, then
          //      the seven day columns, each carrying a small wrappable
          //      lunar/jieqi caption under the day number.
          Item {
            width: parent.width
            height: gridColumn.y + gridColumn.height

            WheelHandler {
              onWheel: function(event) {
                if (event.angleDelta.y === 0) return
                root.moveMonth(event.angleDelta.y > 0 ? -1 : 1)
              }
            }

            Column {
              id: gridColumn
              y: Style.space(18)
              anchors.horizontalCenter: parent.horizontalCenter
              spacing: Style.space(3)

              Row {
                id: headerRow
                spacing: root.cellSpacing

                Rectangle {
                  width: root.weekColumnWidth
                  height: Style.space(16)
                  radius: Style.cornerRadius
                  color: weekStartMouse.containsMouse
                    ? Style.hoverFillFor(root.contentForeground, Color.accent)
                    : "transparent"

                  Text {
                    anchors.centerIn: parent
                    text: "W"
                    color: weekStartMouse.containsMouse
                      ? Style.hoverStateColor(root.contentForeground, Color.accent)
                      : Qt.darker(root.contentForeground, 1.9)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.letterSpacing: 1
                    font.bold: true
                  }

                  MouseArea {
                    id: weekStartMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.toggleWeekStart()
                  }

                  PanelToolTip {
                    visible: weekStartMouse.containsMouse
                    text: "Start weeks on " + root.nextWeekStartLabel
                    fontFamily: root.contentFontFamily
                  }
                }

                Item {
                  width: root.gutterWidth
                  height: Style.space(16)
                }

                Repeater {
                  model: root.weekdays

                  Text {
                    required property var modelData
                    width: root.cellWidth
                    height: Style.space(16)
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    text: root.weekdayLabel(modelData)
                    color: Qt.darker(root.contentForeground, 1.5)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.letterSpacing: 1
                    font.bold: true
                  }
                }
              }

              Repeater {
                model: root.weeks

                Row {
                  required property var modelData
                  spacing: root.cellSpacing

                  Text {
                    width: root.weekColumnWidth
                    height: root.cellHeight
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    text: modelData.week
                    color: Qt.darker(root.contentForeground, 1.9)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                  }

                  Item {
                    width: root.gutterWidth
                    height: root.cellHeight
                  }

                  Repeater {
                    model: modelData.days

                    Components.DayCell {
                      required property var modelData
                      day: modelData
                      foreground: root.contentForeground
                      fontFamily: root.contentFontFamily
                      cellWidth: root.cellWidth
                      cellHeight: root.cellHeight
                      restColor: root.restBadgeFill
                      workColor: root.workBadgeFill
                      conflictColor: root.conflictBadgeFill
                      onActivated: function(day) { root.openDayDetails(day) }
                    }
                  }
                }
              }
            }

            Rectangle {
              x: gridColumn.x + root.weekColumnWidth + root.cellSpacing + Math.round((root.gutterWidth - width) / 2)
              y: gridColumn.y + headerRow.height + gridColumn.spacing
              width: Style.spacing.hairline
              height: gridColumn.height - headerRow.height - gridColumn.spacing
              color: root.contentForeground
              opacity: 0.1
            }
          }

          // ---- Month stepping.
          Item {
            width: parent.width
            height: monthNav.height

            Item {
              id: monthNav
              anchors.horizontalCenter: parent.horizontalCenter
              width: gridColumn.width
              height: monthLabel.implicitHeight + Style.space(10)

              Text {
                id: monthLabel
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                width: Style.space(130)
                horizontalAlignment: Text.AlignHCenter
                text: Model.gregorianMonthYearLabel(root.viewYear, root.viewMonth + 1, root.language)
                color: Qt.darker(root.contentForeground, 1.4)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.body
                font.letterSpacing: 1
              }

              PanelActionButton {
                anchors.left: parent.left
                anchors.leftMargin: -Style.space(8)
                anchors.verticalCenter: parent.verticalCenter
                iconText: "󰅁"
                tooltipText: "Previous month"
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.moveMonth(-1)
              }

              PanelActionButton {
                anchors.right: parent.right
                anchors.rightMargin: -Style.space(8)
                anchors.verticalCenter: parent.verticalCenter
                iconText: "󰅂"
                tooltipText: "Next month"
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.moveMonth(1)
              }
            }
          }
        }
      }
    }

    Item {
      id: dayDetailsFocus
      anchors.fill: parent
      z: 30
      focus: root.showingDayDetails
      visible: root.showingDayDetails

      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          root.closeDayDetails()
          event.accepted = true
        }
      }

      Components.DayDetailsOverlay {
        anchors.fill: parent
        day: root.selectedDay
        language: root.language
        foreground: root.contentForeground
        fontFamily: root.contentFontFamily
        restColor: root.restBadgeFill
        workColor: root.workBadgeFill
        conflictColor: root.conflictBadgeFill
        onCloseRequested: root.closeDayDetails()
      }
    }

    Item {
      id: subscriptionSettingsFocus
      anchors.fill: parent
      z: 40
      focus: root.showingSubscriptionSettings
      visible: root.showingSubscriptionSettings

      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          root.closeSubscriptionSettings()
          event.accepted = true
        }
      }

      Components.SubscriptionSettingsOverlay {
        id: subscriptionSettingsOverlay
        anchors.fill: parent
        visible: root.showingSubscriptionSettings
        store: root.subscriptionStore
        language: root.language
        foreground: root.contentForeground
        fontFamily: root.contentFontFamily
        onCloseRequested: root.closeSubscriptionSettings()
      }
    }

    // ---- Options overlay. Subscription management is deliberately the
    //      first action, and the card scrolls on shorter displays.
    Item {
      id: optionsOverlay
      anchors.fill: parent
      visible: root.showingOptions
      z: 20

      Rectangle {
        anchors.fill: parent
        radius: Style.cornerRadius
        color: Util.alpha(Color.background, 0.94)

        MouseArea { anchors.fill: parent; onClicked: root.closeOptions() }
      }

      Item {
        id: optionsFocus
        anchors.fill: parent
        focus: root.showingOptions

        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) {
            root.closeOptions()
            event.accepted = true
          }
        }

        BorderSurface {
          id: optionsCard
          anchors.centerIn: parent
          width: Math.min(parent.width - Style.space(24), Style.space(380))
          height: Math.min(parent.height - Style.space(24),
                           optionsColumn.implicitHeight + contentTopInset + contentBottomInset)
          color: Color.popups.background
          borderSpec: Border.flat(Color.popups.border, Style.normalBorderWidth)
          radius: Style.cornerRadius
          padding: Style.space(18)

          MouseArea { anchors.fill: parent; onClicked: {} }

          Flickable {
            id: optionsScroll
            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.topMargin: optionsCard.contentTopInset
            anchors.leftMargin: optionsCard.contentLeftInset
            anchors.rightMargin: optionsCard.contentRightInset
            anchors.bottomMargin: optionsCard.contentBottomInset
            contentWidth: width
            contentHeight: optionsColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            interactive: contentHeight > height

            Column {
              id: optionsColumn
              width: optionsScroll.width
              spacing: Style.space(12)

              Text {
                text: root.langCfg.optionsTitle
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.title
                font.bold: true
              }

              Button {
                width: parent.width
                text: root.language === "en"
                  ? "Subscriptions and automatic updates"
                  : (root.language === "zh-Hant" ? "訂閱與自動更新" : "订阅与自动更新")
                iconText: "󰌹"
                tooltipText: root.language === "en"
                  ? "Add subscription URLs and configure update policy"
                  : (root.language === "zh-Hant" ? "新增訂閱地址並設定更新策略" : "添加订阅地址并配置更新策略")
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                focusable: true
                selected: true
                bordered: true
                leftAlign: true
                onClicked: root.openSubscriptionSettings()
              }

              Text {
                width: parent.width
                wrapMode: Text.WordWrap
                text: root.language === "en"
                  ? "Configure China holiday data, typed calendar feeds, refresh intervals, startup/open refresh, and manual updates."
                  : (root.language === "zh-Hant"
                    ? "設定中國班休、類型化日曆訂閱、更新週期、啟動/開啟時更新與手動重新整理。"
                    : "配置中国班休、类型化日历订阅、更新周期、启动/打开时更新与手动刷新。")
                color: Qt.darker(root.contentForeground, 1.45)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
              }

              PanelSeparator { foreground: root.contentForeground }

              Dropdown {
                width: parent.width
                label: root.langCfg.languageLabel
                value: root.language
                options: [
                  { value: "zh-Hans", label: "简体中文" },
                  { value: "zh-Hant", label: "繁體中文" },
                  { value: "en", label: "English" }
                ]
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onChanged: function(v) { root.setLanguage(v) }
              }

              Toggle {
                width: parent.width
                label: root.langCfg.weekStartToggleLabel
                description: root.langCfg.weekStartToggleDesc
                checked: root.weekStart === 1
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.toggleWeekStart()
              }

              Toggle {
                width: parent.width
                label: root.langCfg.jieqiToggleLabel
                description: root.langCfg.jieqiToggleDesc
                checked: root.showJieqi
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.setShowJieqi(!root.showJieqi)
              }

              Toggle {
                width: parent.width
                label: root.language === "en" ? "Show subscriptions" : (root.language === "zh-Hant" ? "顯示訂閱資料" : "显示订阅数据")
                description: root.language === "en"
                  ? "Render date-specific schedule overrides, festivals, and events. Weekly rest settings remain active."
                  : (root.language === "zh-Hant" ? "顯示指定日期的班休覆蓋、節日與事件；每週休息設定仍然生效。" : "显示具体日期的班休覆盖、节日与事件；每周休息设置仍然生效。")
                checked: root.showSubscriptions
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.setShowSubscriptions(!root.showSubscriptions)
              }

              PanelSeparator { foreground: root.contentForeground }

              Text {
                text: root.language === "en" ? "Base weekly schedule" : (root.language === "zh-Hant" ? "基礎每週班休" : "基础每周班休")
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.subtitle
                font.bold: true
              }

              Text {
                width: parent.width
                text: root.language === "en"
                  ? "These switches define the ordinary week. A subscribed record for a specific date takes precedence: 休 changes work to rest; 班 changes rest to make-up work."
                  : (root.language === "zh-Hant"
                    ? "這些開關定義常規每週作息；具體日期的訂閱記錄優先：『休』把工作日改為休息，『班』把休息日改為補班。"
                    : "这些开关定义常规每周作息；具体日期的订阅记录优先：“休”把工作日改为休息，“班”把休息日改为补班。")
                color: Qt.darker(root.contentForeground, 1.45)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                wrapMode: Text.WordWrap
              }

              Toggle {
                width: parent.width
                label: root.language === "en" ? "Saturday is a regular rest day" : (root.language === "zh-Hant" ? "週六為常規休息日" : "周六为常规休息日")
                description: root.language === "en"
                  ? "Used as the base state; a subscribed 休 or 班 record for that Saturday takes precedence."
                  : (root.language === "zh-Hant" ? "作為基礎狀態；該週六如有訂閱的『休』或『班』記錄，則以訂閱為準。" : "作为基础状态；该周六如有订阅的“休”或“班”记录，则以订阅为准。")
                checked: root.saturdayIsRest
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.setSaturdayIsRest(!root.saturdayIsRest)
              }

              Toggle {
                width: parent.width
                label: root.language === "en" ? "Sunday is a regular rest day" : (root.language === "zh-Hant" ? "週日為常規休息日" : "周日为常规休息日")
                description: root.language === "en"
                  ? "Used as the base state; a subscribed 休 or 班 record for that Sunday takes precedence."
                  : (root.language === "zh-Hant" ? "作為基礎狀態；該週日如有訂閱的『休』或『班』記錄，則以訂閱為準。" : "作为基础状态；该周日如有订阅的“休”或“班”记录，则以订阅为准。")
                checked: root.sundayIsRest
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.setSundayIsRest(!root.sundayIsRest)
              }

              Text {
                width: parent.width
                text: root.language === "en"
                  ? "Badge colors accept auto or #RRGGBB. Auto uses different accessible colors for light and dark themes."
                  : (root.language === "zh-Hant" ? "角標色彩可填 auto 或 #RRGGBB；auto 會依亮色／暗色主題套用合適預設。" : "角标颜色可填 auto 或 #RRGGBB；auto 会按亮色/暗色主题使用合理默认值。")
                color: Qt.darker(root.contentForeground, 1.45)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                wrapMode: Text.WordWrap
              }

              Row {
                width: parent.width
                spacing: Style.space(8)

                Column {
                  width: Math.floor((parent.width - parent.spacing) / 2)
                  spacing: Style.spacing.labelGap

                  Text {
                    text: root.language === "en" ? "Rest color" : (root.language === "zh-Hant" ? "休色彩" : "休颜色")
                    color: Qt.darker(root.contentForeground, 1.35)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                  }

                  Row {
                    width: parent.width
                    spacing: Style.space(6)

                    Rectangle {
                      width: Style.space(24)
                      height: Style.space(24)
                      radius: Style.cornerRadius
                      color: root.restBadgeFill
                    }

                    TextField {
                      id: restBadgeColorField
                      width: parent.width - Style.space(24) - parent.spacing
                      placeholderText: "auto"
                      foreground: root.contentForeground
                      font.family: root.contentFontFamily
                      onEditingFinished: root.commitBadgeColor("restBadgeColor", restBadgeColorField)
                    }
                  }
                }

                Column {
                  width: Math.floor((parent.width - parent.spacing) / 2)
                  spacing: Style.spacing.labelGap

                  Text {
                    text: root.language === "en" ? "Work color" : (root.language === "zh-Hant" ? "班色彩" : "班颜色")
                    color: Qt.darker(root.contentForeground, 1.35)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                  }

                  Row {
                    width: parent.width
                    spacing: Style.space(6)

                    Rectangle {
                      width: Style.space(24)
                      height: Style.space(24)
                      radius: Style.cornerRadius
                      color: root.workBadgeFill
                    }

                    TextField {
                      id: workBadgeColorField
                      width: parent.width - Style.space(24) - parent.spacing
                      placeholderText: "auto"
                      foreground: root.contentForeground
                      font.family: root.contentFontFamily
                      onEditingFinished: root.commitBadgeColor("workBadgeColor", workBadgeColorField)
                    }
                  }
                }
              }

              Row {
                width: parent.width
                spacing: Style.space(8)

                Button {
                  id: automaticBadgeColorsButton
                  text: root.language === "en" ? "Use automatic colors" : (root.language === "zh-Hant" ? "使用自動配色" : "使用自动配色")
                  foreground: root.contentForeground
                  fontFamily: root.contentFontFamily
                  focusable: true
                  bordered: true
                  onClicked: root.resetBadgeColors()
                }

                Text {
                  width: parent.width - automaticBadgeColorsButton.width - parent.spacing
                  anchors.verticalCenter: parent.verticalCenter
                  visible: root.badgeColorError !== ""
                  text: root.badgeColorError
                  color: root.conflictBadgeFill
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  wrapMode: Text.WordWrap
                }
              }

              PanelSeparator { foreground: root.contentForeground }

              Row {
                width: parent.width
                spacing: Style.space(6)

                Text {
                  width: parent.width - refreshSubscriptionsButton.width - parent.spacing
                  wrapMode: Text.WordWrap
                  text: {
                    if (!root.subscriptionStore) return root.language === "en" ? "Subscription store unavailable" : "订阅存储不可用"
                    if (root.subscriptionStore.syncing) return root.language === "en" ? "Refreshing subscriptions…" : "正在刷新订阅…"
                    if (root.subscriptionStore.lastError) return root.subscriptionStore.lastError
                    if (root.subscriptionStore.sourceWarning) return root.subscriptionStore.sourceWarning
                    return root.subscriptionStore.lastLoadedAt
                      ? ((root.language === "en" ? "Snapshot: " : "数据快照：") + root.subscriptionStore.lastLoadedAt)
                      : (root.language === "en" ? "No snapshot loaded yet" : "尚未加载订阅快照")
                  }
                  color: Qt.darker(root.contentForeground, 1.5)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                }

                PanelActionButton {
                  id: refreshSubscriptionsButton
                  iconText: "󰑐"
                  tooltipText: root.language === "en" ? "Refresh subscriptions" : "刷新订阅"
                  foreground: root.contentForeground
                  fontFamily: root.contentFontFamily
                  enabled: root.subscriptionStore !== null && !root.subscriptionStore.syncing
                  onClicked: if (root.subscriptionStore) root.subscriptionStore.refresh(true)
                }
              }
            }
          }
        }
      }
    }
  }
}
