"""HA Energy Dashboard — serves static dashboard files via HTTP."""
from pathlib import Path
from homeassistant.core import HomeAssistant
from homeassistant.components.http import StaticPathConfig

DOMAIN = "ha_energy_dashboard"
WWW_PATH = "/ha-energy-dashboard"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            WWW_PATH,
            str(Path(__file__).parent / "www"),
            cache_headers=False,
        )
    ])
    return True
