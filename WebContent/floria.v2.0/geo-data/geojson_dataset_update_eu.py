"""
Generates the EU/European geometry files consumed by the Quick Insights "Geographic Hotspots"
choropleth (CohortViz.doGeoMap / FloriaCharts2.addChoropleth) once cohort geo data has been
remapped US-state/county -> EU-country/NUTS2-region via us_to_eu_socioeconomic_crosswalk.json.

Sibling of geojson_dataset_update.py (which does the same job for the USA), kept SEPARATE
rather than folded into it because the source API and raw property schema are completely
different (US Census/opendatasoft ste_code/coty_code vs. Eurostat/GISCO NUTS_ID/CNTR_CODE) --
sharing one script would mean branching on schema everywhere rather than actually reusing logic.

UNLIKE the crosswalk-driven approach originally sketched here, this pulls the FULL geometry set
GISCO publishes -- every NUTS country/region, i.e. all EU members plus the EFTA/candidate
countries GISCO also includes (UK, Norway, Switzerland, Iceland, Liechtenstein, Balkan
candidates, Turkey, etc.) -- rather than filtering down to just the ~10 countries the crosswalk
currently references. Rationale: this is run at most once a year and then treated as static
content (like ./USA/ itself), so there's no meaningful cost to generating the full set now
instead of re-running the script every time the crosswalk grows to cover another state/country.
The crosswalk itself still only USES 10 of these at runtime -- this script no longer needs to
know or care what the crosswalk contains.

Output layout mirrors ./USA/ exactly, using "EU" as a sibling top-level "country" folder so
FloriaCharts2.addChoropleth's existing URL scheme needs NO changes:
  EU/EU_states.json                 <- outlines of every country GISCO publishes ("states"
                                        grain; matched in module-charts2.js by properties.stc)
  EU/<countryCode>/<countryCode>_counties.json
                                     <- NUTS2 region polygons for that country ("counties"
                                        grain; matched by properties.cn[0])

The only change needed on the JS side is making CohortViz.doGeoMap's hardcoded "USA" country
argument configurable (opts.country || "USA") so geo-hotspots.js can pass country: 'EU'.

Data source: Eurostat/GISCO's public NUTS geojson distribution (the EU analogue of the US
Census TIGER files the USA script pulls from opendatasoft). Verify/adjust GISCO_YEAR /
GISCO_RESOLUTION below against https://gisco-services.ec.europa.eu/distribution/v2/nuts/ if
this ever 404s -- GISCO periodically rotates the published dataset year.
"""
import json
import os
import re
import shutil
from pathlib import Path

import requests

# ── GISCO NUTS geojson distribution ─────────────────────────────────────────────────────────
GISCO_YEAR       = "2024"
GISCO_RESOLUTION = "20M"   # 20M = 1:20 million, plenty for a choropleth this zoomed-out; the
                           # USA script similarly favors small file size over survey-grade detail.
GISCO_EPSG       = "4326"  # plain lat/lon, same CRS as the USA geometry files.
GISCO_BASE       = f"https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson"

def _gisco_url(level):
    return f"{GISCO_BASE}/NUTS_RG_{GISCO_RESOLUTION}_{GISCO_YEAR}_{GISCO_EPSG}_LEVL_{level}.geojson"

OUT_DIR = "EU"

# ── UK supplement ────────────────────────────────────────────────────────────────────────────
# Since Brexit, the UK no longer participates in Eurostat's NUTS classification AT ALL -- it
# publishes its own domestic equivalent, ITL (International Territorial Levels), maintained by
# the ONS instead of Eurostat/GISCO. That's WHY the GISCO fetch above never returns a UK/GB
# feature (confirmed: a real run of this script came back with Norway and Switzerland but no
# UK) -- it's not a missing filter, GISCO's NUTS dataset structurally excludes the UK now. ITL2
# sits on the exact same boundaries the UK's NUTS2 regions had before it left NUTS, so it's the
# correct "counties"-grain analogue and slots into the same per-country file shape.
#
# NOTE: ONS periodically rotates these ArcGIS Hub service names to a new "vintage year" suffix
# (confirmed live 2026-08-30: the org id ESMARspQHYMw9BZ9 was already correct, but the specific
# service names below had moved on from earlier guesses). This fetch is still wrapped in its
# own try/except with verbose diagnostics so a future rotation fails loudly and in isolation,
# without affecting the EU/GISCO output above. To find the current name when this 400s again:
#   python -c "import requests; r=requests.get('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services', params={'f':'json'}); print([s['name'] for s in r.json()['services'] if 'ITL2' in s['name'] or 'Countries_' in s['name']])"
# then pick the newest "UK_BUC" (not "GB_BUC" -- GB excludes Northern Ireland) variant.
UK_COUNTRY_CODE = "UK"
# Confirmed live against the ONS ArcGIS org's own service catalog (services1.arcgis.com/
# ESMARspQHYMw9BZ9/arcgis/rest/services?f=json) on 2026-08-30 -- ONS rotates these to a new
# "vintage year" suffix periodically (e.g. was "..._2022", now "..._2025"), so if this 400s
# again in the future, re-run that same catalog query and grep for "Countries_" / "ITL2_" to
# find the current name, rather than guessing. "UK_BUC" (not "GB_BUC") specifically -- GB
# excludes Northern Ireland, UK doesn't.
UK_COUNTRY_URL  = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Countries_December_2025_Boundaries_UK_BUC/FeatureServer/0/query"
UK_ITL2_URL     = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/ITL2_JAN_2025_UK_BUC/FeatureServer/0/query"


def fetch_arcgis_geojson(url):
    resp = requests.get(url, params={"where": "1=1", "outFields": "*", "f": "geojson", "outSR": "4326"}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def _find_prop(props, pattern):
    """ONS ArcGIS layers suffix field names with a vintage year (e.g. CTRY22CD, ITL225CD), which
       changes whenever they republish -- match by regex instead of a hardcoded exact field name
       so a routine ONS vintage bump doesn't silently break this."""
    rx = re.compile(pattern)
    for k, v in props.items():
        if rx.match(k):
            return v
    return None


# ── geometry helpers (kept dependency-free -- no shapely -- to match the USA script's
#    minimal-dependency style; GISCO features don't ship a ready-made centroid the way the
#    opendatasoft USA datasets do via geo_point_2d, so we compute one ourselves) ─────────────
def _ring_centroid(ring):
    """Area-weighted centroid of a single linear ring [[lon,lat], ...] via the shoelace formula."""
    area = cx = cy = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5
    if abs(area) < 1e-12:
        # Degenerate/very thin ring: fall back to a plain average of its points.
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx /= (6 * area)
    cy /= (6 * area)
    return cx, cy


def _largest_ring(coordinates, geom_type):
    """Returns the outer ring of the largest polygon in a Polygon/MultiPolygon, by |signed area|,
       so a country/region made of many small islands centers on its mainland, not an island."""
    polys = coordinates if geom_type == "MultiPolygon" else [coordinates]
    best_ring, best_area = None, -1.0
    for poly in polys:
        ring = poly[0]  # outer ring only; holes don't matter for a centroid estimate.
        area = abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
                        for i in range(len(ring))))
        if area > best_area:
            best_area, best_ring = area, ring
    return best_ring


def centroid_of(geometry):
    ring = _largest_ring(geometry["coordinates"], geometry["type"])
    lon, lat = _ring_centroid(ring)
    return round(lat, 4), round(lon, 4)


def solve(layer):
    """Same coordinate-rounding pass as geojson_dataset_update.py's solve(), trimming payload
       size (this level of precision is already far more than a zoomed-out choropleth needs)."""
    for i in range(len(layer)):
        if isinstance(layer[i][0][0], list):
            solve(layer[i])
        else:
            for j in range(len(layer[i])):
                layer[i][j] = [round(layer[i][j][0], 4), round(layer[i][j][1], 4)]


def fetch_geojson(level):
    print(f"Fetching GISCO NUTS LEVL_{level} ...")
    resp = requests.get(_gisco_url(level))
    resp.raise_for_status()
    return resp.json()


def _country_name(props):
    # GISCO LEVL_0 features carry the country's own name under NUTS_NAME/NAME_LATN (their NUTS
    # "region" name at level 0 IS the country name). Fall back to the raw code if neither is
    # present so generation never hard-fails on a schema quirk for one country.
    return props.get("NAME_LATN") or props.get("NUTS_NAME") or props.get("CNTR_CODE") or props.get("NUTS_ID")


def main():
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)

    # ── Country-level ("states" grain) -- EVERY country GISCO publishes, not just the 10 the
    # crosswalk currently references. GISCO's NUTS distribution covers the EU27 plus the
    # EFTA/candidate countries it also maintains NUTS-equivalent geometry for (UK, Norway,
    # Switzerland, Iceland, Liechtenstein, Turkey, Balkan candidates, etc.) -- i.e. essentially
    # "Europe", not just the political EU, which is exactly what was asked for. ─────────────
    levl0 = fetch_geojson(0)
    out_states = {"type": "FeatureCollection", "features": []}
    country_names = {}   # isoCode -> name, reused below to label region files.
    for f in levl0["features"]:
        props = f["properties"]
        code = props.get("CNTR_CODE") or props.get("NUTS_ID")
        if code is None:
            continue
        country_names[code] = _country_name(props)
        solve(f["geometry"]["coordinates"])
        lat, lng = centroid_of(f["geometry"])
        out_states["features"].append({
            "type": "Feature",
            "geometry": f["geometry"],
            # stc = the SAME property key module-charts2.js's _mergeAndcalculateBounds already
            # matches on for the "states" grain -- see the header note above. "s" carries the
            # name too, mirroring the USA script's own ste_code/ste_name -> s:[code,name] shape.
            "properties": {"stc": code, "s": [code, country_names[code]], "latlng": [lat, lng]}
        })
    with open(Path(OUT_DIR, "EU_states.json"), "wb") as fp:
        fp.write(json.dumps(out_states, separators=(",", ":")).encode("utf-8"))
    print(f"  wrote EU_states.json ({len(out_states['features'])} countries)")

    # ── Region-level ("counties" grain), one file per country, every NUTS2 region GISCO has ──
    levl2 = fetch_geojson(2)
    by_country = {}
    for f in levl2["features"]:
        props = f["properties"]
        cntr  = props.get("CNTR_CODE")
        nuts2 = props.get("NUTS_ID")
        name  = props.get("NUTS_NAME") or props.get("NAME_LATN") or nuts2
        if cntr is None or nuts2 is None:
            continue
        solve(f["geometry"]["coordinates"])
        lat, lng = centroid_of(f["geometry"])
        by_country.setdefault(cntr, {"type": "FeatureCollection", "features": []})
        by_country[cntr]["features"].append({
            "type": "Feature",
            "geometry": f["geometry"],
            # cn = [code, name], the SAME shape/key module-charts2.js matches on (properties.cn[0])
            # for the "counties" grain.
            "properties": {"cn": [nuts2, name], "latlng": [lat, lng]}
        })

    for cc, fc in by_country.items():
        Path(OUT_DIR, cc).mkdir(exist_ok=True)
        with open(Path(OUT_DIR, cc, f"{cc}_counties.json"), "wb") as fp:
            fp.write(json.dumps(fc, separators=(",", ":")).encode("utf-8"))
        print(f"  wrote {cc}/{cc}_counties.json ({len(fc['features'])} regions)")

    # ── UK supplement -- see the header note above on why GISCO can't provide this ───────────
    try:
        print("Fetching ONS UK country boundary ...")
        uk_country = fetch_arcgis_geojson(UK_COUNTRY_URL)
        uk_feature = None
        for f in uk_country["features"]:
            solve_flat = f["geometry"]["coordinates"]
            solve(solve_flat)
            lat, lng = centroid_of(f["geometry"])
            # Merge multiple ONS "countries" (England/Scotland/Wales, sometimes NI separately)
            # under one single UK feature for the "states" grain -- upstream cohort geo data
            # only ever reports at whole-UK granularity (one EU-country-equivalent row), never
            # per home-nation, so keeping this as one map feature avoids an inconsistency between
            # what the choropleth shows and what the data actually distinguishes.
            uk_feature = {"type": "Feature", "geometry": f["geometry"],
                          "properties": {"stc": UK_COUNTRY_CODE, "s": [UK_COUNTRY_CODE, "United Kingdom"],
                                          "latlng": [lat, lng]}}
            break  # first feature's geometry/centroid is a reasonable stand-in; see note above.
        if uk_feature is not None:
            out_states["features"].append(uk_feature)
            with open(Path(OUT_DIR, "EU_states.json"), "wb") as fp:
                fp.write(json.dumps(out_states, separators=(",", ":")).encode("utf-8"))
            print(f"  re-wrote EU_states.json with UK added ({len(out_states['features'])} countries total)")

        print("Fetching ONS UK ITL2 region boundaries ...")
        uk_itl2 = fetch_arcgis_geojson(UK_ITL2_URL)
        uk_regions = {"type": "FeatureCollection", "features": []}
        for f in uk_itl2["features"]:
            props = f["properties"]
            code = _find_prop(props, r"^ITL2\d*CD$")
            name = _find_prop(props, r"^ITL2\d*NM$")
            if code is None:
                continue
            solve(f["geometry"]["coordinates"])
            lat, lng = centroid_of(f["geometry"])
            uk_regions["features"].append({"type": "Feature", "geometry": f["geometry"],
                                            "properties": {"cn": [code, name or code], "latlng": [lat, lng]}})
        Path(OUT_DIR, UK_COUNTRY_CODE).mkdir(exist_ok=True)
        with open(Path(OUT_DIR, UK_COUNTRY_CODE, f"{UK_COUNTRY_CODE}_counties.json"), "wb") as fp:
            fp.write(json.dumps(uk_regions, separators=(",", ":")).encode("utf-8"))
        print(f"  wrote {UK_COUNTRY_CODE}/{UK_COUNTRY_CODE}_counties.json ({len(uk_regions['features'])} regions)")
        by_country[UK_COUNTRY_CODE] = uk_regions
    except Exception as e:
        print(f"  WARNING: could not fetch UK boundaries ({e}). EU_states.json/EU/ were still "
              f"written successfully WITHOUT the UK -- see the UK_COUNTRY_URL/UK_ITL2_URL note "
              f"near the top of this file to fix the ONS endpoint and re-run.")

    print(f"Done ({len(out_states['features'])} countries, "
          f"{sum(len(fc['features']) for fc in by_country.values())} NUTS2/ITL2 regions total)")


if __name__ == "__main__":
    main()
