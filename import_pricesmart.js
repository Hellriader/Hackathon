// import_pricesmart.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();

const CONN = process.env.DATABASE_URL || process.env.NEON_CONN;
if (!CONN) {
  console.error(
    "Set DATABASE_URL or NEON_CONN environment variable with your Neon connection string."
  );
  process.exit(1);
}

const sql = neon(CONN);
const FILE = path.resolve(process.cwd(), "pricesmart-groceries.json");

function parsePrice(priceText) {
  if (!priceText) return null;
  // remove everything except digits and dot
  const cleaned = String(priceText).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  // return number (neon will send it as a numeric parameter)
  return Number(num.toFixed(2));
}

async function runImport() {
  if (!fs.existsSync(FILE)) {
    console.error("JSON file not found at", FILE);
    process.exit(1);
  }

  let items;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      console.error("JSON must be an array of objects.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to read/parse JSON:", err.message);
    process.exit(1);
  }

  console.log(`Importing ${items.length} items...`);

  let processed = 0;
  try {
    // Note: no tx.begin — just run each parameterized query with sql`...`
    for (const item of items) {
      const name = item.name ?? null;
      const priceNumeric = parsePrice(item.price); // number or null
      const url = item.url ?? null;
      const image_url = item.image ?? null;

      if (!name || !url) {
        console.warn("Skipping item missing name or url:", item);
        continue;
      }

      // Upsert by url. Ensure you ran the ALTER TABLE / index SQL once:
      // ALTER TABLE products ADD COLUMN IF NOT EXISTS url text;
      // CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_url ON products(url);
      await sql`
        INSERT INTO pricesmart
          (name, type, category, price, description, store, parish, on_deal, old_price, image_url, url, created_at)
        VALUES
          (${name}, ${"grocery"}, ${"uncategorized"}, ${priceNumeric}, ${null}, ${"PriceSmart"}, ${null}, ${false}, ${null}, ${image_url}, ${url}, CURRENT_DATE)
        ON CONFLICT (url)
        DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          store = EXCLUDED.store,
          category = EXCLUDED.category,
          created_at = EXCLUDED.created_at;
      `;

      processed++;
      // optional small throttle for very large imports:
      // if (processed % 200 === 0) await new Promise(r => setTimeout(r, 50));
    }

    console.log(`Processed ${processed} rows.`);
    console.log("Import complete.");
  } catch (err) {
    console.error("Import failed:", err);
    process.exit(1);
  }
}

runImport().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
