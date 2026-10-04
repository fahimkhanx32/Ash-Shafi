import { autocompleteMedicines } from '../../medicines/services/medicine.service.js';

/**
 * `search_medicine` — master prompt §13/§30.
 *
 * Wraps the exact `autocompleteMedicines` function the prescription
 * workspace's own medicine picker calls — same matches, same
 * ranking, same medicine database. Deliberately does not decide
 * "exactly one match vs. ambiguous" itself: it returns what it found
 * and lets the agent's own system prompt (master prompt §13) ask the
 * doctor to disambiguate when there's more than one hit, and report
 * "not found in the current medicine database" (never inventing a
 * medicine, master prompt §30) when there are none.
 */
export const searchMedicine = async ({ query, limit = 5 }) => {
  const matches = await autocompleteMedicines(query, limit);

  if (matches.length === 0) {
    return {
      success: true,
      action: 'search_medicine',
      message: `I couldn't find "${query}" in the current medicine database.`,
      results: [],
    };
  }

  const results = matches.map((m) => ({
    medicineId: String(m._id),
    genericName: m.genericName,
    brandName: m.brandName || '',
    manufacturer: m.manufacturer || '',
    strength: m.strength || '',
    unit: m.unit || '',
    dosageForm: m.dosageForm || '',
    route: m.route || '',
  }));

  return {
    success: true,
    action: 'search_medicine',
    message:
      results.length === 1
        ? `Found ${results[0].genericName}${results[0].brandName ? ` (${results[0].brandName})` : ''} ${results[0].strength}${results[0].unit}.`
        : `Found ${results.length} medicines matching "${query}" — which one did you mean?`,
    requiresConfirmation: results.length > 1,
    results,
  };
};
