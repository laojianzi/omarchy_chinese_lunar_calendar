// Pure helpers for schedule rendering preferences. The QML layer supplies
// the current popup background RGB values; this module picks light/dark
// defaults, validates user overrides, and chooses readable badge text.

var AUTO = "auto"
var PALETTES = {
  light: {
    rest: "#C62828",
    work: "#1565C0",
    conflict: "#B45309"
  },
  dark: {
    rest: "#F87171",
    work: "#60A5FA",
    conflict: "#FBBF24"
  }
}

function clamp01(value) {
  var number = Number(value)
  if (!isFinite(number)) return 0
  return Math.max(0, Math.min(1, number))
}

function linearChannel(value) {
  var channel = clamp01(value)
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r, g, b) {
  return 0.2126 * linearChannel(r)
    + 0.7152 * linearChannel(g)
    + 0.0722 * linearChannel(b)
}

function isDarkRgb(r, g, b) {
  return relativeLuminance(r, g, b) < 0.28
}

function isValidColorSetting(value) {
  var text = String(value === undefined || value === null ? "" : value).trim()
  return text === "" || text.toLowerCase() === AUTO || /^#[0-9A-Fa-f]{6}$/.test(text)
}

function normalizeColorSetting(value) {
  var text = String(value === undefined || value === null ? AUTO : value).trim()
  if (text === "" || text.toLowerCase() === AUTO) return AUTO
  if (/^#[0-9A-Fa-f]{6}$/.test(text)) return text.toUpperCase()
  return AUTO
}

function resolveColor(value, role, dark) {
  var normalized = normalizeColorSetting(value)
  if (normalized !== AUTO) return normalized
  var palette = dark ? PALETTES.dark : PALETTES.light
  return palette[role] || palette.conflict
}

function contrastTextForRgb(r, g, b) {
  var luminance = relativeLuminance(r, g, b)
  var whiteContrast = 1.05 / (luminance + 0.05)
  var darkLuminance = 0.009
  var darkContrast = (luminance + 0.05) / (darkLuminance + 0.05)
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#111827"
}

if (typeof module !== "undefined") {
  module.exports = {
    AUTO: AUTO,
    PALETTES: PALETTES,
    relativeLuminance: relativeLuminance,
    isDarkRgb: isDarkRgb,
    isValidColorSetting: isValidColorSetting,
    normalizeColorSetting: normalizeColorSetting,
    resolveColor: resolveColor,
    contrastTextForRgb: contrastTextForRgb
  }
}
