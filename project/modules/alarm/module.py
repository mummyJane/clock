from __future__ import annotations

from project.modules.api import ConfigItem, ModuleAPI, ModuleDefinition


ALARM_MODULE = ModuleDefinition(
    module_id="alarm",
    title="Alarm",
    description="Schedule bedside alarms that play audio from the media library.",
)


def register_alarm_module(api: ModuleAPI) -> None:
    """Register the built-in alarm module against the host API."""

    api.add_config_item(
        ConfigItem(
            key="alarms",
            label="Saved alarms",
            kind="list",
            default=[],
            description="Persisted alarm definitions managed through the setup UI.",
        )
    )
