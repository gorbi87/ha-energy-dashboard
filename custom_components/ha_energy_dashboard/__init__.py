"""HA Energy Dashboard — serves static dashboard files via HTTP."""
from pathlib import Path
from homeassistant.core import HomeAssistant

DOMAIN = "ha_energy_dashboard"
WWW_PATH = "/ha-energy-dashboard"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.http.register_static_path(
        WWW_PATH,
        str(Path(__file__).parent / "www"),
        cache_headers=False,
    )
    return True
