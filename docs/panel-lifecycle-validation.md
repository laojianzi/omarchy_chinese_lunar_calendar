# Panel close / input ownership regression (#9)

## Contract and scope

Installed third-party widgets receive Omarchy's `PluginBarApi`. Its
`centerHoverRevealSuppressed` property is a read-only view; changes must go
through the public `setCenterHoverRevealSuppressed(bool)` operation. Missing or
non-callable optional operations are a no-op, not permission to mutate a legacy
property. No system Omarchy files, theme code, input masks, or lunar rules are
changed by this fix.

All close routes converge on `Panel.close()`: the bar button, shell IPC, Esc,
outside-click dismissal, and popout handoff. `controller.hide()` is in `finally`
so even a failing host callback or overlay cleanup cannot strand logical input
ownership. Exceptions are not silently swallowed. The open callback still runs
after the popout handoff and checks `opened`, so a delayed open cannot undo a
close or interfere with a different panel.

## Automated tests

- `node tests/panel_lifecycle.test.js`: extracts and executes the actual root
  methods in `Panel.qml` and widget forwarding methods. Covers a read-only bar
  facade with a callable setter, missing/non-callable APIs, a writable legacy
  property that must not be mutated, all overlay cleanup, error propagation and
  guaranteed hide, repeated clicks, early close, rapid reopen, and handoff.
- `python3 tests/panel_lifecycle_qml_test.py`: requires the CI-pinned
  `PySide6-Essentials==6.8.3`. Runs the same actual methods in a real Qt QML
  engine, with genuine `readonly` properties and the real `Qt.callLater` event
  loop. This is a headless API/lifecycle contract test, **not** a Hyprland
  compositor test. Downstream logical-state bindings are tested, not actual
  layer-shell surfaces.

The read-only fixture must reject the old direct assignment (red control).
The tests must not substitute a rewritten `close()` implementation for the
production method or rely only on source-text assertions.

## Opt-in real Omarchy desktop smoke test

Run in the active Omarchy/Hyprland session, with other KeyboardPanel popups
closed. The test briefly opens/closes the calendar, waits for compositor state
instead of relying on one fixed sleep, and fails if any primary or secondary
panel layer remains. It does not change configuration or restart the shell.

```bash
python3 tests/smoke_panel_lifecycle.py --require-multiple-monitors
```

Omit `--require-multiple-monitors` for a single-display sanity check; that does
not count as multi-display acceptance. The test prints the detected displays.
If the test fails, collect `hyprctl layers` and the current Quickshell process
logs before using a shell restart as a temporary recovery measure.

## Manual interaction matrix

Repeat on both the built-in bar and a user-level bar clone that preserves the
Omarchy public plugin API. Record the Omarchy, Quickshell and Hyprland versions,
bar type, display names, tested plugin SHA, and outcome. Do not infer that all
bar clones fail from one report.

| Interaction | Expected outcome |
| --- | --- |
| Click calendar, click the same button again | Closes; applications receive input |
| Open, press Esc | Closes; no keyboard capture remains |
| Click outside on the current output | Closes and releases input |
| Click on each other output | Closes all dismiss surfaces |
| Open settings/details, then close the entire calendar | Overlay state resets on reopen |
| Switch to a different popup / keyboard Tab handoff | New popup usable; old delayed open cannot steal state |
| Repeated open/close, including rapid reopen | Final closed state has no remaining panel layers |

Check logs for `Cannot assign to read-only property` and delayed-evaluation
errors. A healthy `shell ping` or a screenshot alone is not interaction proof.

## Verification evidence boundary

Issue #9 contains the reporter's real two-display red/green verification of the
public-setter fix on Omarchy 4.0.3-1 / Quickshell 0.3.1 / Hyprland 0.56.2. CI adds
independent JS and real-QML regression checks; it does not claim to repeat that
desktop matrix. Record new desktop runs separately rather than presenting the
reporter's results as a CI result.

Before declaring delivery, re-read the PR merge state and the latest `main`
SHA, confirm the fix is an ancestor of `main`, and check CI for that exact final
commit. A green staging commit or an unmerged PR is not delivery to users who
install the default branch.
