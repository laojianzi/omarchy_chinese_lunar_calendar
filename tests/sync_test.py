import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / "bin/calendar-subscription-sync"
FIXTURES = ROOT / "tests/fixtures"


class SyncTest(unittest.TestCase):
    def run_sync(self, root: pathlib.Path, config_data: dict, *, force: bool = True):
        config = root / "subscriptions.json"
        snapshot = root / "snapshot.json"
        state = root / "state.json"
        config.write_text(json.dumps(config_data), encoding="utf-8")
        env = dict(os.environ)
        env.update({
            "XDG_CACHE_HOME": str(root / "cache"),
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_STATE_HOME": str(root / "state-home"),
        })
        command = [
            str(HELPER),
            "--config", str(config),
            "--snapshot", str(snapshot),
            "--state", str(state),
            "--now", "2026-08-26T00:00:00Z",
        ]
        if force:
            command.append("--force")
        subprocess.run(command, check=True, env=env)
        return json.loads(snapshot.read_text(encoding="utf-8"))

    def test_typed_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            data = self.run_sync(root, {
                "schemaVersion": 1,
                "sources": [
                    {
                        "id": "official",
                        "adapter": "holiday-cn-json",
                        "urlTemplate": FIXTURES.as_uri() + "/{year}.json",
                        "refreshHours": 24,
                        "priority": 100,
                    },
                    {
                        "id": "typed",
                        "adapter": "calendar-feed-v1",
                        "url": (FIXTURES / "feed.json").as_uri(),
                        "refreshHours": 24,
                        "priority": 20,
                    },
                ],
            })
            self.assertEqual(data["schemaVersion"], 1)
            self.assertEqual(data["byDate"]["2026-02-17"]["schedule"][0]["payload"]["status"], "off")
            self.assertEqual(data["byDate"]["2026-02-28"]["schedule"][0]["payload"]["status"], "work")
            self.assertEqual(data["byDate"]["2026-09-25"]["festivals"][0]["title"], "中秋节")
            self.assertEqual(data["byDate"]["2026-09-25"]["events"][0]["title"], "项目评审")
            self.assertEqual(data["sources"]["official"]["status"], "ok")
            self.assertEqual(data["sources"]["typed"]["status"], "ok")
            self.assertNotIn("documents", data["sources"]["official"])

    def test_missing_future_year_keeps_available_schedule(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            fixture_dir = root / "fixtures"
            fixture_dir.mkdir()
            shutil.copy(FIXTURES / "2025.json", fixture_dir / "2025.json")
            shutil.copy(FIXTURES / "2026.json", fixture_dir / "2026.json")

            data = self.run_sync(root, {
                "schemaVersion": 1,
                "sources": [{
                    "id": "official",
                    "adapter": "holiday-cn-json",
                    "urlTemplate": fixture_dir.as_uri() + "/{year}.json",
                    "refreshHours": 24,
                    "priority": 100,
                }],
            })

            self.assertIn("2026-02-17", data["byDate"])
            self.assertEqual(data["sources"]["official"]["status"], "ok")
            self.assertFalse(data["sources"]["official"]["stale"])
            self.assertEqual(data["sources"]["official"]["pendingYears"], [2027])
            state = json.loads((root / "state.json").read_text(encoding="utf-8"))
            self.assertTrue(state["sources"]["official"]["documents"]["2027"]["pending"])

            cached = self.run_sync(root, {
                "schemaVersion": 1,
                "sources": [{
                    "id": "official",
                    "adapter": "holiday-cn-json",
                    "urlTemplate": fixture_dir.as_uri() + "/{year}.json",
                    "refreshHours": 24,
                    "priority": 100,
                }],
            }, force=False)
            self.assertEqual(cached["sources"]["official"]["pendingYears"], [2027])


    def test_config_write_stdin_normalizes_and_secures_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            config = root / "subscriptions.json"
            env = dict(os.environ)
            env.update({
                "XDG_CACHE_HOME": str(root / "cache"),
                "XDG_CONFIG_HOME": str(root / "config-home"),
                "XDG_STATE_HOME": str(root / "state-home"),
            })
            value = {
                "schemaVersion": 1,
                "autoUpdate": False,
                "refreshOnStartup": False,
                "refreshOnOpen": True,
                "checkIntervalMinutes": 30,
                "sources": [{
                    "id": "team",
                    "name": "Team feed",
                    "enabled": True,
                    "adapter": "calendar-feed-v1",
                    "url": "webcal://calendar.example.com/feed.json",
                    "refreshHours": 6,
                    "priority": 25,
                }],
            }
            subprocess.run(
                [str(HELPER), "--config", str(config), "--write-config-stdin", "--quiet"],
                input=json.dumps(value) + "\n",
                text=True,
                check=True,
                env=env,
            )
            saved = json.loads(config.read_text(encoding="utf-8"))
            self.assertFalse(saved["autoUpdate"])
            self.assertFalse(saved["refreshOnStartup"])
            self.assertEqual(saved["checkIntervalMinutes"], 30)
            self.assertEqual(saved["sources"][0]["url"], "https://calendar.example.com/feed.json")
            self.assertEqual(config.stat().st_mode & 0o777, 0o600)

    def test_config_write_rejects_insecure_url_without_replacing_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            config = root / "subscriptions.json"
            original = {
                "schemaVersion": 1,
                "sources": [{
                    "id": "official",
                    "adapter": "holiday-cn-json",
                    "urlTemplate": FIXTURES.as_uri() + "/{year}.json",
                }],
            }
            config.write_text(json.dumps(original), encoding="utf-8")
            invalid = {
                "schemaVersion": 1,
                "sources": [{
                    "id": "bad",
                    "adapter": "calendar-feed-v1",
                    "url": "http://example.com/feed.json",
                }],
            }
            completed = subprocess.run(
                [str(HELPER), "--config", str(config), "--write-config-stdin", "--quiet"],
                input=json.dumps(invalid) + "\n",
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(json.loads(config.read_text(encoding="utf-8")), original)

    def test_print_config_migrates_policy_defaults(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            config = root / "subscriptions.json"
            config.write_text(json.dumps({
                "schemaVersion": 1,
                "sources": [{
                    "id": "typed",
                    "adapter": "calendar-feed-v1",
                    "url": (FIXTURES / "feed.json").as_uri(),
                }],
            }), encoding="utf-8")
            completed = subprocess.run(
                [str(HELPER), "--config", str(config), "--print-config"],
                text=True,
                capture_output=True,
                check=True,
            )
            migrated = json.loads(completed.stdout)
            self.assertTrue(migrated["autoUpdate"])
            self.assertTrue(migrated["refreshOnStartup"])
            self.assertTrue(migrated["refreshOnOpen"])
            self.assertEqual(migrated["checkIntervalMinutes"], 60)

    def test_last_known_good_survives_invalid_refresh(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            feed = root / "feed.json"
            shutil.copy(FIXTURES / "feed.json", feed)
            config = {
                "schemaVersion": 1,
                "sources": [{
                    "id": "typed",
                    "adapter": "calendar-feed-v1",
                    "url": feed.as_uri(),
                    "refreshHours": 1,
                    "priority": 20,
                }],
            }

            first = self.run_sync(root, config)
            self.assertEqual(first["sources"]["typed"]["status"], "ok")
            feed.write_text("{not-json", encoding="utf-8")
            second = self.run_sync(root, config)

            self.assertEqual(second["sources"]["typed"]["status"], "stale")
            self.assertEqual(second["byDate"]["2026-09-25"]["events"][0]["title"], "项目评审")


if __name__ == "__main__":
    unittest.main()
