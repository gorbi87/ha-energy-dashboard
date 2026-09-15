"""HA Energy Dashboard — serves static dashboard files via HTTP."""
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.helpers.storage import Store

DOMAIN = "ha_energy_dashboard"
WWW_PATH = "/ha-energy-dashboard"
STORAGE_VERSION = 1
STORAGE_KEY = "ha_energy_dashboard_settings"


class EnergyDashboardSettingsView(HomeAssistantView):
    """Read/write the dashboard's Settings-tab config as one JSON blob."""

    url = "/api/ha_energy_dashboard/settings"
    name = "api:ha_energy_dashboard:settings"
    requires_auth = True

    def __init__(self, store: Store) -> None:
        self._store = store

    async def get(self, request):
        data = await self._store.async_load()
        return self.json(data or {})

    async def post(self, request):
        try:
            data = await request.json()
        except ValueError:
            return self.json_message("Invalid JSON", status_code=400)
        if not isinstance(data, dict):
            return self.json_message("Body must be a JSON object", status_code=400)
        await self._store.async_save(data)
        return self.json({"success": True})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            WWW_PATH,
            str(Path(__file__).parent / "www"),
            cache_headers=False,
        )
    ])

    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.http.register_view(EnergyDashboardSettingsView(store))

    return True
