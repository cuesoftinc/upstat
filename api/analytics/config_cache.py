"""The config snapshots analytics decides with (system-design.md §6.8 as
amended by X-11): monitors, rules, channels and SLOs, each a JSON object
common rewrites under <prefix>/config/<kind>.json. Loaded on start,
reloaded when upstat.config.changed names a kind; Postgres is never read."""

import json
import logging
from dataclasses import dataclass, field

from storage import ObjectMissing, ObjectStore

log = logging.getLogger(__name__)

KINDS = ("monitors", "rules", "channels", "slos")


@dataclass
class ConfigCache:
    store: ObjectStore
    prefix: str
    monitors: dict[str, dict] = field(default_factory=dict)
    rules: dict[str, dict] = field(default_factory=dict)
    channels: dict[str, dict] = field(default_factory=dict)
    slos: dict[str, dict] = field(default_factory=dict)
    versions: dict[str, int] = field(default_factory=dict)

    async def load(self) -> None:
        for kind in KINDS:
            await self.reload(kind)

    async def reload(self, kind: str) -> bool:
        """Reload one kind; other kinds (orgs, members, ...) are not ours."""
        if kind not in KINDS:
            return False
        try:
            doc = json.loads(await self.store.get(f"{self.prefix}/config/{kind}.json"))
        except ObjectMissing:
            doc = {"version": 0, "items": []}
        version = int(doc.get("version", 0))
        if version < self.versions.get(kind, 0):
            return False  # an older snapshot arrived late
        setattr(self, kind, {item["id"]: item for item in doc.get("items") or []})
        self.versions[kind] = version
        log.info("config reloaded", extra={"kind": kind, "items": len(doc.get("items") or [])})
        return True

    def org_rules(self, org_id: str, signal: str | None = None) -> list[dict]:
        return [r for r in self.rules.values() if r["org_id"] == org_id and (signal is None or r["signal"] == signal)]
