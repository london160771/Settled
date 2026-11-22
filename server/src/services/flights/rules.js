// Simplified EU261 / UK261. Not legal advice.
import { getAirport, isEuUk, distanceKm } from './airports.js';
import { carrierCountry } from './carriers.js';

export const RULES_VERSION = 'eu261-simple-1';
export const OWED_DELAY_MINUTES = 180;

export function amountForDistance(km) {
  if (km <= 1500) return 250;
  if (km <= 3500) return 400;
  return 600;
}

/**
 * @returns {{ known: boolean, covered: boolean, owed: boolean, amountEur: number|null, distanceKm: number|null, reasons: string[] }}
 */
export function evaluate({ from, to, carrier, delayMinutes, cancelled = false }) {
  const reasons = [];
  const dep = getAirport(from);
  const arr = getAirport(to);
  if (!dep || !arr) {
    return {
      known: false,
      covered: false,
      owed: false,
      amountEur: null,
      distanceKm: null,
      reasons: ['Add the departure and arrival airports (IATA codes) so the rule can be checked.'],
    };
  }
  const km = distanceKm(dep, arr);
  const airline = carrierCountry(carrier);
  let covered = false;
  if (isEuUk(dep.country)) {
    covered = true;
    reasons.push(`Departs from ${dep.iata} (${dep.country}), an EU/EEA/UK airport: covered.`);
  } else if (isEuUk(arr.country)) {
    if (!airline) {
      return {
        known: false,
        covered: false,
        owed: false,
        amountEur: null,
        distanceKm: km,
        reasons: [
          `Arrives in the EU/UK but airline ${carrier} is not in our list. Tell us the airline's country.`,
        ],
      };
    }
    covered = isEuUk(airline);
    reasons.push(
      covered
        ? `Arrives at ${arr.iata} (${arr.country}) on an EU/UK airline (${carrier}, ${airline}): covered.`
        : `Arrives in the EU/UK but on a non-EU/UK airline (${carrier}, ${airline}): not covered.`,
    );
  } else {
    reasons.push(
      `Neither departs from nor arrives in the EU/EEA/UK (${dep.iata} → ${arr.iata}): not covered.`,
    );
  }
  if (!covered)
    return { known: true, covered, owed: false, amountEur: null, distanceKm: km, reasons };

  const amountEur = amountForDistance(km);
  if (cancelled) {
    reasons.push(
      `Flight reported cancelled. Distance ${km} km → ${amountEur} EUR (cancellation notice and rerouting can change this).`,
    );
    return { known: true, covered, owed: true, amountEur, distanceKm: km, reasons };
  }
  if (delayMinutes >= OWED_DELAY_MINUTES) {
    reasons.push(
      `Arrival delay ${delayMinutes} min is at least ${OWED_DELAY_MINUTES} min. Distance ${km} km → ${amountEur} EUR.`,
    );
    if (km > 3500 && delayMinutes < 240)
      reasons.push('Long-haul delays of 3–4 hours may be paid at half (not computed here).');
    return { known: true, covered, owed: true, amountEur, distanceKm: km, reasons };
  }
  reasons.push(
    `Arrival delay ${delayMinutes} min is under ${OWED_DELAY_MINUTES} min: no compensation under the rule.`,
  );
  return { known: true, covered, owed: false, amountEur: null, distanceKm: km, reasons };
}
