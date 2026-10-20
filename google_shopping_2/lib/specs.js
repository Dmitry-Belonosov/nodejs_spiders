/**
 * Google "About this product" / "More details" pairs → fixed columns.
 * Keys vary by category, so each column lists the key spellings seen.
 * Everything stays available in specs_json and specs.csv.
 */
const COLUMNS = {
  model: /^(model|model number|model no\.?|mpn|part number|manufacturer part number|item model number)$/i,
  color: /^(colou?r|design colou?r|finish|colou?r family)$/i,
  material: /^(material|material type|housing material|material composition|body material|construction material)$/i,
  weight: /^(weight|item weight|product weight|net weight|shipping weight)$/i,
  length: /^(length|dimensions length|item length|product length)$/i,
  width: /^(width|dimensions width|item width|product width)$/i,
  height: /^(height|dimensions height|item height|product height)$/i,
  depth: /^(depth|dimensions depth)$/i,
  diameter: /^(diameter|dimensions diameter|size diameter)$/i,
  count_pack: /^(count|pack size|pack quantity|quantity|number of pieces|included accessories|units per pack)$/i,
  size: /^(size|dimensions size|thread size|pipe size|connection size|tubing size)$/i,
  product_type: /^(product type|type|pump type|fitting type|valve type|nozzle type|design style)$/i,
  compatible_with: /^(compatible with|compatible components|compatibility|fits)$/i,
  connection: /^(connection type|thread type|installation method|end connection)$/i,
};
const JUNK_KEY = /^(show less|show more|more details|less|user reviews|reviews|ask anything)/i;

function cleanSpecs(specs = {}) {
  const out = {};
  for (const [k, v] of Object.entries(specs)) {
    const key = String(k).trim();
    const val = String(v).trim();
    if (!key || !val || JUNK_KEY.test(key) || JUNK_KEY.test(val)) continue;
    out[key] = val;
  }
  return out;
}

/** { model, color, material, … } — first matching key per column. */
function specColumns(specs) {
  const clean = cleanSpecs(specs);
  const cols = Object.fromEntries(Object.keys(COLUMNS).map((c) => [c, '']));
  for (const [k, v] of Object.entries(clean)) {
    for (const [col, re] of Object.entries(COLUMNS)) {
      if (!cols[col] && re.test(k)) cols[col] = v;
    }
  }
  return cols;
}

module.exports = { cleanSpecs, specColumns, SPEC_COLUMNS: Object.keys(COLUMNS) };
