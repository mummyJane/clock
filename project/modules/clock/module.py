from __future__ import annotations

from datetime import time

from project.modules.api import ConfigItem, DrawItem, ModuleAPI, ModuleDefinition


CLOCK_MODULE = ModuleDefinition(
    module_id="clock",
    title="Clock",
    description="Primary bedside clock surface.",
)


def register_clock_module(api: ModuleAPI) -> None:
    """Register the built-in clock module against the host API."""

    api.add_config_item(
        ConfigItem(
            key="show_seconds",
            label="Show seconds",
            kind="boolean",
            default=False,
            description="Display seconds in the bedside clock face.",
        )
    )
    api.draw_item(
        DrawItem(
            item_type="text",
            content="clock-face",
            x=64,
            y=64,
            width=320,
            height=160,
            style={"font_size": 96, "align": "center"},
        )
    )
    api.set_alarm(time(hour=7, minute=0), label="Default wake alarm", enabled=False)
    api.set_screen_press_event(_handle_screen_press)


def _handle_screen_press(event: dict[str, object]) -> None:
    event["action"] = "toggle-controls"
