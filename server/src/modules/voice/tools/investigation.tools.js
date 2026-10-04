import { TEST_CATALOG } from '../../investigations/models/test-catalog.js';

/**
 * `search_investigation` — master prompt §15/§30.
 *
 * `TEST_CATALOG` is the same static catalog `GET /lab-requisitions/
 * catalog` already serves to the prescription/lab-requisition UI's
 * own test picker (any authenticated user, no extra permission —
 * mirrored here for the same reason). No new test list is invented;
 * a query that matches nothing returns an empty result rather than a
 * fabricated entry (master prompt §30).
 */
export const searchInvestigation = ({ query, limit = 5 }) => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) {
    return { success: true, action: 'search_investigation', message: 'No search term given.', results: [] };
  }

  const scored = TEST_CATALOG.filter(
    (t) => t.name.toLowerCase().includes(term) || t.code.toLowerCase().includes(term.replace(/\s+/g, '_')),
  );

  // Prefix matches on the display name rank first, same tie-breaking
  // idea as `autocompleteMedicines` in `medicine.tools.js`.
  scored.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(term);
    const bPrefix = b.name.toLowerCase().startsWith(term);
    if (aPrefix === bPrefix) return 0;
    return aPrefix ? -1 : 1;
  });

  const results = scored.slice(0, limit).map((t) => ({
    testCode: t.code,
    name: t.name,
    category: t.category,
    costBDT: t.costBDT,
  }));

  if (results.length === 0) {
    return {
      success: true,
      action: 'search_investigation',
      message: `I couldn't find a test matching "${query}" in the catalog.`,
      results: [],
    };
  }

  return {
    success: true,
    action: 'search_investigation',
    message:
      results.length === 1
        ? `Found ${results[0].name} (${results[0].costBDT} BDT).`
        : `Found ${results.length} tests matching "${query}" — which one did you mean?`,
    requiresConfirmation: results.length > 1,
    results,
  };
};
