/**
 * BET-19 checkpoint 1 — JSON export.
 *
 * Thin, deliberately: unlike CSV/XLSX/PDF, JSON needs no custom
 * writer — `JSON.stringify` on the same already-shaped row set the
 * other three formats consume is a valid, complete "export" of the
 * data, and re-inventing a JSON writer would add nothing. This file
 * exists only to give JSON export the same `objectsToXBuffer(records,
 * columns)` call shape `csv.util.js`/`xlsx-writer.util.js` already
 * establish, so `tabular-export.service.js` can treat all four
 * formats uniformly.
 *
 * Applies each column's `get`/`key` accessor (same as CSV/XLSX) so a
 * JSON export shows the same field set/order/labels as the other
 * three formats, not a raw, differently-shaped Mongoose document
 * dump — the same "every export format for a given entity type
 * agrees" guarantee `entity-export.service.js`'s own docstring
 * states for CSV/XLSX/PDF.
 */

/**
 * @param {object[]} records
 * @param {Array<{ key?: string, label: string, get?: Function }>} columns
 * @returns {Buffer} UTF-8 JSON, pretty-printed, array of objects keyed by column label
 */
export const objectsToJsonBuffer = (records, columns) => {
  const shaped = records.map((record) => {
    const row = {};
    for (const column of columns) {
      const value = column.get ? column.get(record) : record[column.key];
      row[column.label] = value === undefined ? null : value;
    }
    return row;
  });

  return Buffer.from(JSON.stringify({ recordCount: shaped.length, records: shaped }, null, 2), 'utf8');
};
