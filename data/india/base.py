"""Shared structures for the Travel OS India catalogue.

Records are compact Python tuples so the dataset stays readable and diff-able in Git.
`build.py` validates everything and turns it into idempotent SQL for Supabase.

Accuracy rules (see data/india/README.md):
  * Descriptions, categories and locations come from established public reference knowledge and
    are marked `partially_verified` (curated, not yet field-checked against an official page).
  * Best months are general climate guidance -> stored as `estimated`. Never a live forecast.
  * Ticket prices, opening hours, closing days and hotel rates are NOT included unless verified.
    They are left empty so the app shows "Not verified - check official source".
  * Coordinates are approximate centre points (about 1-5 km) and are validated against each
    state/UT bounding box. Attraction coordinates are only given when known with confidence.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class A:
    """Attraction / experience inside a destination."""
    name: str
    category: str          # heritage | spiritual | nature | wildlife | adventure | beach | museum | sightseeing | shopping | food | culture
    lat: Optional[float]
    lng: Optional[float]
    desc: str
    unesco: bool = False
    minutes: int = 90      # typical visit length (planning estimate)


@dataclass
class D:
    slug: str
    name: str
    state: str             # state/UT code, see states.py
    district: str
    dtype: str             # city | hill_station | beach | heritage_site | pilgrimage | wildlife | island | lake | waterfall | valley | trek | village | region
    cats: list
    lat: float
    lng: float
    months: list           # best months 1-12 (climate guidance)
    days: int              # suggested stay
    tier: str              # budget | standard | premium (typical cost level)
    tagline: str
    desc: str
    highlights: list = field(default_factory=list)
    food: list = field(default_factory=list)
    alt: list = field(default_factory=list)
    unesco: bool = False
    airport: Optional[str] = None
    rail: Optional[str] = None
    gems: list = field(default_factory=list)
    attractions: list = field(default_factory=list)
    pop: int = 50          # editorial prominence 1-100 (see README for basis)


# Short helpers so region files stay compact
def a(name, cat, lat, lng, desc, unesco=False, minutes=90):
    return A(name, cat, lat, lng, desc, unesco, minutes)
