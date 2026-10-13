"""Validate the India catalogue and generate idempotent SQL + an audit report.

Usage:  python3 data/india/build.py            -> writes data/india/out/*.sql and AUDIT.md
Import: run the generated SQL files in order (01_..., 02_..., ...) in the Supabase SQL editor,
        or via the Supabase MCP / psql. Re-running is safe: every statement upserts on a stable key.
"""
import json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from states import REGIONS, STATES                      # noqa: E402
from permits_circuits import PERMITS, CIRCUITS, LAST_CHECKED  # noqa: E402
import north, south, west, east, northeast, central_islands  # noqa: E402

OUT = os.path.join(HERE, "out")
REGION_FILES = [north, south, west, east, northeast, central_islands]

DEST_CATS = {"heritage", "spiritual", "nature", "wildlife", "adventure", "beaches", "mountains", "culture", "food",
             "wellness", "family", "weekend", "romantic", "budget", "luxury", "islands", "shopping"}
ATTR_CATS = {"heritage", "spiritual", "nature", "wildlife", "adventure", "beach", "museum", "sightseeing", "shopping", "food", "culture"}
DTYPES = {"city", "hill_station", "beach", "heritage_site", "pilgrimage", "wildlife", "island", "lake", "waterfall", "valley", "trek", "village", "region"}
# Indicative per-person per-day spend (INR) by travel style, excluding travel to the destination.
# Documented assumption shown to users; not a live price.
TIER_RATE = {"budget": (1500, 3000), "standard": (3000, 6500), "premium": (7000, 15000)}

def slugify(s):
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()

def q(v):
    """SQL literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, tuple)):
        if not v:
            return "'{}'"
        if all(isinstance(x, int) for x in v):
            return "array[" + ",".join(str(x) for x in v) + "]::int[]"
        return "array[" + ",".join(q(x) for x in v) + "]::text[]"
    return "'" + str(v).replace("'", "''") + "'"

def main():
    errors, warnings = [], []
    states = {s[0]: s for s in STATES}
    regions = {r[0] for r in REGIONS}
    if len(STATES) != 36:
        errors.append(f"Expected 36 states/UTs, found {len(STATES)}")
    kinds = Counter(s[3] for s in STATES)
    if kinds["state"] != 28 or kinds["ut"] != 8:
        errors.append(f"Expected 28 states + 8 UTs, found {dict(kinds)}")
    for s in STATES:
        if s[4] not in regions:
            errors.append(f"State {s[0]} has unknown region {s[4]}")

    dests, seen, attr_total, unesco = [], {}, 0, 0
    name_index = defaultdict(list)
    for mod in REGION_FILES:
        for d in mod.DESTINATIONS:
            where = f"{mod.__name__}:{d.slug}"
            if d.slug in seen:
                errors.append(f"Duplicate slug {d.slug} ({where} and {seen[d.slug]})")
            seen[d.slug] = where
            if d.state not in states:
                errors.append(f"{where}: unknown state {d.state}")
                continue
            lat0, lat1, lng0, lng1 = states[d.state][8]
            if not (lat0 <= d.lat <= lat1 and lng0 <= d.lng <= lng1):
                errors.append(f"{where}: coordinates {d.lat},{d.lng} outside {d.state} bounds")
            bad = set(d.cats) - DEST_CATS
            if bad:
                errors.append(f"{where}: unknown categories {bad}")
            if d.dtype not in DTYPES:
                errors.append(f"{where}: unknown type {d.dtype}")
            if not d.months or any(m < 1 or m > 12 for m in d.months):
                errors.append(f"{where}: bad months {d.months}")
            if not 1 <= d.days <= 30:
                errors.append(f"{where}: bad days {d.days}")
            if d.tier not in TIER_RATE:
                errors.append(f"{where}: bad tier {d.tier}")
            name_index[(d.state, d.name.lower())].append(d.slug)
            aslugs = set()
            for at in d.attractions:
                s = slugify(at.name)
                if s in aslugs:
                    errors.append(f"{where}: duplicate attraction {at.name}")
                aslugs.add(s)
                if at.category not in ATTR_CATS:
                    errors.append(f"{where}/{at.name}: unknown attraction category {at.category}")
                if (at.lat is None) != (at.lng is None):
                    errors.append(f"{where}/{at.name}: half coordinates")
                if at.lat is not None:
                    # attractions must sit near their destination (or at least inside the state box, padded)
                    if not (lat0 - 0.3 <= at.lat <= lat1 + 0.3 and lng0 - 0.3 <= at.lng <= lng1 + 0.3):
                        errors.append(f"{where}/{at.name}: coordinates outside {d.state}")
                    dist = ((at.lat - d.lat) ** 2 + (at.lng - d.lng) ** 2) ** 0.5
                    if dist > 1.2:
                        warnings.append(f"{where}/{at.name}: {dist:.2f} deg from destination centre (check)")
                if at.unesco:
                    unesco += 1
            attr_total += len(d.attractions)
            dests.append(d)
    for k, v in name_index.items():
        if len(v) > 1:
            warnings.append(f"Possible duplicate names in {k[0]}: {v}")

    covered = Counter(d.state for d in dests)
    missing_states = [s for s in states if covered[s] == 0]
    if missing_states:
        errors.append(f"States with no destinations: {missing_states}")

    for p in PERMITS:
        kind, ref = p[1]
        if kind == "state" and ref not in states:
            errors.append(f"Permit {p[0]}: unknown state {ref}")
        if kind == "dest" and ref not in seen:
            errors.append(f"Permit {p[0]}: unknown destination {ref}")
    for c in CIRCUITS:
        for slug, _ in c[7]:
            if slug not in seen:
                errors.append(f"Circuit {c[0]}: unknown stop {slug}")

    if errors:
        print("VALIDATION FAILED")
        for e in errors:
            print(" -", e)
        sys.exit(1)

    os.makedirs(OUT, exist_ok=True)
    stmts = {}
    J = {"version": LAST_CHECKED, "regions": [], "states": [], "destinations": [], "attractions": [], "permits": [], "circuits": []}
    for r in REGIONS:
        J["regions"].append({"id": r[0], "name": r[1], "sort_order": r[2], "description": r[3]})
    for i, s_ in enumerate(STATES):
        J["states"].append({"id": s_[0], "slug": s_[1], "name": s_[2], "kind": s_[3], "region_id": s_[4], "capital": s_[5], "latitude": s_[6],
                            "longitude": s_[7], "tourism_url": s_[9], "description": s_[10], "sort_order": i})

    # 01 regions + states
    lines = ["-- 01 regions and states/UTs (idempotent)"]
    for r in REGIONS:
        lines.append(f"insert into public.regions (id,name,sort_order,description) values ({q(r[0])},{q(r[1])},{r[2]},{q(r[3])}) "
                     "on conflict (id) do update set name=excluded.name, sort_order=excluded.sort_order, description=excluded.description;")
    for i, s in enumerate(STATES):
        code, slug, name, kind, region, capital, lat, lng, _box, url, desc = s
        lines.append("insert into public.states (id,slug,name,kind,region_id,capital,latitude,longitude,tourism_url,description,sort_order) values "
                     f"({q(code)},{q(slug)},{q(name)},{q(kind)},{q(region)},{q(capital)},{lat},{lng},{q(url)},{q(desc)},{i}) "
                     "on conflict (id) do update set slug=excluded.slug, name=excluded.name, kind=excluded.kind, region_id=excluded.region_id, capital=excluded.capital, "
                     "latitude=excluded.latitude, longitude=excluded.longitude, tourism_url=excluded.tourism_url, description=excluded.description, sort_order=excluded.sort_order;")
    stmts["01_regions_states.sql"] = lines

    # destinations (chunked per region file)
    completeness = {}
    for idx, mod in enumerate(REGION_FILES, start=2):
        lines = [f"-- {idx:02d} destinations: {mod.__name__} (idempotent upsert on slug)"]
        for d in [x for x in dests if x in mod.DESTINATIONS]:
            st = states[d.state]
            lo, hi = TIER_RATE[d.tier]
            missing = []
            if not d.airport and not d.rail: missing.append("transport_hubs")
            if not d.highlights: missing.append("highlights")
            if not d.food: missing.append("food")
            if not d.attractions: missing.append("attractions")
            missing += ["accessibility", "photos", "official_page_check"]
            filled = 10 - min(len(missing), 10)
            comp = max(10, min(100, filled * 10))
            completeness[d.slug] = comp
            src_url = st[9] or "https://www.incredibleindia.gov.in/"
            transport = "; ".join(x for x in [f"Nearest airport: {d.airport}" if d.airport else None,
                                               f"Rail: {d.rail}" if d.rail else None] if x) or None
            vals = {
                "slug": d.slug, "name": d.name, "state": st[2], "country": "India", "categories": list(d.cats), "tagline": d.tagline,
                "description": d.desc, "recommended_days": d.days, "budget_min": lo * d.days, "budget_max": hi * d.days,
                "latitude": d.lat, "longitude": d.lng, "popularity": d.pop, "status": "published", "source_type": "ai",
                "source_url": src_url, "state_id": d.state, "district": d.district, "destination_type": d.dtype,
                "alt_names": list(d.alt), "best_months": list(d.months), "highlights": list(d.highlights), "hidden_gems": list(d.gems),
                "food": list(d.food), "nearest_airport": d.airport, "nearest_railway": d.rail, "budget_tier": d.tier, "unesco": d.unesco,
                "source_org": "Travel OS editorial (AI-assisted); cross-reference: Incredible India / state tourism",
                "verification_status": "partially_verified", "completeness": comp, "missing_fields": missing,
                "season_notes": "Best months are general climate guidance, not a forecast. Check the weather and any seasonal closures before you go.",
            }
            J["destinations"].append({**vals, "transportation": transport})
            cols = ",".join(vals)
            values = ",".join(q(v) for v in vals.values())
            upd = ",".join(f"{k}=excluded.{k}" for k in vals if k not in ("slug",))
            # keep any transport text an admin has already written
            lines.append(f"insert into public.destinations ({cols},transportation) values ({values},{q(transport)}) "
                         f"on conflict (slug) do update set {upd}, transportation=coalesce(public.destinations.transportation, excluded.transportation), updated_at=now();")
        stmts[f"{idx:02d}_destinations_{mod.__name__}.sql"] = lines

    # 08 attractions
    lines = ["-- 08 attractions (idempotent upsert on destination + slug)",
             "update public.attractions set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) where slug is null;"]
    for d in dests:
        for at in d.attractions:
            vals = {
                "slug": slugify(at.name), "name": at.name, "category": at.category, "description": at.desc, "latitude": at.lat, "longitude": at.lng,
                "estimated_cost": 0, "duration_minutes": at.minutes, "status": "published", "unesco": at.unesco,
                "source_org": "Travel OS editorial (AI-assisted)", "verification_status": "partially_verified",
                "source_url": "https://whc.unesco.org/en/statesparties/in" if at.unesco else None,
            }
            J["attractions"].append({**vals, "destination_slug": d.slug})
            cols = ",".join(vals)
            values = ",".join(q(v) for v in vals.values())
            upd = ",".join(f"{k}=excluded.{k}" for k in vals if k not in ("slug", "estimated_cost"))
            lines.append(f"insert into public.attractions (destination_id,{cols}) select id,{values} from public.destinations where slug={q(d.slug)} "
                         f"on conflict (destination_id, slug) do update set {upd};")
    stmts["08_attractions.sql"] = lines

    # 09 permits
    lines = ["-- 09 permits and requirements (idempotent upsert on slug)"]
    for p in PERMITS:
        slug, (kind, ref), name, desc, appl, mandatory, status, src, url, note = p
        dest_sql = f"(select id from public.destinations where slug={q(ref)})" if kind == "dest" else "null"
        state_sql = q(ref) if kind == "state" else f"(select state_id from public.destinations where slug={q(ref)})"
        J["permits"].append({"slug": slug, "scope": kind, "ref": ref, "permit_name": name, "description": desc, "applicable_to": appl, "mandatory": mandatory,
                             "status": status, "source": src, "source_url": url, "source_type": "official" if status == "verified" else "community",
                             "last_verified": LAST_CHECKED if status == "verified" else None, "reconfirm_note": note})
        lv = q(LAST_CHECKED) if status == "verified" else "null"
        lines.append("insert into public.permits (slug,destination_id,state_id,permit_name,description,required,mandatory,applicable_to,source,source_url,source_type,last_verified,status,reconfirm_note) values "
                     f"({q(slug)},{dest_sql},{state_sql},{q(name)},{q(desc)},{q(mandatory)},{q(mandatory)},{q(appl)},{q(src)},{q(url)},{q('official' if status == 'verified' else 'community')},{lv},{q(status)},{q(note)}) "
                     "on conflict (slug) do update set destination_id=excluded.destination_id, state_id=excluded.state_id, permit_name=excluded.permit_name, description=excluded.description, "
                     "required=excluded.required, mandatory=excluded.mandatory, applicable_to=excluded.applicable_to, source=excluded.source, source_url=excluded.source_url, "
                     "source_type=excluded.source_type, last_verified=excluded.last_verified, status=excluded.status, reconfirm_note=excluded.reconfirm_note;")
    stmts["09_permits.sql"] = lines

    # 10 circuits
    lines = ["-- 10 travel circuits (idempotent)"]
    for c in CIRCUITS:
        slug, name, region, days, cats, months, desc, stops = c
        J["circuits"].append({"slug": slug, "name": name, "region_id": region, "days": days, "categories": cats, "best_months": months, "description": desc,
                              "stops": [{"destination_slug": ds, "nights": n} for ds, n in stops]})
        lines.append("insert into public.travel_circuits (slug,name,region_id,days,categories,best_months,description) values "
                     f"({q(slug)},{q(name)},{q(region)},{days},{q(cats)},{q(months)},{q(desc)}) on conflict (slug) do update set name=excluded.name, region_id=excluded.region_id, "
                     "days=excluded.days, categories=excluded.categories, best_months=excluded.best_months, description=excluded.description;")
        lines.append(f"delete from public.circuit_stops where circuit_id=(select id from public.travel_circuits where slug={q(slug)});")
        for i, (ds, nights) in enumerate(stops, start=1):
            lines.append("insert into public.circuit_stops (circuit_id,destination_id,stop_order,nights) select c.id,d.id," f"{i},{nights} "
                         f"from public.travel_circuits c, public.destinations d where c.slug={q(slug)} and d.slug={q(ds)};")
    stmts["10_circuits.sql"] = lines

    with open(os.path.join(OUT, "catalogue.json"), "w") as f:
        json.dump(J, f, ensure_ascii=False, separators=(",", ":"))
    for name, ls in stmts.items():
        with open(os.path.join(OUT, name), "w") as f:
            f.write("\n".join(ls) + "\n")

    # Audit report
    by_state = Counter(d.state for d in dests)
    attr_by_state = Counter()
    for d in dests:
        attr_by_state[d.state] += len(d.attractions)
    by_cat = Counter(c for d in dests for c in d.cats)
    by_type = Counter(d.dtype for d in dests)
    attr_coords = sum(1 for d in dests for at in d.attractions if at.lat is not None)
    rep = ["# India catalogue — audit report", "",
           f"* Destinations: **{len(dests)}**", f"* Attractions/experiences: **{attr_total}** ({attr_coords} with coordinates)",
           f"* Total records: **{len(dests) + attr_total}**", f"* States/UTs covered: **{len(by_state)} / 36**",
           f"* UNESCO-listed attractions flagged: {unesco}; destinations flagged UNESCO: {sum(1 for d in dests if d.unesco)}",
           f"* Permits/requirements: {len(PERMITS)} ({sum(1 for p in PERMITS if p[6] == 'verified')} verified on {LAST_CHECKED}, the rest marked needs_review)",
           f"* Travel circuits: {len(CIRCUITS)}", f"* Validation errors: 0; warnings: {len(warnings)}", "",
           "## Verification status", "",
           "| Data | Status |", "|---|---|",
           "| Names, locations, descriptions, categories | partially_verified (curated reference knowledge, not yet checked against an official page) |",
           "| Coordinates | approximate centre points, validated against state/UT bounding boxes |",
           "| Best months | estimated (general climate guidance) |",
           "| Budget ranges | estimated from documented per-day rates by travel style |",
           "| Ticket prices, opening hours, closing days, hotel rates | unavailable — intentionally left empty |",
           "| Permits | verified only where the official portal was checked; otherwise needs_review |", "",
           "## Records per state/UT", "", "| State/UT | Region | Destinations | Attractions |", "|---|---|---|---|"]
    for s in STATES:
        rep.append(f"| {s[2]} | {s[4]} | {by_state[s[0]]} | {attr_by_state[s[0]]} |")
    rep += ["", "## By category", "", "| Category | Destinations |", "|---|---|"] + [f"| {k} | {v} |" for k, v in by_cat.most_common()]
    rep += ["", "## By type", "", "| Type | Destinations |", "|---|---|"] + [f"| {k} | {v} |" for k, v in by_type.most_common()]
    rep += ["", "## Warnings", ""] + ([f"* {w}" for w in warnings] or ["None"])
    rep += ["", "## Incomplete records", "", "Every record lists its `missing_fields` in the database. Fields missing everywhere today: "
            "accessibility details, licensed photos and an official-page check. Destinations without attractions: "
            f"{sum(1 for d in dests if not d.attractions)}."]
    with open(os.path.join(HERE, "AUDIT.md"), "w") as f:
        f.write("\n".join(rep) + "\n")
    print(json.dumps({"destinations": len(dests), "attractions": attr_total, "total": len(dests) + attr_total, "states": len(by_state),
                      "warnings": len(warnings), "files": list(stmts)}, indent=1))
    for w in warnings:
        print("WARN", w)

if __name__ == "__main__":
    main()
