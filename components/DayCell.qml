import QtQuick
import qs.Commons
import qs.Ui
import "../subscriptions/PresentationSettings.js" as PresentationSettings

Rectangle {
  id: root

  required property var day
  required property color foreground
  required property string fontFamily
  required property int cellWidth
  required property int cellHeight
  required property color restColor
  required property color workColor
  required property color conflictColor

  signal activated(var day)

  width: cellWidth
  height: cellHeight
  radius: Style.cornerRadius
  color: mouse.containsMouse
    ? Style.hoverFillFor(root.foreground, Color.accent)
    : "transparent"
  border.width: day.today ? Style.spacing.hairline : 0
  border.color: Style.normalBorderFor(root.foreground, Color.accent)

  function badgeFill() {
    var role = day.presentation ? day.presentation.badgeRole : ""
    if (role === "off") return root.restColor
    if (role === "work") return root.workColor
    if (role === "conflict") return root.conflictColor
    return Style.selectedFillFor(root.foreground, Color.accent)
  }

  function badgeTextColor() {
    var fill = root.badgeFill()
    return PresentationSettings.contrastTextForRgb(fill.r, fill.g, fill.b)
  }

  function dateColor() {
    if (!day.inMonth) return Qt.darker(root.foreground, 2.2)
    var type = day.presentation ? day.presentation.effectiveDayType : (day.weekend ? "weekend" : "weekday")
    if (type === "official-off" || type === "weekend-off") return root.restColor
    if (type === "makeup-work") return root.workColor
    if (type === "schedule-conflict") return root.conflictColor
    return type === "weekend" ? Qt.darker(root.foreground, 1.45) : root.foreground
  }

  Column {
    anchors.centerIn: parent
    width: parent.width - Style.space(4)
    spacing: Style.space(1)

    Text {
      width: parent.width
      horizontalAlignment: Text.AlignHCenter
      text: root.day.day
      color: root.dateColor()
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
      font.bold: root.day.today || (root.day.presentation && root.day.presentation.effectiveDayType === "makeup-work")
    }

    Text {
      width: parent.width
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
      maximumLineCount: 2
      elide: Text.ElideRight
      text: root.day.presentation ? root.day.presentation.caption : ""
      color: root.day.inMonth
        ? Qt.darker(root.foreground, 1.7)
        : Qt.darker(root.foreground, 2.4)
      font.family: root.fontFamily
      font.pixelSize: Math.max(8, Style.font.caption - 1)
    }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      spacing: Style.space(2)
      visible: root.day.inMonth && root.day.presentation && root.day.presentation.eventDotCount > 0

      Repeater {
        model: root.day.presentation ? root.day.presentation.eventDotCount : 0

        Rectangle {
          width: Style.space(3)
          height: width
          radius: width / 2
          color: Style.selectedStateColor(root.foreground, Color.accent)
        }
      }
    }
  }

  Rectangle {
    visible: root.day.inMonth && root.day.presentation && root.day.presentation.badgeText !== ""
    anchors.right: parent.right
    anchors.top: parent.top
    anchors.rightMargin: Style.space(3)
    anchors.topMargin: Style.space(2)
    width: Style.space(14)
    height: Style.space(14)
    radius: height / 2
    color: root.badgeFill()

    Text {
      anchors.centerIn: parent
      text: root.day.presentation ? root.day.presentation.badgeText : ""
      color: root.badgeTextColor()
      font.family: root.fontFamily
      font.pixelSize: Math.max(8, Style.font.caption - 2)
      font.bold: true
    }
  }

  MouseArea {
    id: mouse
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.activated(root.day)
  }
}
