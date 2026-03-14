from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time
from typing import Any, Callable
from zoneinfo import ZoneInfo


@dataclass(slots=True)
class ConfigItem:
    key: str
    label: str
    kind: str
    default: Any
    description: str = ""
    options: list[str] = field(default_factory=list)


@dataclass(slots=True)
class DrawItem:
    item_type: str
    content: str
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0
    style: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Alarm:
    alarm_id: str
    when: str
    label: str
    enabled: bool = True


@dataclass(slots=True)
class ModuleDefinition:
    module_id: str
    title: str
    description: str


ScreenPressHandler = Callable[[dict[str, Any]], None]


class ModuleAPI:
    """Standard-library host API exposed to bedside modules."""

    def __init__(self, module: ModuleDefinition, timezone_name: str = "UTC") -> None:
        self.module = module
        self.timezone_name = timezone_name
        self._config_items: dict[str, ConfigItem] = {}
        self._draw_items: list[DrawItem] = []
        self._alarms: list[Alarm] = []
        self._screen_press_handler: ScreenPressHandler | None = None

    def read_time(self) -> time:
        return datetime.now(self._timezone()).timetz().replace(tzinfo=None)

    def read_date(self) -> date:
        return datetime.now(self._timezone()).date()

    def set_alarm(self, when: time, label: str = "", enabled: bool = True) -> Alarm:
        alarm = Alarm(
            alarm_id=f"{self.module.module_id}-{len(self._alarms) + 1}",
            when=when.isoformat(timespec="minutes"),
            label=label[:64],
            enabled=enabled,
        )
        self._alarms.append(alarm)
        return alarm

    def add_config_item(self, item: ConfigItem) -> ConfigItem:
        self._config_items[item.key] = item
        return item

    def draw_item(self, item: DrawItem) -> DrawItem:
        self._draw_items.append(item)
        return item

    def set_screen_press_event(self, handler: ScreenPressHandler) -> None:
        self._screen_press_handler = handler

    def handle_screen_press(self, x: int, y: int, pressed_at: datetime | None = None) -> bool:
        if self._screen_press_handler is None:
            return False
        self._screen_press_handler(
            {
                "x": x,
                "y": y,
                "pressed_at": (pressed_at or datetime.now(self._timezone())).isoformat(),
            }
        )
        return True

    def export_state(self) -> dict[str, Any]:
        return {
            "module": asdict(self.module),
            "time": self.read_time().isoformat(timespec="seconds"),
            "date": self.read_date().isoformat(),
            "config_items": [asdict(item) for item in self._config_items.values()],
            "draw_items": [asdict(item) for item in self._draw_items],
            "alarms": [asdict(item) for item in self._alarms],
            "has_screen_press_handler": self._screen_press_handler is not None,
        }

    def _timezone(self) -> ZoneInfo:
        return ZoneInfo(self.timezone_name)


class ModuleHost:
    """Simple module runtime scaffold for registration and inspection."""

    def __init__(self, timezone_name: str = "UTC") -> None:
        self.timezone_name = timezone_name
        self._modules: dict[str, ModuleAPI] = {}

    def register(self, module_definition: ModuleDefinition, register_fn: Callable[[ModuleAPI], None]) -> ModuleAPI:
        api = ModuleAPI(module_definition, timezone_name=self.timezone_name)
        register_fn(api)
        self._modules[module_definition.module_id] = api
        return api

    def get_module(self, module_id: str) -> ModuleAPI:
        return self._modules[module_id]

    def export_state(self) -> dict[str, Any]:
        return {module_id: api.export_state() for module_id, api in self._modules.items()}
