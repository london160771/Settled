import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/airports.json',
);
const { airports } = JSON.parse(fs.readFileSync(file, 'utf8'));

// EU + EEA + Switzerland (EU261 applies via agreement) + UK (UK261).
export const EU_UK_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB'.split(
    ' ',
  ),
);
// Outermost regions use their own ISO codes in OurAirports but are EU territory.
for (const c of ['GP', 'MQ', 'GF', 'RE', 'YT', 'MF']) EU_UK_COUNTRIES.add(c);

export function getAirport(iata) {
  if (!iata) return null;
  const a = airports[String(iata).toUpperCase()];
  return a ? { iata: String(iata).toUpperCase(), ...a } : null;
}

export const isEuUk = (country) => EU_UK_COUNTRIES.has(country);

// Great-circle distance in km (haversine).
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
