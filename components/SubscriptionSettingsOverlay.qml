import QtQuick
import qs.Commons
import qs.Ui
import "../subscriptions/ConfigModel.js" as ConfigModel

// Full subscription manager. It edits a local draft and sends the complete
// config to SubscriptionStore over stdin, keeping private calendar URLs out of
// shell.json and process arguments.
Item {
  id: root

  property var store: null
  property string language: "zh-Hans"
  property color foreground: Color.foreground
  property string fontFamily: Style.font.family

  signal closeRequested()

  property var draft: ConfigModel.defaultConfig()
  property int draftRevision: 0
  property bool dirty: false
  property bool savePending: false
  property bool confirmDiscard: false
  property bool confirmReset: false
  property string confirmDeleteId: ""

  property bool editingSource: false
  property string originalSourceId: ""
  property string formId: ""
  property string formName: ""
  property string formAdapter: "calendar-feed-v1"
  property string formAddress: "https://"
  property string formRefreshHours: "6"
  property string formPriority: "20"
  property bool formEnabled: true
  property string formError: ""

  readonly property bool busy: store ? store.busy : false
  readonly property var sources: draft && Array.isArray(draft.sources) ? draft.sources : []

  function tr(en, hans, hant) {
    if (root.language === "en") return en
    if (root.language === "zh-Hant") return hant || hans
    return hans
  }

  function clone(value) {
    return ConfigModel.clone(value)
  }

  function replaceDraft(value, markDirty) {
    root.draft = ConfigModel.normalizeConfig(value)
    root.draftRevision++
    if (markDirty !== false) root.dirty = true
  }

  function resetFromStore() {
    root.draft = ConfigModel.normalizeConfig(root.store ? root.store.config : ConfigModel.defaultConfig())
    root.draftRevision++
    root.dirty = false
    root.savePending = false
    root.confirmDiscard = false
    root.confirmReset = false
    root.confirmDeleteId = ""
    root.cancelEditor()
  }

  function updatePolicy(key, value) {
    var next = clone(root.draft)
    next[key] = value
    root.replaceDraft(next, true)
  }

  function sourceStatus(source) {
    if (!source || source.enabled === false) return root.tr("Disabled", "已停用", "已停用")
    var state = root.store && root.store.sourceState ? root.store.sourceState(source.id) : null
    if (!state) return root.tr("Not synced", "尚未同步", "尚未同步")
    if (state.status === "ok") {
      if (state.pendingYears && state.pendingYears.length)
        return root.tr("Current data · next year pending", "数据正常 · 次年待公布", "資料正常 · 次年待公佈")
      return root.tr("Up to date", "已同步", "已同步")
    }
    if (state.status === "partial") return root.tr("Partially updated", "部分更新", "部分更新")
    if (state.status === "stale") return root.tr("Using cached data", "使用缓存数据", "使用快取資料")
    return root.tr("Sync failed", "同步失败", "同步失敗")
  }

  function sourceStatusDetail(source) {
    var state = root.store && root.store.sourceState ? root.store.sourceState(source.id) : null
    if (!state) return ""
    return String(state.error || state.lastSuccessAt || state.lastCheckedAt || "")
  }

  function adapterLabel(adapter) {
    return adapter === "holiday-cn-json"
      ? root.tr("China official holiday JSON", "中国法定班休 JSON", "中國法定班休 JSON")
      : root.tr("Typed calendar JSON", "类型化日历 JSON", "類型化日曆 JSON")
  }

  function capabilityLabel(adapter) {
    return adapter === "holiday-cn-json"
      ? root.tr("Work/rest schedule", "班休", "班休")
      : root.tr("Schedule · festivals · events", "班休 · 节日 · 事件", "班休 · 節日 · 事件")
  }

  function intervalLabel(hours) {
    var value = Number(hours)
    if (value === 1) return root.tr("Every hour", "每小时", "每小時")
    if (value === 6) return root.tr("Every 6 hours", "每 6 小时", "每 6 小時")
    if (value === 12) return root.tr("Every 12 hours", "每 12 小时", "每 12 小時")
    if (value === 24) return root.tr("Daily", "每天", "每天")
    if (value === 72) return root.tr("Every 3 days", "每 3 天", "每 3 天")
    if (value === 168) return root.tr("Weekly", "每周", "每週")
    return value + "h"
  }

  function checkIntervalLabel(minutes) {
    var value = Number(minutes)
    if (value < 60) return root.tr("Every " + value + " minutes", "每 " + value + " 分钟", "每 " + value + " 分鐘")
    if (value === 60) return root.tr("Every hour", "每小时", "每小時")
    if (value === 360) return root.tr("Every 6 hours", "每 6 小时", "每 6 小時")
    if (value === 720) return root.tr("Every 12 hours", "每 12 小时", "每 12 小時")
    if (value === 1440) return root.tr("Daily", "每天", "每天")
    return value + "m"
  }

  readonly property var refreshOptions: [
    { value: "1", label: intervalLabel(1) },
    { value: "6", label: intervalLabel(6) },
    { value: "12", label: intervalLabel(12) },
    { value: "24", label: intervalLabel(24) },
    { value: "72", label: intervalLabel(72) },
    { value: "168", label: intervalLabel(168) }
  ]

  readonly property var checkOptions: [
    { value: "15", label: checkIntervalLabel(15) },
    { value: "30", label: checkIntervalLabel(30) },
    { value: "60", label: checkIntervalLabel(60) },
    { value: "360", label: checkIntervalLabel(360) },
    { value: "720", label: checkIntervalLabel(720) },
    { value: "1440", label: checkIntervalLabel(1440) }
  ]

  function beginAdd(presetId) {
    var preset = presetId || "typed-feed"
    var source = ConfigModel.presetSource(preset, root.draft)
    if (preset === "cn-official")
      source.name = root.tr("China official holidays", "中国法定节假日", "中國法定節假日")
    else
      source.name = root.tr("Typed calendar feed", "类型化日历订阅", "類型化日曆訂閱")
    root.originalSourceId = ""
    root.loadForm(source)
  }

  function beginEdit(source) {
    root.originalSourceId = String(source.id || "")
    root.loadForm(source)
  }

  function loadForm(source) {
    var normalized = ConfigModel.normalizeSource(source, root.sources.length)
    root.formId = normalized.id
    root.formName = normalized.name
    root.formAdapter = normalized.adapter
    root.formAddress = ConfigModel.sourceAddress(normalized)
    root.formRefreshHours = String(normalized.refreshHours)
    root.formPriority = String(normalized.priority)
    root.formEnabled = normalized.enabled !== false
    root.formError = ""
    root.editingSource = true
    Qt.callLater(function() { if (nameField) nameField.forceActiveFocus() })
  }

  function cancelEditor() {
    root.editingSource = false
    root.originalSourceId = ""
    root.formError = ""
  }

  function formSource() {
    var source = {
      id: String(root.formId || "").trim(),
      name: String(root.formName || "").trim(),
      enabled: root.formEnabled,
      adapter: root.formAdapter,
      refreshHours: Number(root.formRefreshHours),
      priority: Number(root.formPriority)
    }
    return ConfigModel.setSourceAddress(source, root.formAddress)
  }

  function validationMessage(code) {
    if (code === "invalid-id") return root.tr("ID may only contain letters, numbers, dots, underscores, and dashes.", "ID 只能包含字母、数字、点、下划线和短横线。", "ID 只能包含字母、數字、點、底線和短橫線。")
    if (code === "invalid-name") return root.tr("Enter a source name.", "请输入订阅名称。", "請輸入訂閱名稱。")
    if (code === "duplicate-id") return root.tr("Another source already uses this ID.", "该 ID 已被其他订阅使用。", "該 ID 已被其他訂閱使用。")
    if (code === "address-required") return root.tr("Enter a subscription address.", "请输入订阅地址。", "請輸入訂閱地址。")
    if (code === "https-required") return root.tr("Use an HTTPS or file:// address.", "订阅地址必须使用 HTTPS 或 file://。", "訂閱地址必須使用 HTTPS 或 file://。")
    if (code === "year-placeholder-required") return root.tr("The holiday URL template must include {year}.", "法定班休地址模板必须包含 {year}。", "法定班休地址範本必須包含 {year}。")
    return root.tr("Check the subscription settings.", "请检查订阅设置。", "請檢查訂閱設定。")
  }

  function applyEditor() {
    var source = root.formSource()
    var error = ConfigModel.validateSource(source, root.draft, root.originalSourceId)
    if (error) {
      root.formError = root.validationMessage(error)
      return
    }
    root.replaceDraft(ConfigModel.upsertSource(root.draft, source, root.originalSourceId), true)
    root.cancelEditor()
  }

  function toggleSource(sourceId, enabled) {
    root.replaceDraft(ConfigModel.setSourceEnabled(root.draft, sourceId, enabled), true)
  }

  function requestDelete(sourceId) {
    if (root.confirmDeleteId !== sourceId) {
      root.confirmDeleteId = sourceId
      return
    }
    root.replaceDraft(ConfigModel.removeSource(root.draft, sourceId), true)
    root.confirmDeleteId = ""
    if (root.originalSourceId === sourceId) root.cancelEditor()
  }

  function saveDraft() {
    if (!root.store || root.busy) return
    root.savePending = root.store.saveConfig(root.draft, true)
  }

  function requestReset() {
    if (!root.confirmReset) {
      root.confirmReset = true
      return
    }
    root.replaceDraft(ConfigModel.defaultConfig(), true)
    root.confirmReset = false
    root.cancelEditor()
  }

  function requestClose() {
    if ((root.dirty || root.editingSource) && !root.confirmDiscard) {
      root.confirmDiscard = true
      return
    }
    root.closeRequested()
  }

  onVisibleChanged: {
    if (visible) root.resetFromStore()
  }

  Connections {
    target: root.store

    function onConfigRevisionChanged() {
      if (!root.dirty && !root.editingSource && !root.savePending) root.resetFromStore()
    }

    function onConfigSaved(success, error) {
      if (!root.savePending) return
      root.savePending = false
      if (success) {
        root.dirty = false
        root.confirmDiscard = false
      }
    }
  }

  Rectangle {
    anchors.fill: parent
    radius: Style.cornerRadius
    color: Util.alpha(Color.background, 0.96)

    MouseArea { anchors.fill: parent; onClicked: root.requestClose() }
  }

  BorderSurface {
    id: card
    anchors.centerIn: parent
    width: Math.min(parent.width - Style.space(20), Style.space(540))
    height: Math.min(parent.height - Style.space(20), Style.space(620))
    color: Color.popups.background
    borderSpec: Border.flat(Color.popups.border, Style.normalBorderWidth)
    radius: Style.cornerRadius
    padding: Style.space(16)

    MouseArea { anchors.fill: parent; onClicked: {} }

    Item {
      anchors.fill: parent
      anchors.topMargin: card.contentTopInset
      anchors.bottomMargin: card.contentBottomInset
      anchors.leftMargin: card.contentLeftInset
      anchors.rightMargin: card.contentRightInset

      Row {
        id: headerRow
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: Style.space(8)

        Column {
          width: parent.width - refreshButton.width - closeButton.width - parent.spacing * 2
          spacing: Style.space(2)

          Text {
            width: parent.width
            text: root.tr("Subscriptions", "订阅管理", "訂閱管理")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.title
            font.bold: true
          }

          Text {
            width: parent.width
            text: root.tr("Configure sources and automatic refresh without editing JSON.", "配置订阅地址、类型与自动更新，无需手动编辑 JSON。", "設定訂閱地址、類型與自動更新，無需手動編輯 JSON。")
            color: Qt.darker(root.foreground, 1.5)
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }
        }

        Button {
          id: refreshButton
          iconText: "󰑐"
          tooltipText: root.tr("Refresh now", "立即刷新", "立即重新整理")
          foreground: root.foreground
          fontFamily: root.fontFamily
          focusable: true
          enabled: root.store !== null && !root.busy && !root.dirty
          iconSpinning: root.store ? root.store.syncing : false
          onClicked: if (root.store) root.store.refresh(true)
        }

        Button {
          id: closeButton
          iconText: "󰅖"
          tooltipText: root.tr("Close", "关闭", "關閉")
          foreground: root.foreground
          fontFamily: root.fontFamily
          focusable: true
          onClicked: root.requestClose()
        }
      }

      Column {
        id: footerColumn
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        spacing: Style.space(6)

        Text {
          visible: root.confirmDiscard || root.confirmReset || (root.store && (root.store.configError || root.store.lastError))
          width: parent.width
          wrapMode: Text.WordWrap
          text: {
            if (root.confirmDiscard) return root.tr("Unsaved changes will be discarded. Press Close again to confirm.", "存在未保存的更改；再次点击关闭以放弃。", "存在未儲存的變更；再次點擊關閉以放棄。")
            if (root.confirmReset) return root.tr("Press Restore defaults again to replace the draft.", "再次点击恢复默认以确认。", "再次點擊恢復預設以確認。")
            return root.store ? String(root.store.configError || root.store.lastError || "") : ""
          }
          color: Style.selectedStateColor(root.foreground, Color.accent)
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Row {
          width: parent.width
          spacing: Style.space(6)

          Button {
            id: restoreButton
            text: root.confirmReset
              ? root.tr("Confirm reset", "确认恢复", "確認恢復")
              : root.tr("Restore defaults", "恢复默认", "恢復預設")
            foreground: root.foreground
            fontFamily: root.fontFamily
            focusable: true
            bordered: true
            enabled: !root.busy
            onClicked: root.requestReset()
          }

          Item { width: Math.max(0, parent.width - restoreButton.width - saveButton.width - parent.spacing * 2); height: 1 }

          Button {
            id: saveButton
            text: root.savePending || (root.store && root.store.savingConfig)
              ? root.tr("Saving…", "正在保存…", "正在儲存…")
              : root.tr("Save and refresh", "保存并刷新", "儲存並重新整理")
            iconText: root.dirty ? "󰆓" : "󰄬"
            foreground: root.foreground
            fontFamily: root.fontFamily
            focusable: true
            selected: root.dirty
            bordered: true
            enabled: root.dirty && !root.busy && !root.editingSource
            onClicked: root.saveDraft()
          }
        }
      }

      Flickable {
        id: bodyScroll
        anchors.top: headerRow.bottom
        anchors.topMargin: Style.space(12)
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: footerColumn.top
        anchors.bottomMargin: Style.space(10)
        contentWidth: width
        contentHeight: bodyColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: bodyColumn
          width: bodyScroll.width
          spacing: Style.space(10)

          Text {
            text: root.tr("Automatic updates", "自动更新", "自動更新")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.subtitle
            font.bold: true
          }

          Toggle {
            width: parent.width
            label: root.tr("Update subscriptions automatically", "自动更新订阅", "自動更新訂閱")
            description: root.tr("Checks sources in the background; each source still respects its own refresh period.", "后台定期检查；每个订阅仍遵循各自的刷新周期。", "背景定期檢查；每個訂閱仍遵循各自的重新整理週期。")
            checked: root.draft.autoUpdate !== false
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.updatePolicy("autoUpdate", !root.draft.autoUpdate)
          }

          Dropdown {
            visible: root.draft.autoUpdate !== false
            width: parent.width
            label: root.tr("Background check", "后台检查频率", "背景檢查頻率")
            value: String(root.draft.checkIntervalMinutes || 60)
            options: root.checkOptions
            foreground: root.foreground
            fontFamily: root.fontFamily
            onChanged: function(value) { root.updatePolicy("checkIntervalMinutes", Number(value)) }
          }

          Toggle {
            width: parent.width
            label: root.tr("Refresh after shell startup", "启动后刷新", "啟動後重新整理")
            description: root.tr("Runs a stale-data check shortly after Omarchy Shell starts.", "Omarchy Shell 启动后执行一次过期检查。", "Omarchy Shell 啟動後執行一次過期檢查。")
            checked: root.draft.refreshOnStartup !== false
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.updatePolicy("refreshOnStartup", !root.draft.refreshOnStartup)
          }

          Toggle {
            width: parent.width
            label: root.tr("Refresh when calendar opens", "打开日历时刷新", "開啟日曆時重新整理")
            description: root.tr("Checks stale sources when the popup is opened.", "打开弹窗时检查已过期的订阅。", "開啟彈窗時檢查已過期的訂閱。")
            checked: root.draft.refreshOnOpen !== false
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.updatePolicy("refreshOnOpen", !root.draft.refreshOnOpen)
          }

          PanelSeparator { foreground: root.foreground }

          Row {
            width: parent.width
            spacing: Style.space(6)

            Text {
              width: parent.width - addHolidayButton.width - addFeedButton.width - parent.spacing * 2
              anchors.verticalCenter: parent.verticalCenter
              text: root.tr("Sources", "订阅源", "訂閱來源") + " (" + root.sources.length + ")"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.subtitle
              font.bold: true
            }

            Button {
              id: addHolidayButton
              text: root.tr("China holidays", "中国班休", "中國班休")
              iconText: "󰃭"
              foreground: root.foreground
              fontFamily: root.fontFamily
              focusable: true
              onClicked: root.beginAdd("cn-official")
            }

            Button {
              id: addFeedButton
              text: root.tr("Typed feed", "类型化订阅", "類型化訂閱")
              iconText: "󰌹"
              foreground: root.foreground
              fontFamily: root.fontFamily
              focusable: true
              onClicked: root.beginAdd("typed-feed")
            }
          }

          Text {
            visible: root.sources.length === 0
            width: parent.width
            text: root.tr("No subscription sources. Add a preset or a typed JSON feed.", "暂无订阅源，可添加中国班休预设或类型化 JSON。", "暫無訂閱來源，可新增中國班休預設或類型化 JSON。")
            color: Qt.darker(root.foreground, 1.5)
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
          }

          Repeater {
            model: root.sources

            BorderSurface {
              required property var modelData
              readonly property var source: modelData

              width: bodyColumn.width
              height: sourceRow.implicitHeight + Style.space(12)
              radius: Style.cornerRadius
              color: Style.normalFillFor(root.foreground, Color.accent)
              borderSpec: Border.controlSpec("normal", root.foreground, Color.accent)

              Row {
                id: sourceRow
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: parent.borderLeft + Style.space(8)
                anchors.rightMargin: parent.borderRight + Style.space(8)
                spacing: Style.space(6)

                ToggleSwitch {
                  checked: source.enabled !== false
                  foreground: root.foreground
                  busy: root.busy
                  onToggled: root.toggleSource(source.id, !source.enabled)
                  anchors.verticalCenter: parent.verticalCenter
                }

                Column {
                  width: parent.width - editSourceButton.width - deleteSourceButton.width - Style.space(56) - parent.spacing * 3
                  spacing: Style.space(2)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    width: parent.width
                    text: source.name
                    color: root.foreground
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    elide: Text.ElideRight
                  }

                  Text {
                    width: parent.width
                    text: root.adapterLabel(source.adapter) + " · " + root.capabilityLabel(source.adapter)
                    color: Qt.darker(root.foreground, 1.35)
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                  }

                  Text {
                    width: parent.width
                    text: ConfigModel.redactAddress(ConfigModel.sourceAddress(source))
                    color: Qt.darker(root.foreground, 1.65)
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideMiddle
                  }

                  Text {
                    width: parent.width
                    text: root.sourceStatus(source) + (root.sourceStatusDetail(source) ? " · " + root.sourceStatusDetail(source) : "")
                    color: source.enabled === false
                      ? Qt.darker(root.foreground, 1.7)
                      : Style.selectedStateColor(root.foreground, Color.accent)
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                  }
                }

                Button {
                  id: editSourceButton
                  iconText: "󰏫"
                  tooltipText: root.tr("Edit source", "编辑订阅", "編輯訂閱")
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  focusable: true
                  onClicked: root.beginEdit(source)
                  anchors.verticalCenter: parent.verticalCenter
                }

                Button {
                  id: deleteSourceButton
                  iconText: root.confirmDeleteId === source.id ? "󰄬" : "󰆴"
                  tooltipText: root.confirmDeleteId === source.id
                    ? root.tr("Click again to delete", "再次点击删除", "再次點擊刪除")
                    : root.tr("Delete source", "删除订阅", "刪除訂閱")
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  focusable: true
                  selected: root.confirmDeleteId === source.id
                  onClicked: root.requestDelete(source.id)
                  anchors.verticalCenter: parent.verticalCenter
                }
              }
            }
          }

          BorderSurface {
            visible: root.editingSource
            width: parent.width
            height: visible ? editorColumn.implicitHeight + Style.space(24) : 0
            radius: Style.cornerRadius
            color: Style.selectedFillFor(root.foreground, Color.accent)
            borderSpec: Border.controlSpec("selected", root.foreground, Color.accent)

            Column {
              id: editorColumn
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.margins: Style.space(12)
              spacing: Style.space(8)

              Text {
                text: root.originalSourceId
                  ? root.tr("Edit subscription", "编辑订阅", "編輯訂閱")
                  : root.tr("Add subscription", "添加订阅", "新增訂閱")
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.subtitle
                font.bold: true
              }

              Text {
                text: root.tr("Display name", "名称", "名稱")
                color: Qt.darker(root.foreground, 1.35)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
              }

              TextField {
                id: nameField
                width: parent.width
                text: root.formName
                placeholderText: root.tr("My calendar", "我的日历", "我的日曆")
                foreground: root.foreground
                font.family: root.fontFamily
                onTextChanged: { root.formName = text; root.formError = "" }
              }

              Text {
                text: root.tr("Source ID", "订阅 ID", "訂閱 ID")
                color: Qt.darker(root.foreground, 1.35)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
              }

              TextField {
                width: parent.width
                text: root.formId
                placeholderText: "my-calendar"
                foreground: root.foreground
                font.family: root.fontFamily
                onTextChanged: { root.formId = text; root.formError = "" }
              }

              Dropdown {
                width: parent.width
                label: root.tr("Data adapter", "数据类型", "資料類型")
                value: root.formAdapter
                options: [
                  { value: "holiday-cn-json", label: root.adapterLabel("holiday-cn-json") },
                  { value: "calendar-feed-v1", label: root.adapterLabel("calendar-feed-v1") }
                ]
                foreground: root.foreground
                fontFamily: root.fontFamily
                onChanged: function(value) {
                  var previous = root.formAdapter
                  root.formAdapter = value
                  root.formError = ""
                  if (value === "holiday-cn-json" && root.formAddress.indexOf("{year}") < 0)
                    root.formAddress = ConfigModel.DEFAULT_HOLIDAY_URL
                  else if (value === "calendar-feed-v1" && previous === "holiday-cn-json" && root.formAddress === ConfigModel.DEFAULT_HOLIDAY_URL)
                    root.formAddress = "https://"
                }
              }

              Text {
                text: root.formAdapter === "holiday-cn-json"
                  ? root.tr("URL template ({year} required)", "订阅地址模板（必须包含 {year}）", "訂閱地址範本（必須包含 {year}）")
                  : root.tr("Subscription URL", "订阅地址", "訂閱地址")
                color: Qt.darker(root.foreground, 1.35)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
              }

              TextField {
                width: parent.width
                text: root.formAddress
                placeholderText: "https://…"
                foreground: root.foreground
                font.family: root.fontFamily
                onTextChanged: { root.formAddress = text; root.formError = "" }
              }

              Row {
                width: parent.width
                spacing: Style.space(8)

                Dropdown {
                  width: Math.floor((parent.width - parent.spacing) * 0.62)
                  label: root.tr("Source refresh period", "订阅刷新周期", "訂閱重新整理週期")
                  value: root.formRefreshHours
                  options: root.refreshOptions
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  onChanged: function(value) { root.formRefreshHours = value; root.formError = "" }
                }

                Column {
                  width: parent.width - parent.spacing - Math.floor((parent.width - parent.spacing) * 0.62)
                  spacing: Style.spacing.labelGap

                  Text {
                    text: root.tr("Priority", "优先级", "優先級")
                    color: Qt.darker(root.foreground, 1.35)
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                  }

                  TextField {
                    width: parent.width
                    text: root.formPriority
                    placeholderText: "20"
                    foreground: root.foreground
                    font.family: root.fontFamily
                    inputMethodHints: Qt.ImhFormattedNumbersOnly
                    onTextChanged: { root.formPriority = text; root.formError = "" }
                  }
                }
              }

              Toggle {
                width: parent.width
                label: root.tr("Enable this source", "启用此订阅", "啟用此訂閱")
                description: root.capabilityLabel(root.formAdapter)
                checked: root.formEnabled
                foreground: root.foreground
                fontFamily: root.fontFamily
                onClicked: { root.formEnabled = !root.formEnabled; root.formError = "" }
              }

              Text {
                visible: root.formError !== ""
                width: parent.width
                text: root.formError
                color: Style.selectedStateColor(root.foreground, Color.accent)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                wrapMode: Text.WordWrap
              }

              Row {
                anchors.right: parent.right
                spacing: Style.space(6)

                Button {
                  text: root.tr("Cancel", "取消", "取消")
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  focusable: true
                  bordered: true
                  onClicked: root.cancelEditor()
                }

                Button {
                  text: root.tr("Apply", "应用", "套用")
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  focusable: true
                  selected: true
                  bordered: true
                  onClicked: root.applyEditor()
                }
              }
            }
          }

          Item { width: 1; height: Style.space(4) }
        }
      }
    }
  }
}
