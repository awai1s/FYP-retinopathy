"""Clinic Locator API: small-town friendly nearby + city eye-care discovery.

The locator intentionally avoids paid Places APIs.  It uses key-free OSM
geocoders for live discovery and a very small, explicit sparse-coverage
fallback directory for places that are poorly represented in OSM.  Clinic
cards stay inside the app; tapping a card opens Google Maps by coordinate or
by clinic name/address.

Important design rules:
- do not use Overpass (the public endpoints were timing out in this project)
- keep search geographically bounded so a small-city query does not drift to
  Islamabad/Peshawar/etc.
- prefer clinics/specialists over large hospitals
- city lookup must favour an exact settlement match, not a similarly named
  district/state result
- never store the patient's coordinates/search in MongoDB
- provider failure returns a usable response rather than a 503
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import quote_plus

import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import RoleChecker, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/clinics",
    tags=["Clinic Locator"],
    dependencies=[Depends(RoleChecker(["Patient"]))],
)

PHOTON_URL = "https://photon.komoot.io/api/"
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "DR-Healthcare-FYP/1.2 (eye-clinic-locator; educational-project)"

CACHE_TTL_SECONDS = 20 * 60
CITY_CACHE_TTL_SECONDS = 60 * 60

# Photon is a text geocoder, so multiple phrases matter.  We intentionally do
# NOT append the city name to these phrases; the hard bbox + lat/lon bias is a
# much more reliable way to stop small-city searches drifting to big cities.
EYE_SEARCH_TERMS = (
    "eye clinic",
    "ophthalmology clinic",
    "ophthalmologist",
    "optometrist",
    "eye doctor",
    "vision clinic",
    "retina clinic",
    "eye hospital",
)

# Nominatim is used only when live coverage is thin.  Public Nominatim is not
# a bulk POI database, therefore these are a few explicit user-triggered
# searches, rate-limited and cached.  The square-bracket phrases are supported
# by Nominatim inside a bounded viewbox and help surface smaller POIs.
NOMINATIM_SEARCH_TERMS = (
    "eye clinic",
    "ophthalmologist",
    "optometrist",
    "eye hospital",
)

_cache: dict[str, tuple[float, int, dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_nominatim_lock = threading.Lock()
_last_nominatim_request = 0.0


# ---------------------------------------------------------------------------
# Sparse-coverage fallback
# ---------------------------------------------------------------------------
# Some Pakistani towns have real eye clinics that are easy to find on the web
# but are not consistently represented in OSM geocoders.  The fallback below
# is deliberately small, transparent, and address-based.  It is merged only
# after live provider results, so a live OSM record always wins.
#
# This also makes the app resilient for the project's Attock demo location
# without fabricating coordinates.  Address-only entries open Google Maps by
# name + address and are clearly returned with locationPrecision="address".
SPARSE_CITY_DIRECTORY: dict[str, dict[str, Any]] = {
    "attock": {
        "label": "Attock",
        "center": (33.7667, 72.3667),
        "nearbyRadiusKm": 45.0,
        "aliases": {"attock", "attock city", "attock district", "attock cantt", "attock cantonment"},
        "places": [
            {
                "name": "Laser Eye Clinic",
                "address": "Almadina Plaza, Kamra Road, Attock, Punjab 43600, Pakistan",
                "phone": "+923325629353",
                "websiteUri": "https://www.lasereyeclinic.org/",
                "category": "Eye Clinic",
                "sourceLabel": "Verified local clinic record",
                "directoryPriority": 0,
                "nearbyEligible": True,
            },
            {
                "name": "CMH Attock ENT & Eye Clinic",
                "address": "Attock Cantonment, Attock, Punjab, Pakistan",
                "phone": "+923460659565",
                "category": "Eye Clinic",
                "sourceLabel": "Public local directory record",
                "directoryPriority": 1,
                "nearbyEligible": True,
            },
            {
                "name": "Al-Ain Eye Clinic",
                "address": "Circular Road, Mohalla Azeem Khan, Hazro, Attock District, Punjab, Pakistan",
                "phone": "(057) 2313783",
                "category": "Eye Clinic",
                "sourceLabel": "Public local directory record",
                "directoryPriority": 2,
                "nearbyEligible": True,
            },
            {
                "name": "Al-Basar Eye & Surgical Hospital",
                "address": "Mithial, Attock District, Punjab, Pakistan",
                "phone": "(057) 2631588",
                "category": "Eye Hospital",
                "sourceLabel": "Public local directory record",
                "directoryPriority": 3,
                "nearbyEligible": False,
            },
            {
                "name": "Al-Syed Eye Clinic",
                "address": "Fateh Jang-Kohat Road, Fateh Jang, Attock District, Punjab, Pakistan",
                "phone": "(057) 2210642",
                "category": "Eye Clinic",
                "sourceLabel": "Public local directory record",
                "directoryPriority": 4,
                "nearbyEligible": False,
            },
        ],
    },
}


# ---------------------------------------------------------------------------
# General helpers
# ---------------------------------------------------------------------------
def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\n", " ").split()).strip()


def _normalise_key(value: str) -> str:
    value = re.sub(r"[^a-z0-9 ]+", " ", value.lower())
    return " ".join(value.split())


def _radius_bbox(latitude: float, longitude: float, radius_km: float) -> tuple[float, float, float, float]:
    # Approximation is sufficient for a geocoder filter and keeps small-town
    # results genuinely local.  Longitude degrees shrink with latitude.
    lat_pad = max(0.035, radius_km / 111.0)
    cos_lat = max(0.25, math.cos(math.radians(latitude)))
    lon_pad = max(0.045, radius_km / (111.0 * cos_lat))
    return longitude - lon_pad, latitude - lat_pad, longitude + lon_pad, latitude + lat_pad


def _build_address(properties: dict[str, Any]) -> str:
    display_name = _clean_text(properties.get("display_name"))
    if display_name:
        return display_name

    house = _clean_text(properties.get("housenumber") or properties.get("house_number"))
    street = _clean_text(
        properties.get("street")
        or properties.get("road")
        or properties.get("pedestrian")
        or properties.get("residential")
    )
    locality = _clean_text(
        properties.get("district")
        or properties.get("locality")
        or properties.get("suburb")
        or properties.get("neighbourhood")
    )
    city = _clean_text(
        properties.get("city")
        or properties.get("town")
        or properties.get("village")
        or properties.get("municipality")
    )
    state = _clean_text(properties.get("state"))
    country = _clean_text(properties.get("country"))

    street_line = " ".join(part for part in (house, street) if part)
    pieces: list[str] = []
    for part in (street_line, locality, city, state, country):
        if part and part.lower() not in {item.lower() for item in pieces}:
            pieces.append(part)
    return ", ".join(pieces)


def _searchable_text(name: str, properties: dict[str, Any]) -> str:
    return " ".join(
        [
            name,
            _clean_text(properties.get("type")),
            _clean_text(properties.get("osm_key")),
            _clean_text(properties.get("osm_value")),
            _clean_text(properties.get("category")),
            _clean_text(properties.get("display_name")),
            _clean_text(properties.get("healthcare")),
            _clean_text(properties.get("healthcare:speciality")),
            _clean_text(properties.get("speciality")),
            _clean_text(properties.get("description")),
            _clean_text(properties.get("operator")),
            _clean_text(properties.get("_query_hint")),
        ]
    ).lower()


def _has_eye_signal(text: str) -> bool:
    return any(
        token in text
        for token in (
            "ophthalm",
            "eye",
            "retina",
            "optomet",
            "optician",
            "vision",
            "cataract",
            "ocular",
        )
    )


def _relevance_score(name: str, properties: dict[str, Any]) -> int:
    text = _searchable_text(name, properties)
    score = 0
    for keyword, weight in (
        ("ophthalm", 14),
        ("eye clinic", 14),
        ("eye care", 12),
        ("retina", 11),
        ("optomet", 10),
        ("cataract", 9),
        ("ocular", 8),
        ("vision", 7),
        ("optician", 6),
        ("eye", 7),
        ("clinic", 4),
        ("doctor", 2),
        ("hospital", 2),
    ):
        if keyword in text:
            score += weight
    return score


def _category(name: str, properties: dict[str, Any]) -> str:
    text = _searchable_text(name, properties)
    if "retina" in text:
        return "Retina Clinic"
    if "optomet" in text:
        return "Optometrist"
    if "ophthalm" in text:
        return "Ophthalmologist"
    if "hospital" in text:
        return "Eye Hospital"
    if "vision" in text or "optician" in text:
        return "Vision / Eye Clinic"
    return "Eye Clinic"


def _maps_location_url(latitude: float, longitude: float) -> str:
    query = quote_plus(f"{latitude:.7f},{longitude:.7f}")
    return f"https://www.google.com/maps/search/?api=1&query={query}"


def _maps_search_url(name: str, address: str) -> str:
    query = quote_plus(" ".join(part for part in (name, address) if part))
    return f"https://www.google.com/maps/search/?api=1&query={query}"


def _maps_directions_url(latitude: float | None, longitude: float | None, name: str, address: str) -> str:
    if latitude is not None and longitude is not None:
        destination = quote_plus(f"{latitude:.7f},{longitude:.7f}")
    else:
        destination = quote_plus(" ".join(part for part in (name, address) if part))
    return f"https://www.google.com/maps/dir/?api=1&destination={destination}"


def _normalise_phone(properties: dict[str, Any]) -> str | None:
    phone = _clean_text(
        properties.get("phone")
        or properties.get("contact:phone")
        or properties.get("contact_phone")
    )
    return phone or None


def _normalise_website(properties: dict[str, Any]) -> str | None:
    website = _clean_text(
        properties.get("website")
        or properties.get("contact:website")
        or properties.get("contact_website")
    )
    return website or None


def _normalise_place(
    *,
    source: str,
    source_id: str,
    name: str,
    latitude: float,
    longitude: float,
    address: str,
    properties: dict[str, Any],
    center_lat: float,
    center_lon: float,
    max_distance_km: float,
) -> dict[str, Any] | None:
    name = _clean_text(name)
    if not name:
        return None

    distance = _haversine_km(center_lat, center_lon, latitude, longitude)
    if distance > max_distance_km:
        return None

    text = _searchable_text(name, properties)
    if not _has_eye_signal(text):
        return None

    category = _category(name, properties)
    return {
        "id": f"{source}:{source_id}",
        "name": name,
        "address": address or "Address not available",
        "latitude": latitude,
        "longitude": longitude,
        "distanceKm": round(distance, 1),
        "areaLabel": None,
        "locationPrecision": "coordinate",
        "category": category,
        "specialty": "Ophthalmology / Eye Care",
        "source": source,
        "googleMapsUrl": _maps_location_url(latitude, longitude),
        "googleSearchUrl": _maps_search_url(name, address),
        "directionsUrl": _maps_directions_url(latitude, longitude, name, address),
        "phone": _normalise_phone(properties),
        "websiteUri": _normalise_website(properties),
        "estimatedDriveMinutes": max(2, round(distance * 2.4)),
        "travelTimeIsEstimate": True,
        "openNow": None,
        "openingHours": _clean_text(properties.get("opening_hours")) or None,
        "ownership": "Unknown",
        "ownershipSource": "Not classified",
        "operator": _clean_text(properties.get("operator")) or None,
        "types": [category],
        "relevanceScore": _relevance_score(name, properties),
        "isHospital": category == "Eye Hospital",
    }


# ---------------------------------------------------------------------------
# Live providers
# ---------------------------------------------------------------------------
def _photon_search(
    query: str,
    center_lat: float,
    center_lon: float,
    per_query_limit: int,
    max_distance_km: float,
) -> list[dict[str, Any]]:
    min_lon, min_lat, max_lon, max_lat = _radius_bbox(center_lat, center_lon, max_distance_km)
    params: list[tuple[str, str | int | float]] = [
        ("q", query),
        ("lat", center_lat),
        ("lon", center_lon),
        ("limit", min(max(per_query_limit, 8), 24)),
        ("lang", "en"),
        ("zoom", 13),
        ("location_bias_scale", 0.0),
        ("bbox", f"{min_lon},{min_lat},{max_lon},{max_lat}"),
        ("countrycode", "PK"),
    ]
    response = requests.get(
        PHOTON_URL,
        params=params,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        timeout=(2.5, 5.0),
    )
    response.raise_for_status()
    payload = response.json()

    places: list[dict[str, Any]] = []
    for feature in payload.get("features", []) if isinstance(payload, dict) else []:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except (TypeError, ValueError):
            continue

        props = feature.get("properties") or {}
        properties = dict(props) if isinstance(props, dict) else {}
        osm_value = _clean_text(properties.get("osm_value")).lower()
        if query in {"ophthalmologist", "optometrist", "ophthalmology clinic", "eye doctor"} and osm_value in {
            "doctor",
            "doctors",
            "clinic",
            "medical",
        }:
            # Small practices are often named only after the doctor.  A hit
            # from a specialist query is valid evidence of eye-care relevance.
            properties["_query_hint"] = query

        name = properties.get("name") or properties.get("locality")
        osm_type = _clean_text(properties.get("osm_type")) or "place"
        osm_id = _clean_text(properties.get("osm_id")) or f"{lat:.6f},{lon:.6f}"
        place = _normalise_place(
            source="OpenStreetMap",
            source_id=f"{osm_type}:{osm_id}",
            name=str(name or ""),
            latitude=lat,
            longitude=lon,
            address=_build_address(properties),
            properties=properties,
            center_lat=center_lat,
            center_lon=center_lon,
            max_distance_km=max_distance_km,
        )
        if place:
            places.append(place)
    return places


def _nominatim_get(params: dict[str, Any]) -> requests.Response:
    """Use public Nominatim politely: serialized and <= 1 request/second."""
    global _last_nominatim_request
    with _nominatim_lock:
        elapsed = time.monotonic() - _last_nominatim_request
        if elapsed < 1.05:
            time.sleep(1.05 - elapsed)
        response = requests.get(
            NOMINATIM_URL,
            params=params,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=(2.5, 6.0),
        )
        _last_nominatim_request = time.monotonic()
        return response


def _nominatim_query_to_places(
    *,
    query: str,
    center_lat: float,
    center_lon: float,
    max_distance_km: float,
    limit: int,
) -> list[dict[str, Any]]:
    min_lon, min_lat, max_lon, max_lat = _radius_bbox(center_lat, center_lon, max_distance_km)
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "extratags": 1,
        "namedetails": 1,
        "limit": min(max(limit, 10), 40),
        "bounded": 1,
        "countrycodes": "pk",
        "layer": "poi",
        "viewbox": f"{min_lon},{max_lat},{max_lon},{min_lat}",
    }
    response = _nominatim_get(params)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        return []

    places: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            lat = float(item.get("lat"))
            lon = float(item.get("lon"))
        except (TypeError, ValueError):
            continue

        properties: dict[str, Any] = {
            **(item.get("address") or {}),
            **(item.get("extratags") or {}),
            "display_name": item.get("display_name"),
            "type": item.get("type"),
            "category": item.get("category"),
            "_query_hint": query,
        }
        namedetails = item.get("namedetails") or {}
        name = (
            (namedetails.get("name") if isinstance(namedetails, dict) else None)
            or item.get("name")
            or str(item.get("display_name") or "").split(",")[0]
        )
        source_id = f"{item.get('osm_type', 'place')}:{item.get('osm_id', item.get('place_id', 'unknown'))}"
        place = _normalise_place(
            source="OpenStreetMap",
            source_id=source_id,
            name=str(name or ""),
            latitude=lat,
            longitude=lon,
            address=_clean_text(item.get("display_name")),
            properties=properties,
            center_lat=center_lat,
            center_lon=center_lon,
            max_distance_km=max_distance_km,
        )
        if place:
            places.append(place)
    return places


def _nominatim_fallback_search(
    *,
    center_lat: float,
    center_lon: float,
    limit: int,
    max_distance_km: float,
    stop_after: int = 8,
) -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for query in NOMINATIM_SEARCH_TERMS:
        try:
            places.extend(
                _nominatim_query_to_places(
                    query=query,
                    center_lat=center_lat,
                    center_lon=center_lon,
                    max_distance_km=max_distance_km,
                    limit=max(12, limit),
                )
            )
        except Exception as exc:
            logger.warning("[CLINICS] Nominatim search failed for '%s': %s", query, exc)
        if len(_dedupe_places(places)) >= stop_after:
            break
    return places


# ---------------------------------------------------------------------------
# City / locality resolution
# ---------------------------------------------------------------------------
def _city_candidate_score(requested_city: str, props: dict[str, Any]) -> tuple[int, int, int]:
    requested = _normalise_key(requested_city)
    candidate_values = [
        _clean_text(props.get("name")),
        _clean_text(props.get("city")),
        _clean_text(props.get("town")),
        _clean_text(props.get("village")),
        _clean_text(props.get("municipality")),
        _clean_text(props.get("locality")),
        _clean_text(props.get("district")),
        _clean_text(props.get("county")),
    ]
    keys = [_normalise_key(item) for item in candidate_values if item]
    exact = 0 if requested in keys else 1
    starts = 0 if any(key.startswith(requested) or requested.startswith(key) for key in keys if key) else 1
    ptype = _clean_text(props.get("type")).lower()
    settlement_priority = 0 if ptype in {"city", "town", "village", "municipality", "locality", "district"} else 1
    return exact, starts, settlement_priority


def _resolve_city_with_photon(city: str) -> tuple[float, float, str] | None:
    params: list[tuple[str, str | int]] = [
        ("q", f"{city}, Pakistan"),
        ("limit", 10),
        ("lang", "en"),
        ("countrycode", "PK"),
    ]
    response = requests.get(
        PHOTON_URL,
        params=params,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        timeout=(2.5, 5.0),
    )
    response.raise_for_status()
    payload = response.json()
    features = payload.get("features", []) if isinstance(payload, dict) else []
    if not isinstance(features, list):
        return None

    candidates: list[tuple[tuple[int, int, int], dict[str, Any]]] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if not isinstance(props, dict) or not isinstance(coords, list) or len(coords) < 2:
            continue
        candidates.append((_city_candidate_score(city, props), feature))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    feature = candidates[0][1]
    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (TypeError, ValueError, IndexError):
        return None
    label = _clean_text(
        props.get("name")
        or props.get("city")
        or props.get("town")
        or props.get("village")
        or props.get("locality")
        or city
    )
    return lat, lon, label or city


def _resolve_city_with_nominatim(city: str) -> tuple[float, float, str] | None:
    # Structured search is more reliable for smaller settlements than treating
    # the city name as a generic free-text POI query.
    params = {
        "city": city,
        "country": "Pakistan",
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 5,
        "countrycodes": "pk",
        "featureType": "settlement",
    }
    response = _nominatim_get(params)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list) or not payload:
        # Some smaller places are tagged as a district/town rather than a
        # Nominatim 'city'.  Free-form settlement lookup is a safe fallback.
        params = {
            "q": f"{city}, Pakistan",
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 5,
            "countrycodes": "pk",
            "featureType": "settlement",
        }
        response = _nominatim_get(params)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list) or not payload:
            return None

    requested = _normalise_key(city)
    scored: list[tuple[tuple[int, int], dict[str, Any]]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        address = item.get("address") or {}
        labels = [
            _clean_text(address.get("city")),
            _clean_text(address.get("town")),
            _clean_text(address.get("village")),
            _clean_text(address.get("municipality")),
            _clean_text(address.get("county")),
            _clean_text(str(item.get("display_name") or "").split(",")[0]),
        ]
        keys = [_normalise_key(label) for label in labels if label]
        exact = 0 if requested in keys else 1
        prefix = 0 if any(key.startswith(requested) or requested.startswith(key) for key in keys if key) else 1
        scored.append(((exact, prefix), item))

    if not scored:
        return None
    scored.sort(key=lambda item: item[0])
    item = scored[0][1]
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    address = item.get("address") or {}
    label = _clean_text(
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or str(item.get("display_name") or "").split(",")[0]
        or city
    )
    return lat, lon, label or city


def _resolve_city(city: str) -> tuple[float, float, str] | None:
    # First respect explicit sparse-directory aliases so a known small town is
    # never mistaken for a district or similarly named place.
    requested_key = _normalise_key(city)
    for key, meta in SPARSE_CITY_DIRECTORY.items():
        aliases = {_normalise_key(alias) for alias in meta.get("aliases", set())}
        if requested_key == key or requested_key in aliases:
            lat, lon = meta["center"]
            return float(lat), float(lon), str(meta.get("label") or city)

    try:
        result = _resolve_city_with_photon(city)
        if result:
            return result
    except Exception as exc:
        logger.warning("[CLINICS] Photon city lookup failed for '%s': %s", city, exc)

    try:
        return _resolve_city_with_nominatim(city)
    except Exception as exc:
        logger.warning("[CLINICS] Nominatim city lookup failed for '%s': %s", city, exc)
        return None


def _reverse_locality_with_photon(latitude: float, longitude: float) -> str | None:
    try:
        response = requests.get(
            PHOTON_REVERSE_URL,
            params={"lat": latitude, "lon": longitude, "limit": 1, "lang": "en"},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=(2.0, 4.0),
        )
        response.raise_for_status()
        payload = response.json()
        features = payload.get("features", []) if isinstance(payload, dict) else []
        if not features:
            return None
        props = features[0].get("properties") or {}
        return _clean_text(
            props.get("city")
            or props.get("town")
            or props.get("village")
            or props.get("district")
            or props.get("county")
            or props.get("name")
        ) or None
    except Exception as exc:
        logger.info("[CLINICS] Reverse locality lookup skipped: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Sparse-directory merging
# ---------------------------------------------------------------------------
def _directory_keys_for_city(city_text: str) -> list[str]:
    requested = _normalise_key(city_text)
    matches: list[str] = []
    for key, meta in SPARSE_CITY_DIRECTORY.items():
        aliases = {_normalise_key(alias) for alias in meta.get("aliases", set())}
        if requested == key or requested in aliases or key in requested:
            matches.append(key)
    return matches


def _directory_keys_for_nearby(latitude: float, longitude: float, locality: str | None) -> list[str]:
    matches = set(_directory_keys_for_city(locality or ""))
    for key, meta in SPARSE_CITY_DIRECTORY.items():
        center_lat, center_lon = meta["center"]
        if _haversine_km(latitude, longitude, float(center_lat), float(center_lon)) <= float(
            meta.get("nearbyRadiusKm", 35.0)
        ):
            matches.add(key)
    return list(matches)


def _directory_places(
    keys: list[str], *, area_label: str, nearby_only: bool = False
) -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for key in keys:
        meta = SPARSE_CITY_DIRECTORY.get(key) or {}
        for index, item in enumerate(meta.get("places", [])):
            if nearby_only and not bool(item.get("nearbyEligible", True)):
                continue
            name = _clean_text(item.get("name"))
            address = _clean_text(item.get("address"))
            if not name:
                continue
            category = _clean_text(item.get("category")) or "Eye Clinic"
            places.append(
                {
                    "id": f"directory:{key}:{index}:{_normalise_key(name).replace(' ', '-')}",
                    "name": name,
                    "address": address or f"{area_label}, Pakistan",
                    "latitude": None,
                    "longitude": None,
                    "distanceKm": None,
                    "areaLabel": _clean_text(meta.get("label")) or area_label,
                    "locationPrecision": "address",
                    "category": category,
                    "specialty": "Ophthalmology / Eye Care",
                    "source": _clean_text(item.get("sourceLabel")) or "Local clinic directory",
                    "googleMapsUrl": _maps_search_url(name, address),
                    "googleSearchUrl": _maps_search_url(name, address),
                    "directionsUrl": _maps_directions_url(None, None, name, address),
                    "phone": _clean_text(item.get("phone")) or None,
                    "websiteUri": _clean_text(item.get("websiteUri")) or None,
                    "estimatedDriveMinutes": None,
                    "travelTimeIsEstimate": False,
                    "openNow": None,
                    "openingHours": None,
                    "ownership": "Unknown",
                    "ownershipSource": "Not classified",
                    "operator": None,
                    "types": [category],
                    "relevanceScore": 40 if category != "Eye Hospital" else 30,
                    "isHospital": category == "Eye Hospital",
                    "directoryPriority": int(item.get("directoryPriority", 50)),
                }
            )
    return places


# ---------------------------------------------------------------------------
# Ranking / search orchestration
# ---------------------------------------------------------------------------
def _dedupe_places(places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for place in places:
        name_key = _normalise_key(str(place.get("name", "")))
        address_key = _normalise_key(str(place.get("address", "")))
        lat = place.get("latitude")
        lon = place.get("longitude")
        coord_key = ""
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            coord_key = f"{float(lat):.4f},{float(lon):.4f}"

        # Name-based dedupe intentionally lets a live OSM record replace a
        # directory fallback for the same clinic.
        key = name_key or f"{address_key}|{coord_key}"
        existing = best.get(key)
        if existing is None:
            best[key] = place
            continue

        existing_live = existing.get("locationPrecision") == "coordinate"
        new_live = place.get("locationPrecision") == "coordinate"
        if new_live and not existing_live:
            best[key] = place
            continue
        if new_live == existing_live and int(place.get("relevanceScore", 0)) > int(existing.get("relevanceScore", 0)):
            best[key] = place
    return list(best.values())


def _rank_diverse(places: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    # Work on copies so removing internal ranking fields from the API response
    # never mutates the raw provider list used by a later fallback merge.
    unique = [dict(item) for item in _dedupe_places(places)]

    def distance_key(item: dict[str, Any]) -> float:
        value = item.get("distanceKm")
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            return float(value)
        # Address-only directory records have no honest distance. Keep their
        # curated local order instead of inventing coordinates.
        return 9000.0 + (float(item.get("directoryPriority", 50)) / 100.0)

    clinics = sorted(
        [item for item in unique if not item.get("isHospital")],
        key=lambda item: (
            distance_key(item),
            -int(item.get("relevanceScore", 0)),
            str(item.get("name", "")).lower(),
        ),
    )
    hospitals = sorted(
        [item for item in unique if item.get("isHospital")],
        key=lambda item: (
            distance_key(item),
            -int(item.get("relevanceScore", 0)),
            str(item.get("name", "")).lower(),
        ),
    )

    clinic_target = max(1, math.ceil(limit * 0.75))
    selected = clinics[:clinic_target]
    remaining = limit - len(selected)
    selected.extend(hospitals[:remaining])

    if len(selected) < limit:
        used_ids = {item["id"] for item in selected}
        leftovers = [item for item in clinics[clinic_target:] + hospitals if item["id"] not in used_ids]
        leftovers.sort(key=lambda item: (distance_key(item), -int(item.get("relevanceScore", 0))))
        selected.extend(leftovers[: limit - len(selected)])

    selected.sort(
        key=lambda item: (
            distance_key(item),
            1 if item.get("isHospital") else 0,
            -int(item.get("relevanceScore", 0)),
        )
    )
    for place in selected:
        place.pop("relevanceScore", None)
        place.pop("isHospital", None)
        place.pop("directoryPriority", None)
    return selected[:limit]


def _search_eye_care(
    *,
    center_lat: float,
    center_lon: float,
    limit: int,
    max_distance_km: float,
    directory_places: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    places: list[dict[str, Any]] = []
    warnings: list[str] = []

    # Photon queries are independent and fast enough to run concurrently.
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(
                _photon_search,
                term,
                center_lat,
                center_lon,
                max(10, min(limit, 18)),
                max_distance_km,
            ): term
            for term in EYE_SEARCH_TERMS
        }
        for future in as_completed(futures):
            term = futures[future]
            try:
                places.extend(future.result())
            except Exception as exc:
                logger.warning("[CLINICS] Photon search failed for '%s': %s", term, exc)
                warnings.append(f"photon:{term}")

    live_ranked = _rank_diverse(list(places), limit)

    # Small towns often have sparse text-geocoder coverage.  A few bounded,
    # rate-limited Nominatim searches help recover small POIs.  We only do this
    # when Photon did not already give a healthy list.
    if len(live_ranked) < min(8, limit):
        nominatim_places = _nominatim_fallback_search(
            center_lat=center_lat,
            center_lon=center_lon,
            limit=limit,
            max_distance_km=max_distance_km,
            stop_after=min(8, limit),
        )
        places.extend(nominatim_places)

    if directory_places:
        places.extend(directory_places)

    return _rank_diverse(places, limit), warnings


# ---------------------------------------------------------------------------
# Cache / URL helpers
# ---------------------------------------------------------------------------
def _cache_get(key: str) -> dict[str, Any] | None:
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if not cached:
            return None
        created_at, ttl, payload = cached
        if now - created_at > ttl:
            _cache.pop(key, None)
            return None
        return payload


def _cache_put(key: str, payload: dict[str, Any], ttl: int = CACHE_TTL_SECONDS) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic(), ttl, payload)
        if len(_cache) > 250:
            oldest_key = min(_cache.items(), key=lambda item: item[1][0])[0]
            _cache.pop(oldest_key, None)


def _fallback_maps_url(query: str) -> str:
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(query)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@router.get("/nearby")
def get_nearby_clinics(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    limit: int = Query(default=18, ge=1, le=30),
    # Compatibility params retained so older frontend builds do not break.
    radius: int | None = Query(default=None, ge=500, le=100000),
    ownership: str | None = Query(default=None),
    open_now: bool | None = Query(default=None),
    local_weekday: int | None = Query(default=None, ge=0, le=6),
    local_minutes: int | None = Query(default=None, ge=0, le=1439),
    current_user: dict = Depends(get_current_user),
):
    del radius, ownership, open_now, local_weekday, local_minutes

    cache_key = f"near:v2:{round(latitude, 3)}:{round(longitude, 3)}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    locality = _reverse_locality_with_photon(latitude, longitude)
    directory_keys = _directory_keys_for_nearby(latitude, longitude, locality)
    local_label = locality or (SPARSE_CITY_DIRECTORY.get(directory_keys[0], {}).get("label") if directory_keys else "Near you")
    directory = _directory_places(
        directory_keys, area_label=str(local_label or "Near you"), nearby_only=True
    )

    # 32 km is local enough for a "near me" screen but wide enough for a
    # smaller Pakistani city where specialist care may be in a neighbouring
    # town.  Directory entries without coordinates are shown as area records,
    # not given a fake distance.
    ranked, warnings = _search_eye_care(
        center_lat=latitude,
        center_lon=longitude,
        limit=limit,
        max_distance_km=32.0,
        directory_places=directory,
    )

    payload = {
        "clinics": ranked,
        "count": len(ranked),
        "searchMode": "nearby",
        "searchLabel": locality or "Near you",
        "searchCenter": {"latitude": latitude, "longitude": longitude},
        "source": "OpenStreetMap + local fallback",
        "cached": False,
        "partial": bool(warnings),
        "message": (
            "Nearby eye clinics and specialists loaded."
            if ranked
            else "No clinic cards were returned right now."
        ),
        "googleMapsFallbackUrl": _fallback_maps_url(
            f"eye clinic ophthalmologist near {latitude:.6f},{longitude:.6f}"
        ),
        "attribution": "Clinic data from OpenStreetMap and public local clinic records",
    }
    _cache_put(cache_key, payload)
    logger.info(
        "[CLINICS] Returned %d nearby eye-care places for patient %s (locality=%s, directory=%s)",
        len(ranked),
        current_user.get("_id", "unknown"),
        locality,
        directory_keys,
    )
    return payload


@router.get("/search")
def search_clinics_by_city(
    city: str = Query(..., min_length=2, max_length=80),
    limit: int = Query(default=24, ge=1, le=30),
    current_user: dict = Depends(get_current_user),
):
    city = _clean_text(city)
    if len(city) < 2:
        raise HTTPException(status_code=400, detail="Please enter a city name.")

    cache_key = f"city:v2:{_normalise_key(city)}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    resolved = _resolve_city(city)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"We couldn't find the city '{city}'. Check the spelling and try again.",
        )

    center_lat, center_lon, city_label = resolved
    directory_keys = _directory_keys_for_city(city) + [
        key for key in _directory_keys_for_city(city_label) if key not in _directory_keys_for_city(city)
    ]
    directory = _directory_places(directory_keys, area_label=city_label)

    # Keep the live search geographically tight.  The previous ~55 km box was
    # one reason small-city searches could be dominated by larger cities.
    ranked, warnings = _search_eye_care(
        center_lat=center_lat,
        center_lon=center_lon,
        limit=limit,
        max_distance_km=28.0,
        directory_places=directory,
    )

    payload = {
        "clinics": ranked,
        "count": len(ranked),
        "searchMode": "city",
        "searchLabel": city_label,
        "city": city_label,
        "searchCenter": {"latitude": center_lat, "longitude": center_lon},
        "source": "OpenStreetMap + local fallback",
        "cached": False,
        "partial": bool(warnings),
        "message": (
            f"Eye clinics and specialists in {city_label} loaded."
            if ranked
            else f"No clinic cards were returned for {city_label} right now."
        ),
        "googleMapsFallbackUrl": _fallback_maps_url(
            f"eye clinic ophthalmologist in {city_label}, Pakistan"
        ),
        "attribution": "Clinic data from OpenStreetMap and public local clinic records",
    }
    _cache_put(cache_key, payload, ttl=CITY_CACHE_TTL_SECONDS)
    logger.info(
        "[CLINICS] Returned %d eye-care places for city '%s' (requested='%s', patient=%s, directory=%s)",
        len(ranked),
        city_label,
        city,
        current_user.get("_id", "unknown"),
        directory_keys,
    )
    return payload
