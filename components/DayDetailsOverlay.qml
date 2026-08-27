import QtQuick
import qs.Commons
import qs.Ui

Item {
  id: root

  property var day: null
  property string language: "zh-Hans"
  required property color foreground
  required property string fontFamily

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


  function scheduleSourceLine() {
    if (!day || !day.schedule) return ""
    var schedule = day.schedule
    if (schedule.conflict && schedule.candidates) {
      var parts = []
      for (var i = 0; i < schedule.candidates.length; i++) {
        var candidate = schedule.candidates[i] || {}
        var payload = candidate.payload || {}
        var state = payload.status === "off" ? tr("休", "休", "off") : tr("班", "班", "work")
        parts.push(String(candidate.sourceId || "?") + "=" + state)
      }
      return parts.join(" · ")
    }
    return schedule.sourceId
      ? tr("来源：", "來源：", "Source: ") + schedule.sourceId
      : ""
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
          visible: root.day && root.day.schedule !== null

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
            text: {
              if (!root.day || !root.day.schedule) return ""
              var schedule = root.day.schedule
              var status = schedule.status === "off"
                ? root.tr("休", "休", "Day off")
                : schedule.status === "work"
                  ? root.tr("班", "班", "Make-up workday")
                  : root.tr("来源冲突", "來源衝突", "Source conflict")
              return status + (schedule.title ? " · " + schedule.title : "")
            }
            color: Style.selectedStateColor(root.foreground, Color.accent)
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            font.bold: true
          }

          Text {
            width: parent.width
            visible: text !== ""
            wrapMode: Text.WordWrap
            text: root.scheduleSourceLine()
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

            Text {
              required property var modelData
              width: detailColumn.width
              text: modelData.title || ""
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
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
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
              }
            }
          }
        }

        Text {
          width: parent.width
          visible: root.day && root.day.schedule === null
            && (!root.day.festivals || root.day.festivals.length === 0)
            && (!root.day.events || root.day.events.length === 0)
          wrapMode: Text.WordWrap
          text: root.tr("当天没有订阅记录", "當天沒有訂閱記錄", "No subscription records for this day")
          color: Qt.darker(root.foreground, 1.5)
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
        }
      }
    }
  }

}
