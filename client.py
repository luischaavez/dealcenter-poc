"""
ConstructConnect API client with pagination support.
API key is passed as a query parameter per their auth scheme.
"""

import time
import requests
from typing import Iterator
from config import (
    CONSTRUCTCONNECT_API_KEY, CONSTRUCTCONNECT_BASE_URL,
    SEARCH_STATES, SEARCH_DAYS_BACK,
    ACTIVE_STATUSES, TARGET_CC_CATEGORIES, TARGET_VALUE_RANGES,
)


class ConstructConnectClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or CONSTRUCTCONNECT_API_KEY
        if not self.api_key:
            raise ValueError("CONSTRUCTCONNECT_API_KEY not set. Add it to your .env file.")
        self.base_url = CONSTRUCTCONNECT_BASE_URL
        self.session = requests.Session()

    def _build_payload(self, states: list, days_back: int, limit: int, offset: int) -> dict:
        payload = {
            "limit": limit,
            "offset": offset,
            "sort": "lastUpdatedDate",
            "sortDir": "desc",
            "includeAllFacets": False,
            "includeHidden": False,
            "filters": {
                "searchText": "",
                "dates": [{"value": -days_back, "type": "LastUpdatedDate"}],
                "searchTextTarget": "Details",
                "contentType": "CuratedProject, ItbProject",

                # ── API-level pre-filters ───────────────────────────────────
                # Pushed to CC before we download anything. Cuts payload by
                # ~80% vs fetching all projects and filtering client-side.
                #
                # status: only statuses where GC outreach makes sense.
                "status": list(ACTIVE_STATUSES),

                # projectCategory: exclude "Service, Maintenance and Supply"
                # contracts (no physical construction site = no dumpsters).
                "projectCategory": ["Construction"],

                # category: FullTilt target building types, using exact CC
                # taxonomy strings (must match what the API returns in `categories`).
                "category": TARGET_CC_CATEGORIES,

                # projectValueRange: $500K+ OR undisclosed ("Not Available").
                # Using ranges instead of minProjectValue to preserve undisclosed-
                # budget projects — large projects often don't publish a value
                # until GC bidding starts.
                "projectValueRange": TARGET_VALUE_RANGES,
            },
        }
        if states:
            payload["filters"]["states"] = states
        return payload

    def search_page(
        self,
        states: list = None,
        days_back: int = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        """Fetch a single page of project leads."""
        url = f"{self.base_url}/ProjectLeads"
        payload = self._build_payload(
            states=states or SEARCH_STATES,
            days_back=days_back or SEARCH_DAYS_BACK,
            limit=limit,
            offset=offset,
        )
        response = self.session.post(
            url,
            json=payload,
            params={"x-api-key": self.api_key},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def fetch_all(
        self,
        states: list = None,
        days_back: int = None,
        page_size: int = 100,
        max_projects: int = None,
    ) -> Iterator[dict]:
        """
        Paginate through all results, yielding one project at a time.

        Args:
            states: List of state codes to filter by (e.g. ["UT"])
            days_back: Look-back window in days
            page_size: Results per API call (max 100)
            max_projects: Optional hard cap (useful for testing)
        """
        offset = 0
        total = None
        fetched = 0

        while True:
            label = f"{offset}/{total}" if total is not None else f"{offset}/?"
            print(f"  Fetching page offset={label}...")

            data = self.search_page(
                states=states,
                days_back=days_back,
                limit=page_size,
                offset=offset,
            )

            projects = data.get("docs", [])

            if total is None:
                total = data.get("numFound", 0)
                print(f"  Total available: {total:,} projects")

            if not projects:
                break

            for project in projects:
                yield project
                fetched += 1
                if max_projects and fetched >= max_projects:
                    print(f"  Reached max_projects limit ({max_projects})")
                    return

            offset += len(projects)
            if offset >= total:
                break

            time.sleep(0.3)  # Polite delay between pages
