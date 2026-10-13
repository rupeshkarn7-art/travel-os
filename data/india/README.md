# India destination catalogue

Version-controlled source of truth for Travel OS's destination data: **all 28 states and 8 union territories**, organised as
India → Region → State/UT → District → Destination → Attraction, plus permits/requirements and multi-stop travel circuits.

| File | Contents |
|---|---|
| `states.py` | 7 regions and 36 states/UTs (code, region, capital, centre point, bounding box, tourism site) |
| `north.py`, `south.py`, `west.py`, `east.py`, `northeast.py`, `central_islands.py` | Destinations and their attractions |
| `permits_circuits.py` | Permits/requirements (state-wide and destination-level) and travel circuits |
| `build.py` | Validates everything, then writes `out/catalogue.json`, idempotent SQL in `out/*.sql` and `AUDIT.md` |
| `AUDIT.md` | Generated audit: totals, per-state coverage, categories, warnings, incomplete records |

## Updating the data

```bash
python3 data/india/build.py          # fails loudly on any validation error
git add data/india && git commit -m "Update catalogue" && git push
```

Then, in the Supabase SQL editor (or via the MCP), import the pushed file — imports are **idempotent** (re-running never duplicates):

```sql
select public.import_india_catalogue_from_url(
  'https://raw.githubusercontent.com/rupeshkarn7-art/travel-os/main/data/india/out/catalogue.json');
```

The importer (`supabase/migrations/006_catalogue_functions.sql`) upserts on stable keys: region id, state code,
destination `slug`, attraction `(destination, slug)`, permit `slug`, circuit `slug`. Pre-existing attractions are merged by slug.
It aborts the whole import if an attraction references an unknown destination, so nothing is silently dropped.
The admin console's **Data quality** screen (`catalogue_audit()`) reports coverage, duplicates, stale permits and missing fields.

## Validation performed by `build.py`

* exactly 36 states/UTs (28 + 8), each with at least one destination
* unique destination slugs and unique attraction names per destination
* coordinates inside the state/UT bounding box; attractions within ~130 km of their destination (warning otherwise)
* allowed categories, destination types and month values; suggested stay 1-30 days
* every permit and circuit stop references a real state/destination

## Sources and verification methodology

Priority of sources: Incredible India and the Ministry of Tourism, official state/UT tourism portals, official monument,
temple and park websites, the Archaeological Survey of India, the UNESCO World Heritage Centre, and official permit portals.

| Field | Status in this release | Rule |
|---|---|---|
| Names, district, type, categories, descriptions | `partially_verified` | Curated from established public reference knowledge (AI-assisted); not yet checked line-by-line against an official page |
| Coordinates | approximate centre points | Validated against state/UT boxes; attraction coordinates only where known with confidence (others left empty) |
| Best months | `estimated` | General climate guidance, never a live forecast |
| Budget ranges | `estimated` | Suggested stay × documented per-person daily rates by style (budget ₹1.5-3K, standard ₹3-6.5K, premium ₹7-15K) |
| Ticket prices, opening hours, closing days, hotel rates | **not included** | Left empty until verified; the app says "not verified — check official source" |
| UNESCO flags | reference list | UNESCO World Heritage Centre list for India |
| Permits | `verified` only if the official portal was checked (date stored); otherwise `needs_review` | Each has a source, last-verified date and a reconfirm note |

Popularity (`pop`, 1-100) is an editorial prominence score used only for default ordering: UNESCO sites, major pilgrimage
centres and major gateways rank higher; it is not a rating.

Images: no third-party photos are bundled. The app shows category artwork until licensed images with attribution are added
(see the roadmap in the main README).
