#!/usr/bin/env python3
"""Opt-in real-desktop smoke test. Opens/closes a popup; never restarts the shell.

Close other KeyboardPanel popups before running. For multi-monitor acceptance
use --require-multiple-monitors. Mouse/keyboard acceptance remains manual.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time


def command(*argv):
    result = subprocess.run(argv, text=True, capture_output=True, timeout=5, check=True)
    return result.stdout


def ipc(method, plugin):
    args = ['omarchy-shell', 'shell', method, plugin]
    if method == 'summon':
        args.append('{}')
    return command(*args)


def layers():
    text = command('hyprctl', 'layers')
    return re.findall(r'namespace:\s*(omarchy-keyboard-panel(?:-dismiss)?)(?=\s|$)', text)


def wait_for_layers(opened, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = layers()
        if (opened and 'omarchy-keyboard-panel' in current) or (not opened and not current):
            return current
        time.sleep(0.05)
    raise RuntimeError('calendar did not open' if opened else 'calendar/dismiss input layers remain after close')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plugin', default='garyliu.lunar-calendar')
    parser.add_argument('--cycles', type=int, default=5)
    parser.add_argument('--timeout', type=float, default=3)
    parser.add_argument('--require-multiple-monitors', action='store_true')
    args = parser.parse_args()
    if not (1 <= args.cycles <= 100 and 0.1 <= args.timeout <= 30):
        parser.error('cycles must be 1..100 and timeout 0.1..30 seconds')
    for binary in ['omarchy-shell', 'hyprctl']:
        if not shutil.which(binary):
            raise RuntimeError(f'{binary} is required; run inside an Omarchy/Hyprland session')
    monitors = json.loads(command('hyprctl', '-j', 'monitors'))
    if not isinstance(monitors, list) or not monitors:
        raise RuntimeError('no active Hyprland monitors')
    if args.require_multiple_monitors and len(monitors) < 2:
        raise RuntimeError('multi-monitor validation requires at least two active monitors')
    if layers():
        raise RuntimeError('close all KeyboardPanel popups before running; no state was changed')
    print('Monitors: ' + ', '.join(str(item.get('name', '?')) for item in monitors))
    started = False
    try:
        started = True
        for cycle in range(args.cycles):
            ipc('summon', args.plugin)
            opened_layers = wait_for_layers(True, args.timeout)
            if args.require_multiple_monitors:
                deadline = time.monotonic() + args.timeout
                while opened_layers.count('omarchy-keyboard-panel-dismiss') < len(monitors) - 1:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('not all secondary-monitor dismissal layers appeared')
                    time.sleep(0.05)
                    opened_layers = layers()
            ipc('hide', args.plugin)
            wait_for_layers(False, args.timeout)
            print(f'PASS cycle {cycle + 1}: calendar and all dismissal layers released')
        # No sleep between hide/re-summon: exercises reopening during fade-out.
        ipc('summon', args.plugin)
        wait_for_layers(True, args.timeout)
        ipc('hide', args.plugin)
        ipc('summon', args.plugin)
        wait_for_layers(True, args.timeout)
        ipc('hide', args.plugin)
        wait_for_layers(False, args.timeout)
        print('PASS rapid reopen: final close releases all panel layers')
    finally:
        if started:
            # Best effort only: never kill/restart a user's shell to make a test pass.
            try:
                ipc('hide', args.plugin)
            except (OSError, subprocess.SubprocessError):
                print('WARNING: cleanup hide failed; inspect the shell logs', file=sys.stderr)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f'FAIL: {error}', file=sys.stderr)
        raise SystemExit(1)
