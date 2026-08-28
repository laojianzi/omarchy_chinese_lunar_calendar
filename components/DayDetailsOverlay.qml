import QtQuick
import qs.Commons
import qs.Ui
import "../subscriptions/FestivalCatalog.js" as FestivalCatalog

Item {
  id: root

  property var day: null
  property string language: "zh-Hans"
  required property color foreground
  required property string fontFamily
  required property color restColor
  required property color workColor
  required property color conflictColor

  signal closeRequested()

  anchors.fill: parent
  visible: day !== null
  z: 30

  function tr(hans, hant, en) {
    if (language === "en") return en
    return language === "zh-Hant" ? hant : hans
  }

  function pad2(value) {
    var text = String(value)
    return text.length < 2 ? "0" + text : text
  }

  function lunarLine() {
    if (!day || !day.lunar) return ""
    var info = day.lunar
    return tr("农历 ", "農曆 ", "Lunar ") + info.lunarMonth + "/" + info.lunarDay
  }


  function presentationInfo() {
    return day && day.presentation ? day.presentation : null
  }

  function basePolicy() {
    return day && day.basePolicy ? day.basePolicy : null
  }

  function hasWorkRest() {
    var presentation = presentationInfo()
    return presentation && String(presentation.badgeText || "") !== ""
  }

  function workRestTitle() {
    if (!day) return ""
    if (day.schedule && day.schedule.title) return String(day.schedule.title)
    var policy = basePolicy()
    return policy && policy.title ? String(policy.title) : ""
  }

  function workRestStatusLine() {
    if (!hasWorkRest()) return ""
    var presentation = presentationInfo()
    var transition = String(presentation.scheduleTransition || "")
    var status = ""
    if (presentation.badgeRole === "off")
      status = tr("休", "休", transition === "work-to-rest" ? "Day off" : "Rest day")
    else if (presentation.badgeRole === "work")
      status = tr("班", "班", transition === "rest-to-work" ? "Make-up workday" : "Scheduled workday")
    else
      status = tr("来源冲突", "來源衝突", "Source conflict")
    var title = workRestTitle()
    return status + (title ? " · " + title : "")
  }

  function transitionLabel(transition) {
    if (transition === "base-rest")
      return tr("基础每周休息日", "基礎每週休息日", "Base weekly rest day")
    if (transition === "rest-to-work")
      return tr("补班：取消基础休息", "補班：取消基礎休息", "Make-up work: overrides base rest")
    if (transition === "work-to-rest")
      return tr("放假：覆盖基础工作日", "放假：覆蓋基礎工作日", "Day off: overrides base work")
    if (transition === "rest-to-rest")
      return tr("订阅休息与基础规则一致", "訂閱休息與基礎規則一致", "Subscribed rest agrees with base rest")
    if (transition === "work-to-work")
      return tr("订阅上班与基础规则一致", "訂閱上班與基礎規則一致", "Subscribed work agrees with base work")
    return ""
  }

  function scheduleSourceLine() {
    if (!day || !hasWorkRest()) return ""
    var schedule = day.schedule
    if (schedule && schedule.conflict && schedule.candidates) {
      var conflicts = []
      for (var i = 0; i < schedule.candidates.length; i++) {
        var candidate = schedule.candidates[i] || {}
        var payload = candidate.payload || {}
        var candidateStatus = String(candidate.resolvedStatus || payload.status || candidate.status || "")
        var state = candidateStatus === "off" ? tr("休", "休", "off") : tr("班", "班", "work")
        conflicts.push(String(candidate.sourceId || "?") + "=" + state)
      }
      return conflicts.join(" · ")
    }

    var parts = []
    if (schedule && schedule.sourceId)
      parts.push(tr("来源：", "來源：", "Source: ") + schedule.sourceId)
    var presentation = presentationInfo()
    var transition = presentation ? transitionLabel(String(presentation.scheduleTransition || "")) : ""
    if (transition) parts.push(transition)
    var association = root.scheduleAssociationLine()
    if (association) parts.push(association)
    return parts.join(" · ")
  }

  function scheduleColor() {
    var presentation = presentationInfo()
    if (!presentation) return foreground
    if (presentation.badgeRole === "off") return restColor
    if (presentation.badgeRole === "work") return workColor
    if (presentation.badgeRole === "conflict") return conflictColor
    return foreground
  }

  function festivalMetaLine(record) {
    return FestivalCatalog.metadataLine(record, root.language)
  }

  function scheduleAssociationLine() {
    var presentation = presentationInfo()
    if (!presentation) return ""
    var festivalId = String(presentation.scheduleRelatedFestivalId || "")
    if (!festivalId || presentation.scheduleHasVisibleFestival) return ""
    var title = FestivalCatalog.titleForId(festivalId, root.language)
    if (!title) return ""
    return tr("关联节日：", "關聯節日：", "Related festival: ") + title
      + tr("（本日为假期安排，不是节日本日）", "（本日為假期安排，不是節日本日）", " (holiday-period date, not the observance date)")
  }

  function eventTime(record) {
    var span = record && record.span ? record.span : {}
    if (span.mode === "date") return tr("全天", "全天", "All day")
    var start = String(span.start || "")
    if (day && start.substr(0, 10) !== day.key)
      return tr("继续", "繼續", "Continues")
    var match = start.match(/T(\d{2}:\d{2})/)
    return match ? match[1] : ""
  }

  Rectangle {
    anchors.fill: parent
    radius: Style.cornerRadius
    color: Util.alpha(Color.background, 0.94)
    MouseArea { anchors.fill: parent; onClicked: root.closeRequested() }
  }

  BorderSurface {
    id: card
    anchors.centerIn: parent
    width: Math.min(parent.width - Style.space(32), Style.space(420))
    height: Math.min(parent.height - Style.space(32), detailColumn.implicitHeight + contentTopInset + contentBottomInset)
    color: Color.popups.background
    borderSpec: Border.flat(Color.popups.border, Style.normalBorderWidth)
    radius: Style.cornerRadius
    padding: Style.space(18)

    MouseArea { anchors.fill: parent; onClicked: {} }

    Flickable {
      anchors.top: parent.top
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.topMargin: card.contentTopInset
      anchors.leftMargin: card.contentLeftInset
      anchors.rightMargin: card.contentRightInset
      anchors.bottomMargin: card.contentBottomInset
      contentWidth: width
      contentHeight: detailColumn.implicitHeight
      clip: true
      boundsBehavior: Flickable.StopAtBounds

      Column {
        id: detailColumn
        width: parent.width
        spacing: Style.space(10)

        Row {
          width: parent.width

          Column {
            width: parent.width - closeButton.width
            spacing: Style.space(2)

            Text {
              text: root.day
                ? root.day.year + "-" + root.pad2(root.day.month + 1) + "-" + root.pad2(root.day.day)
                : ""
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.title
              font.bold: true
            }

            Text {
              text: root.lunarLine()
              visible: text !== ""
              color: Qt.darker(root.foreground, 1.4)
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
            }
          }

          PanelActionButton {
            id: closeButton
            iconText: "󰅖"
            tooltipText: root.tr("关闭", "關閉", "Close")
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.closeRequested()
          }
        }

        PanelSeparator { foreground: root.foreground }

        Column {
          width: parent.width
          spacing: Style.space(5)
          visible: root.hasWorkRest()

          Text {
            text: root.tr("班休", "班休", "Work schedule")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }

          Text {
            width: parent.width
            wrapMode: Text.WordWrap
            text: root.workRestStatusLine()
            textFormat: Text.PlainText
            color: root.scheduleColor()
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            font.bold: true
          }

          Text {
            width: parent.width
            visible: text !== ""
            wrapMode: Text.WordWrap
            text: root.scheduleSourceLine()
            textFormat: Text.PlainText
            color: Qt.darker(root.foreground, 1.5)
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Column {
          width: parent.width
          spacing: Style.space(5)
          visible: root.day && root.day.festivals && root.day.festivals.length > 0

          Text {
            text: root.tr("节日", "節日", "Festivals")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }

          Repeater {
            model: root.day && root.day.festivals ? root.day.festivals : []

            Column {
              required property var modelData
              width: detailColumn.width
              spacing: Style.space(2)

              Text {
                width: parent.width
                text: modelData.title || ""
                textFormat: Text.PlainText
                wrapMode: Text.WordWrap
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                font.bold: true
              }

              Text {
                width: parent.width
                text: root.festivalMetaLine(modelData)
                textFormat: Text.PlainText
                visible: text !== ""
                wrapMode: Text.WordWrap
                color: Qt.darker(root.foreground, 1.5)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }
            }
          }
        }

        Column {
          width: parent.width
          spacing: Style.space(5)
          visible: root.day && root.day.events && root.day.events.length > 0

          Text {
            text: root.tr("事件", "事件", "Events")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }

          Repeater {
            model: root.day && root.day.events ? root.day.events : []

            Row {
              required property var modelData
              width: detailColumn.width
              spacing: Style.space(8)

              Text {
                width: Style.space(52)
                text: root.eventTime(modelData)
                color: Qt.darker(root.foreground, 1.4)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }

              Text {
                width: parent.width - Style.space(60)
                wrapMode: Text.WordWrap
                text: modelData.title || ""
                textFormat: Text.PlainText
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
              }
            }
          }
        }

        Text {
          width: parent.width
          visible: root.day && !root.hasWorkRest()
            && (!root.day.festivals || root.day.festivals.length === 0)
            && (!root.day.events || root.day.events.length === 0)
          wrapMode: Text.WordWrap
          text: root.tr("当天没有班休、节日或事件记录", "當天沒有班休、節日或事件記錄", "No work/rest, festival, or event records for this day")
          color: Qt.darker(root.foreground, 1.5)
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
        }
      }
    }
  }

}
