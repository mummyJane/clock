from __future__ import annotations

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
            key="display_type",
            label="Clock type",
            kind="select",
            default="digital",
            description="Choose whether the bedside clock renders as analog or digital.",
            options=["analog", "digital"],
        )
    )
    api.add_config_item(
        ConfigItem(
            key="hour_mode",
            label="Hour mode",
            kind="select",
            default="24",
            description="Choose whether the clock uses 12-hour or 24-hour time.",
            options=["12", "24"],
        )
    )
    api.add_config_item(
        ConfigItem(
            key="date_format",
            label="Date format",
            kind="select",
            default="dd/mm/yyyy",
            description="Choose how the date is formatted on screen.",
            options=["dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"],
        )
    )
    api.add_config_item(
        ConfigItem(
            key="display_size",
            label="Display size",
            kind="select",
            default="large",
            description="Choose how large the clock appears on screen.",
            options=["small", "medium", "large"],
        )
    )
    api.add_config_item(
        ConfigItem(
            key="screen_position",
            label="Screen position",
            kind="select",
            default="center",
            description="Choose where the clock is positioned on the bedside display.",
            options=[
                "top-left",
                "top-center",
                "top-right",
                "center-left",
                "center",
                "center-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
            ],
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
    api.set_screen_press_event(_handle_screen_press)


def _handle_screen_press(event: dict[str, object]) -> None:
    event["action"] = "toggle-controls"
