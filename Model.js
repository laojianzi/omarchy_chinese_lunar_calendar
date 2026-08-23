// Pure date, lunar-calendar, and format math for the lunar calendar widget
// and its panel. Everything here is locale- and Qt-free so it can be run
// under plain node/qjs for testing; the QML owns Qt.locale()-derived
// weekday/month naming and the system-language default.

var MS_PER_DAY = 86400000

// Weekday indices match both JS Date.getDay() and QML's Locale.Sunday…
// Locale.Saturday, so a locale's firstDayOfWeek can be passed straight in.
var WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

// ---- Bar label formats. Right-clicking the clock walks these in order and
//      writes the result back to shell.json, so the label the bar shows and
//      the format the config stores are always the same thing.
var CLOCK_FORMATS = [
  "dddd HH:mm",
  "dddd h:mm AP",
  "HH:mm",
  "h:mm AP",
  "ddd d MMM HH:mm",
  "ddd d MMM h:mm AP",
  "d MMMM 'W'ww yyyy",
  "yyyy-MM-dd HH:mm"
]

var VERTICAL_CLOCK_FORMATS = [
  "HH\n—\nmm",
  "h\n—\nmm\nAP",
  "dd\nMMM\n'W'ww\n''yy",
  "HH\nmm"
]

function clockFormats(vertical) {
  return vertical ? VERTICAL_CLOCK_FORMATS.slice() : CLOCK_FORMATS.slice()
}

function clockFormatRing(configured, configuredAlt, presets) {
  var ring = []
  var candidates = (presets || []).concat([configuredAlt, configured])
  for (var i = 0; i < candidates.length; i++) {
    var format = String(candidates[i] === undefined || candidates[i] === null ? "" : candidates[i])
    if (format === "" || ring.indexOf(format) !== -1) continue
    ring.push(format)
  }
  return ring.length > 0 ? ring : ["HH:mm"]
}

function nextClockFormat(ring, current) {
  if (!ring || ring.length === 0) return ""
  var index = ring.indexOf(String(current === undefined || current === null ? "" : current))
  return ring[(index + 1) % ring.length]
}

function isoWeekLiteral(year, month, day) {
  return pad2(isoWeek(year, month, day))
}

function pad2(value) {
  var n = Number(value)
  return (n < 10 ? "0" : "") + n
}

// Stable "yyyy-MM-dd" identity for a day (month is 0-based, matching
// JS Date.getMonth()), so a grid cell can be compared against today without
// dragging Date objects through bindings.
function dateKey(year, month, day) {
  return year + "-" + pad2(Number(month) + 1) + "-" + pad2(day)
}

function keyForDate(date) {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate())
}

function coerceWeekStart(value) {
  if (value === undefined || value === null) return null
  if (typeof value === "number")
    return isFinite(value) ? ((Math.round(value) % 7) + 7) % 7 : null

  var text = String(value).replace(/^\s+|\s+$/g, "").toLowerCase()
  if (text === "") return null

  for (var i = 0; i < WEEKDAY_NAMES.length; i++)
    if (WEEKDAY_NAMES[i] === text || WEEKDAY_NAMES[i].substr(0, 3) === text) return i

  var parsed = parseInt(text, 10)
  return isFinite(parsed) ? ((parsed % 7) + 7) % 7 : null
}

function normalizedWeekStart(value, fallback) {
  var configured = coerceWeekStart(value)
  if (configured !== null) return configured
  var fallbackStart = coerceWeekStart(fallback)
  return fallbackStart === null ? 1 : fallbackStart
}

function weekStartSettingName(index) {
  return WEEKDAY_NAMES[normalizedWeekStart(index, 1)]
}

function toggledWeekStart(index) {
  return normalizedWeekStart(index, 1) === 1 ? 0 : 1
}

function weekdayOrder(weekStart) {
  var start = normalizedWeekStart(weekStart, 1)
  var out = []
  for (var i = 0; i < 7; i++) out.push((start + i) % 7)
  return out
}

// ISO-8601 week number: the week owning the Thursday of that date's
// Monday-based week.
function isoWeek(year, month, day) {
  var date = new Date(Date.UTC(year, month, day))
  var weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)
}

function dayOfYear(year, month, day) {
  return Math.round((Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / MS_PER_DAY) + 1
}

function daysInYear(year) {
  return dayOfYear(year, 11, 31)
}

function yearProgress(year, month, day) {
  var total = daysInYear(year)
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, (dayOfYear(year, month, day) - 1) / total))
}

function yearProgressPercent(year, month, day) {
  return Math.round(yearProgress(year, month, day) * 100)
}

var DEFAULT_LIFE_EXPECTANCY = 90

function parseBirthYear(value, currentYear) {
  var now = Math.round(Number(currentYear))
  if (!isFinite(now)) return 0
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d{4}$/.test(text)) return 0
  var year = parseInt(text, 10)
  if (!isFinite(year) || year > now || year < now - 120) return 0
  return year
}

function ageFromBirthYear(birthYear, currentYear) {
  var born = parseBirthYear(birthYear, currentYear)
  if (born <= 0) return 0
  return Math.round(Number(currentYear)) - born
}

function parseAge(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d+$/.test(text)) return 0
  var years = parseInt(text, 10)
  if (!isFinite(years) || years <= 0 || years > 120) return 0
  return years
}

function parseLifeExpectancy(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d+$/.test(text)) return DEFAULT_LIFE_EXPECTANCY
  var years = parseInt(text, 10)
  if (!isFinite(years) || years <= 0 || years > 150) return DEFAULT_LIFE_EXPECTANCY
  return years
}

function lifeProgress(age, expectancy) {
  var years = parseAge(age)
  var span = parseLifeExpectancy(expectancy)
  if (years <= 0 || span <= 0) return 0
  return Math.max(0, Math.min(1, years / span))
}

function lifeProgressPercent(age, expectancy) {
  return Math.round(lifeProgress(age, expectancy) * 100)
}

// Always six rows of seven days, so the popup is exactly the same height in
// every month.
function monthGrid(year, month, weekStart, todayKey) {
  var start = normalizedWeekStart(weekStart, 1)
  var leading = (new Date(year, month, 1).getDay() - start + 7) % 7
  var cursor = new Date(year, month, 1 - leading)
  var today = String(todayKey || "")
  var weeks = []

  for (var w = 0; w < 6; w++) {
    var days = []
    var thursday = null
    for (var d = 0; d < 7; d++) {
      var cellYear = cursor.getFullYear()
      var cellMonth = cursor.getMonth()
      var cellDay = cursor.getDate()
      var weekday = cursor.getDay()
      var key = dateKey(cellYear, cellMonth, cellDay)
      if (weekday === 4) thursday = { year: cellYear, month: cellMonth, day: cellDay }
      days.push({
        key: key,
        year: cellYear,
        month: cellMonth,
        day: cellDay,
        weekday: weekday,
        inMonth: cellMonth === month && cellYear === year,
        weekend: weekday === 0 || weekday === 6,
        today: key === today
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    var anchor = thursday || days[0]
    weeks.push({
      week: isoWeek(anchor.year, anchor.month, anchor.day),
      days: days
    })
  }
  return weeks
}

function stepMonth(year, month, delta) {
  var target = new Date(year, Number(month) + Number(delta), 1)
  return { year: target.getFullYear(), month: target.getMonth() }
}

// =====================================================================
// Chinese lunar calendar (农历). Algorithm and 1900-2100 year-info table
// adapted from the MIT-licensed chinese-calendar GNOME extension
// (https://github.com/tigertall/chinese-calendar), rewritten without its
// GLib/Intl dependencies so it runs in plain JS. The lunar calendar is
// defined against Beijing time (UTC+8, no DST) regardless of the system
// timezone, matching how the calendar is defined.
// =====================================================================

var BEIJING_OFFSET_MS = 8 * 3600000
var LUNAR_BASE_YEAR = 1900
var LUNAR_MIN_YEAR = 1900
var LUNAR_MAX_YEAR = 2100

/**
 * 农历数据表 (1900-2100)。每个数值通过位运算提取：
 * - 第1-4位：闰月月份，0表示没有闰月
 * - 第5-16位：1-12月大小月信息，1表示大月(30天)，0表示小月(29天)
 * - 第17-20位：闰月大小，1表示大月(30天)，0表示小月(29天)
 */
var LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0, // 2050-2059
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520 // 2100
]

// 节气数据 (2000-2053, accurate window). See the 24 solar term references
// used by the source project: 紫金山天文台 / https://dijizhou.100xgj.com.
var TROPICAL_YEAR = 365.24219878
var SOLAR_TERM_YEAR_BASE = 2000
var SOLAR_TERM_INFO = [
  7740, 28943, 50200, 71553, 93042, 114695,
  136531, 158559, 180770, 203149, 225658, 248267,
  270913, 293562, 316142, 338628, 360959, 383127,
  405098, 426887, 448488, 469939, 491257, 512497
]
var TERM_FIX_INFO = [10, 14, 8, 0, 17, -12, 0, -24, -27, -19, -50, -58, -13, -50, -39, -48, -36, 0, 0, 0, 0, 6, 30, 0]

function beijingMidnightUtcMs(year, month, day) {
  return Date.UTC(year, month - 1, day) - BEIJING_OFFSET_MS
}

function utcMsToBeijingYMD(ms) {
  var t = new Date(ms + BEIJING_OFFSET_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

var LUNAR_BASE_MS = beijingMidnightUtcMs(1900, 1, 31) // 农历1900年正月初一

function leapMonth(year) {
  return LUNAR_INFO[year - LUNAR_BASE_YEAR] & 0xf
}

function leapMonthDays(year) {
  return leapMonth(year) ? ((LUNAR_INFO[year - LUNAR_BASE_YEAR] & 0x10000) ? 30 : 29) : 0
}

function lunarMonthDays(year, month) {
  return (LUNAR_INFO[year - LUNAR_BASE_YEAR] & (0x10000 >> month)) ? 30 : 29
}

function lunarYearDays(year) {
  var sum = 348
  for (var i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[year - LUNAR_BASE_YEAR] & i) ? 1 : 0
  return sum + leapMonthDays(year)
}

// Gregorian date -> raw lunar date. Language-agnostic: just the numbers.
function rawSolarToLunar(year, month, day) {
  if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null

  var targetMs = beijingMidnightUtcMs(year, month, day)
  var offset = Math.floor((targetMs - LUNAR_BASE_MS) / 86400000)
  if (offset < 0) return null

  var lunarYear = LUNAR_BASE_YEAR
  var temp = 0
  for (var y = LUNAR_BASE_YEAR; y < LUNAR_MAX_YEAR + 1 && offset > 0; y++) {
    temp = lunarYearDays(y)
    if (offset < temp) break
    offset -= temp
    lunarYear++
  }

  var leap = leapMonth(lunarYear)
  var isLeap = false
  var lunarMonth = 1
  for (var i = 1; i < 13; i++) {
    if (leap > 0 && i === (leap + 1) && !isLeap) {
      --i
      isLeap = true
      temp = leapMonthDays(lunarYear)
    } else {
      temp = lunarMonthDays(lunarYear, i)
    }

    if (isLeap && i === (leap + 1)) isLeap = false

    if (offset < temp) break
    offset -= temp
    lunarMonth++
  }

  if (isLeap) {
    lunarMonth = leap
  } else if (leap > 0 && lunarMonth > leap) {
    lunarMonth--
  }

  return {
    lunarYear: lunarYear,
    lunarMonth: lunarMonth,
    lunarDay: offset + 1,
    isLeap: isLeap
  }
}

// Which (if any) of the 24 solar terms falls on this Gregorian day. Returns
// an index into the language solarTerms array, or null.
function getSolarTermIndex(year, month, day) {
  var termIndex1 = (month - 1) * 2
  var termIndex2 = termIndex1 + 1
  for (var k = 0; k < 2; k++) {
    var idx = k === 0 ? termIndex1 : termIndex2
    var offMs = ((year - SOLAR_TERM_YEAR_BASE) * TROPICAL_YEAR * 24 * 60 +
      SOLAR_TERM_INFO[idx] + TERM_FIX_INFO[idx]) * 60000 + beijingMidnightUtcMs(SOLAR_TERM_YEAR_BASE, 1, 1)
    var ymd = utcMsToBeijingYMD(offMs)
    if (ymd.d === day) return idx
  }
  return null
}

// Full, language-agnostic lunar info for one Gregorian date: the numbers
// plus which (if any) traditional festival/solar-term/eve applies.
function computeLunarInfo(year, month, day) {
  var raw = rawSolarToLunar(year, month, day)
  if (!raw) return null

  var festivalKey = raw.isLeap ? null : (raw.lunarMonth + "-" + raw.lunarDay)

  var isEve = false
  if (raw.lunarMonth === 12) {
    var leap = leapMonth(raw.lunarYear)
    if (leap !== 12 || (leap === 12 && raw.isLeap)) {
      if (raw.lunarDay === lunarMonthDays(raw.lunarYear, 12)) isEve = true
    }
  }

  return {
    lunarYear: raw.lunarYear,
    lunarMonth: raw.lunarMonth,
    lunarDay: raw.lunarDay,
    isLeap: raw.isLeap,
    festivalKey: festivalKey,
    isEve: isEve,
    solarTermIndex: getSolarTermIndex(year, month, day)
  }
}

// ---- Language config. Three UI languages, independent of mainland/HK/TW
//      region: the vocabulary differs (simplified/traditional characters,
//      or English), but the lunar math stays the same.
var LANG_DATA = {
  "zh-Hans": {
    tianGan: ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"],
    diZhi: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
    zodiac: ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"],
    monthNames: ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "腊"],
    dayNames: [
      "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
      "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
      "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
    ],
    solarTerms: [
      "小寒", "大寒", "立春", "雨水", "惊蛰", "春分",
      "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
      "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
      "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"
    ],
    festivals: {
      "1-1": "春节", "1-15": "元宵节", "2-2": "龙抬头", "3-3": "上巳节",
      "5-5": "端午节", "7-7": "七夕节", "7-15": "中元节", "8-15": "中秋节",
      "9-9": "重阳节", "12-8": "腊八节", "12-23": "小年"
    },
    eveName: "除夕",
    leapWord: "闰",
    monthWord: "月",
    yearWord: "年",
    zodiacWord: "年",
    calendarLabel: "农历",
    optionsTitle: "选项",
    languageLabel: "语言",
    jieqiToggleLabel: "显示节气",
    jieqiToggleDesc: "在日历中标注二十四节气",
    weekStartToggleLabel: "周一为一周首日",
    weekStartToggleDesc: "关闭则改为周日为一周首日",
    optionsButtonTooltip: "选项"
  },
  "zh-Hant": {
    tianGan: ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"],
    diZhi: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
    zodiac: ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"],
    monthNames: ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "臘"],
    dayNames: [
      "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
      "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
      "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
    ],
    solarTerms: [
      "小寒", "大寒", "立春", "雨水", "驚蟄", "春分",
      "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
      "小暑", "大暑", "立秋", "處暑", "白露", "秋分",
      "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"
    ],
    festivals: {
      "1-1": "春節", "1-15": "元宵節", "2-2": "龍抬頭", "3-3": "上巳節",
      "5-5": "端午節", "7-7": "七夕節", "7-15": "中元節", "8-15": "中秋節",
      "9-9": "重陽節", "12-8": "臘八節", "12-23": "小年"
    },
    eveName: "除夕",
    leapWord: "閏",
    monthWord: "月",
    yearWord: "年",
    zodiacWord: "年",
    calendarLabel: "農曆",
    optionsTitle: "選項",
    languageLabel: "語言",
    jieqiToggleLabel: "顯示節氣",
    jieqiToggleDesc: "在日曆中標註二十四節氣",
    weekStartToggleLabel: "週一為一週首日",
    weekStartToggleDesc: "關閉則改為週日為一週首日",
    optionsButtonTooltip: "選項"
  },
  "en": {
    tianGan: ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"],
    diZhi: ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"],
    zodiac: ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"],
    monthNames: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6", "Month 7", "Month 8", "Month 9", "Month 10", "Month 11", "Month 12"],
    dayNames: [
      "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10",
      "Day 11", "Day 12", "Day 13", "Day 14", "Day 15", "Day 16", "Day 17", "Day 18", "Day 19", "Day 20",
      "Day 21", "Day 22", "Day 23", "Day 24", "Day 25", "Day 26", "Day 27", "Day 28", "Day 29", "Day 30"
    ],
    solarTerms: [
      "Minor Cold", "Major Cold", "Start of Spring", "Rain Water", "Awakening of Insects", "Spring Equinox",
      "Qingming", "Grain Rain", "Start of Summer", "Grain Buds", "Grain in Ear", "Summer Solstice",
      "Minor Heat", "Major Heat", "Start of Autumn", "End of Heat", "White Dew", "Autumn Equinox",
      "Cold Dew", "Frost's Descent", "Start of Winter", "Minor Snow", "Major Snow", "Winter Solstice"
    ],
    festivals: {
      "1-1": "Chinese New Year", "1-15": "Lantern Festival", "2-2": "Dragon Head-Raising Day", "3-3": "Shangsi Festival",
      "5-5": "Dragon Boat Festival", "7-7": "Qixi Festival", "7-15": "Ghost Festival", "8-15": "Mid-Autumn Festival",
      "9-9": "Double Ninth Festival", "12-8": "Laba Festival", "12-23": "Little New Year"
    },
    eveName: "Chinese New Year's Eve",
    leapWord: "Leap ",
    monthWord: "",
    yearWord: "",
    zodiacWord: "",
    calendarLabel: "Lunar",
    optionsTitle: "Options",
    languageLabel: "Language",
    jieqiToggleLabel: "Show solar terms",
    jieqiToggleDesc: "Mark the 24 solar terms (jieqi) on the calendar",
    weekStartToggleLabel: "Week starts on Monday",
    weekStartToggleDesc: "Turn off to start weeks on Sunday instead",
    optionsButtonTooltip: "Options"
  }
}

function normalizedLanguage(value, fallback) {
  var v = String(value === undefined || value === null ? "" : value)
  if (v === "zh-Hans" || v === "zh-Hant" || v === "en") return v
  return (fallback === "zh-Hans" || fallback === "zh-Hant" || fallback === "en") ? fallback : "zh-Hans"
}

// Default UI language from a Qt.locale().name()-style string (e.g. "zh_CN",
// "zh_TW", "en_US"). Simplified for mainland/Singapore, Traditional for
// Taiwan/Hong Kong/Macau, English otherwise.
function defaultLanguage(localeName) {
  var name = String(localeName || "")
  if (name.indexOf("zh") !== 0) return "en"
  if (name.indexOf("TW") !== -1 || name.indexOf("HK") !== -1 || name.indexOf("MO") !== -1 || name.indexOf("Hant") !== -1) return "zh-Hant"
  return "zh-Hans"
}

function langConfig(lang) {
  return LANG_DATA[lang] || LANG_DATA["zh-Hans"]
}

function isZhLanguage(lang) {
  return lang === "zh-Hans" || lang === "zh-Hant"
}

// ---- Gregorian-calendar (solar) date localization. Qt's own "dddd"/"MMMM"
// format tokens always render in Qt.locale()'s language, which is the
// system locale — not this plugin's independent language setting — so
// weekday/month names for the two UI dates below are produced here instead.

var ZH_WEEKDAY_FULL = ["星期天", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
var EN_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

// The calendar hero date ("8月17日 星期天" in Chinese, "August 23" in
// English). `weekday` is 0 (Sunday) .. 6 (Saturday), matching Date.getDay().
function gregorianHeroLabel(month, day, weekday, lang) {
  if (isZhLanguage(lang)) return month + "月" + day + "日 " + ZH_WEEKDAY_FULL[weekday]
  return EN_MONTH_NAMES[month - 1] + " " + day
}

// The month-nav label under the grid ("2026年8月" in Chinese, "AUGUST 2026"
// in English — matching the all-caps style the label already used).
function gregorianMonthYearLabel(year, month, lang) {
  if (isZhLanguage(lang)) return year + "年" + month + "月"
  return EN_MONTH_NAMES[month - 1].toUpperCase() + " " + year
}

// The bar label's weekday token ("dddd"/"ddd" in a Qt.formatDateTime format
// string) doesn't translate — for a Chinese UI language it's replaced with a
// numeric date instead ("dddd HH:mm" -> "M月d日 HH:mm" -> "8月17日 11:45").
// "M" and "d" are themselves plain Qt format tokens, so Qt.formatDateTime
// still fills them in; only the token itself is substituted here, the same
// way the "ww" (ISO week) token already is before formatting.
function localizeWeekdayToken(format, lang) {
  if (!isZhLanguage(lang)) return format
  return String(format).replace(/dddd/g, "M月d日").replace(/ddd/g, "M月d日")
}

function lunarHeroLabel(info, lang) {
  if (!info) return ""
  var cfg = langConfig(lang)
  var monthName = (info.isLeap ? cfg.leapWord : "") + cfg.monthNames[info.lunarMonth - 1] + cfg.monthWord
  var dayName = info.isEve ? cfg.eveName : cfg.dayNames[info.lunarDay - 1]
  var zodiac = cfg.zodiac[((info.lunarYear - 4) % 12 + 12) % 12]

  if (lang === "en") return "Year of the " + zodiac + " · " + monthName + " " + dayName

  var gan = cfg.tianGan[((info.lunarYear - 4) % 10 + 10) % 10]
  var zhi = cfg.diZhi[((info.lunarYear - 4) % 12 + 12) % 12]
  return gan + zhi + cfg.yearWord + zodiac + cfg.zodiacWord + " " + monthName + dayName
}

function jieqiLabel(info, lang) {
  if (!info || info.solarTermIndex === null || info.solarTermIndex === undefined) return ""
  return langConfig(lang).solarTerms[info.solarTermIndex]
}

// Short caption for a month-grid cell: festival/eve beats jieqi beats the
// plain lunar day (or month name, on the first of the lunar month) —
// mirrors how real dual calendars prioritize what to print under the date.
function lunarCellCaption(info, lang, showJieqi) {
  if (!info) return ""
  var cfg = langConfig(lang)

  if (info.festivalKey && cfg.festivals[info.festivalKey]) return cfg.festivals[info.festivalKey]
  if (info.isEve) return cfg.eveName
  if (showJieqi && info.solarTermIndex !== null && info.solarTermIndex !== undefined) return cfg.solarTerms[info.solarTermIndex]
  if (info.lunarDay === 1) return (info.isLeap ? cfg.leapWord : "") + cfg.monthNames[info.lunarMonth - 1] + cfg.monthWord
  return cfg.dayNames[info.lunarDay - 1]
}

if (typeof module !== "undefined") {
  module.exports = {
    dateKey: dateKey,
    keyForDate: keyForDate,
    normalizedWeekStart: normalizedWeekStart,
    weekStartSettingName: weekStartSettingName,
    toggledWeekStart: toggledWeekStart,
    weekdayOrder: weekdayOrder,
    isoWeek: isoWeek,
    dayOfYear: dayOfYear,
    daysInYear: daysInYear,
    yearProgress: yearProgress,
    yearProgressPercent: yearProgressPercent,
    parseAge: parseAge,
    parseBirthYear: parseBirthYear,
    ageFromBirthYear: ageFromBirthYear,
    parseLifeExpectancy: parseLifeExpectancy,
    lifeProgress: lifeProgress,
    lifeProgressPercent: lifeProgressPercent,
    monthGrid: monthGrid,
    stepMonth: stepMonth,
    clockFormats: clockFormats,
    clockFormatRing: clockFormatRing,
    nextClockFormat: nextClockFormat,
    isoWeekLiteral: isoWeekLiteral,
    rawSolarToLunar: rawSolarToLunar,
    computeLunarInfo: computeLunarInfo,
    getSolarTermIndex: getSolarTermIndex,
    normalizedLanguage: normalizedLanguage,
    defaultLanguage: defaultLanguage,
    langConfig: langConfig,
    gregorianHeroLabel: gregorianHeroLabel,
    gregorianMonthYearLabel: gregorianMonthYearLabel,
    localizeWeekdayToken: localizeWeekdayToken,
    lunarHeroLabel: lunarHeroLabel,
    jieqiLabel: jieqiLabel,
    lunarCellCaption: lunarCellCaption
  }
}
