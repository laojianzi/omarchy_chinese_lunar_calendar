import QtQuick
import Quickshell
import Quickshell.Io
import "ConfigModel.js" as ConfigModel

// Runtime-facing half of the subscription layer. Network, parsing, schema
// migration and atomic writes live in bin/calendar-subscription-sync; the
// long-lived shell watches the canonical snapshot and user-editable config.
QtObject {
  id: root

  signal configSaved(bool success, string error)

  readonly property string homeDir: Quickshell.env("HOME")
  readonly property string cacheDir: Quickshell.env("XDG_CACHE_HOME") || (homeDir + "/.cache")
  readonly property string configDir: Quickshell.env("XDG_CONFIG_HOME") || (homeDir + "/.config")
  readonly property string snapshotPath: cacheDir + "/omarchy/lunar-calendar/snapshot-v1.json"
  readonly property string configPath: configDir + "/omarchy/lunar-calendar/subscriptions.json"

  function localPath(url) {
    var value = String(url || "")
    return value.indexOf("file://") === 0 ? value.substr(7) : value
  }

  readonly property string helperPath: localPath(Qt.resolvedUrl("../bin/calendar-subscription-sync"))

  property var snapshot: ({ schemaVersion: 1, revision: "empty", sources: {}, byDate: {} })
  property int revision: 0
  property var config: ConfigModel.defaultConfig()
  property int configRevision: 0
  property bool configLoaded: false
  property bool startupPolicyApplied: false

  property bool syncing: false
  property bool savingConfig: false
  readonly property bool busy: syncing || savingConfig
  property string stderrText: ""
  property string lastError: ""
  property string configError: ""
  property string sourceWarning: ""
  property string lastLoadedAt: ""
  property string pendingConfigJson: ""
  property bool refreshAfterConfigSave: false

  readonly property bool autoUpdate: config.autoUpdate !== false
  readonly property bool refreshOnStartup: config.refreshOnStartup !== false
  readonly property bool refreshOnOpen: config.refreshOnOpen !== false
  readonly property int checkIntervalMinutes: Math.max(15, Math.min(1440, Number(config.checkIntervalMinutes || 60)))

  onCheckIntervalMinutesChanged: {
    if (periodicRefresh.running) periodicRefresh.restart()
  }

  function summarizeSources(sources) {
    if (!sources) return ""
    var messages = []
    for (var id in sources) {
      var source = sources[id] || {}
      if (source.status === "ok") continue
      var label = String(source.name || id)
      var detail = String(source.error || source.status || "")
      messages.push(label + (detail ? ": " + detail : ""))
    }
    return messages.join(" · ")
  }

  function sourceState(sourceId) {
    var sources = root.snapshot && root.snapshot.sources ? root.snapshot.sources : {}
    return sources[String(sourceId || "")] || null
  }

  function loadSnapshot(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      if (!parsed || parsed.schemaVersion !== 1 || !parsed.byDate)
        throw new Error("unsupported snapshot schema")
      root.snapshot = parsed
      root.revision++
      root.lastError = ""
      root.sourceWarning = root.summarizeSources(parsed.sources)
      root.lastLoadedAt = parsed.generatedAt || ""
    } catch (error) {
      root.lastError = String(error)
    }
  }

  function loadConfig(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      root.config = ConfigModel.normalizeConfig(parsed)
      root.configLoaded = true
      root.configRevision++
      root.configError = ""
      Qt.callLater(root.applyStartupPolicy)
    } catch (error) {
      root.configError = String(error)
    }
  }

  function refresh(force) {
    if (syncProcess.running || configSaveProcess.running) return
    root.stderrText = ""
    root.lastError = ""
    var command = ["python3", root.helperPath, "--quiet"]
    if (force) command.push("--force")
    syncProcess.command = command
    syncProcess.running = true
  }

  function refreshIfStale(reason) {
    var trigger = String(reason || "manual")
    if (trigger === "startup" && !root.refreshOnStartup) return
    if (trigger === "open" && !root.refreshOnOpen) return
    if (trigger === "periodic" && !root.autoUpdate) return
    root.refresh(false)
  }

  function applyStartupPolicy() {
    if (root.startupPolicyApplied || !root.configLoaded) return
    root.startupPolicyApplied = true
    root.refreshIfStale("startup")
  }

  function saveConfig(nextConfig, refreshAfter) {
    if (configSaveProcess.running || syncProcess.running) return false
    try {
      var normalized = ConfigModel.normalizeConfig(nextConfig)
      root.pendingConfigJson = JSON.stringify(normalized)
      root.refreshAfterConfigSave = refreshAfter !== false
      root.configError = ""
      root.stderrText = ""
      configSaveProcess.command = ["python3", root.helperPath, "--write-config-stdin", "--quiet"]
      configSaveProcess.running = true
      return true
    } catch (error) {
      root.configError = String(error)
      return false
    }
  }

  function resetConfig() {
    return root.saveConfig(ConfigModel.defaultConfig(), true)
  }

  property FileView snapshotFile: FileView {
    path: root.snapshotPath
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.loadSnapshot(text())
  }

  property FileView configFile: FileView {
    path: root.configPath
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.loadConfig(text())
  }

  property Process syncProcess: Process {
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.stderrText = String(text || "").trim()
        if (root.lastError !== "" && root.stderrText !== "")
          root.lastError = root.stderrText
      }
    }
    onRunningChanged: root.syncing = running
    onExited: function(exitCode) {
      root.syncing = false
      configFile.reload()
      if (exitCode === 0) snapshotFile.reload()
      else root.lastError = root.stderrText || ("subscription sync exited with status " + exitCode)
    }
  }

  property Process configSaveProcess: Process {
    stdinEnabled: true
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.stderrText = String(text || "").trim()
    }
    onStarted: write(root.pendingConfigJson + "\n")
    onRunningChanged: root.savingConfig = running
    onExited: function(exitCode) {
      root.savingConfig = false
      var shouldRefresh = root.refreshAfterConfigSave
      root.refreshAfterConfigSave = false
      root.pendingConfigJson = ""
      if (exitCode !== 0) {
        root.configError = root.stderrText || ("subscription config save exited with status " + exitCode)
        root.configSaved(false, root.configError)
        return
      }
      root.configError = ""
      root.configSaved(true, "")
      configFile.reload()
      if (shouldRefresh) Qt.callLater(function() { root.refresh(true) })
    }
  }

  property Process configBootstrapProcess: Process {
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var raw = String(text || "").trim()
        if (raw) root.loadConfig(raw)
      }
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.configError = String(text || "").trim()
    }
    onExited: function(exitCode) {
      if (exitCode === 0) configFile.reload()
      else if (!root.configError) root.configError = "subscription config bootstrap failed"
    }
  }

  Component.onCompleted: {
    configFile.reload()
    snapshotFile.reload()
    configBootstrapTimer.start()
  }

  property Timer configBootstrapTimer: Timer {
    interval: 500
    repeat: false
    onTriggered: {
      if (root.configLoaded) {
        root.applyStartupPolicy()
        return
      }
      configBootstrapProcess.command = ["python3", root.helperPath, "--print-config"]
      configBootstrapProcess.running = true
    }
  }

  property Timer periodicRefresh: Timer {
    interval: root.checkIntervalMinutes * 60 * 1000
    repeat: true
    running: root.configLoaded && root.autoUpdate
    onTriggered: root.refreshIfStale("periodic")
  }
}
