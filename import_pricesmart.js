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
const FILE = path.resolve(process.cwd(), "gibbo-products.json");

// Tunables
const NAME_CHUNK_SIZE = 500; // how many names to ask the DB about per SELECT
const INSERT_BATCH_SIZE = 100; // how many rows we attempt before logging progress
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 300; // base backoff

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

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function retryAsync(fn, retries = MAX_RETRIES, baseMs = RETRY_BASE_MS) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const wait = baseMs * Math.pow(2, attempt - 1);
      console.warn(
        `Attempt ${attempt} failed — retrying after ${wait}ms:`,
        err.message || err
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function runImport() {
  if (!fs.existsSync(FILE)) {
    console.error("JSON file not found at", FILE);
    process.exit(1);
  }

  let rawItems;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    rawItems = JSON.parse(raw);
    if (!Array.isArray(rawItems)) {
      console.error("JSON must be an array of objects.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to read/parse JSON:", err.message);
    process.exit(1);
  }

  // Normalize & dedupe input by name (keeps first occurrence)
  const byName = new Map();
  for (const item of rawItems) {
    const name = (item.name || "").toString().trim();
    if (!name) continue; // skip nameless here; we'll warn later
    if (!byName.has(name)) byName.set(name, item);
  }

  const items = Array.from(byName.values());

  console.log(
    `Prepared ${items.length} unique-named items from input (original: ${rawItems.length})`
  );

  // collect names to check what already exists
  const allNames = items.map((it) => it.name.trim());

  const existingNames = new Set();

  const nameChunks = chunkArray(allNames, NAME_CHUNK_SIZE);

  try {
    for (const chunk of nameChunks) {
      // Query DB for any names in this chunk. Wrap in retry to mitigate flaky network.
      const rows = await retryAsync(
        () => sql`SELECT name FROM gibbo WHERE name = ANY(${chunk})`
      );
      for (const r of rows) {
        if (r && r.name) existingNames.add(r.name);
      }
    }
  } catch (err) {
    console.error(
      "Failed to query existing names from DB:",
      err.message || err
    );
    process.exit(1);
  }

  console.log(
    `Found ${existingNames.size} items already in DB — they will be skipped.`
  );

  // Build list of items to insert
  const toInsert = [];
  const skippedMissing = [];
  for (const item of items) {
    const name = item.name ? item.name.toString().trim() : null;
    const link = item.link ?? null;
    if (!name || !link) {
      skippedMissing.push(item);
      continue;
    }
    if (existingNames.has(name)) {
      // skip already present
      continue;
    }
    const priceNumeric = parsePrice(item.price);
    const image_url = item.image ?? null;
    toInsert.push({ name, priceNumeric, link, image_url });
  }

  if (skippedMissing.length) {
    console.warn(
      `Skipping ${skippedMissing.length} items missing name or link.`
    );
  }

  if (toInsert.length === 0) {
    console.log("Nothing to import — all items already exist or were invalid.");
    process.exit(0);
  }

  console.log(
    `Inserting ${toInsert.length} new items (individual INSERTs with retries)...`
  );

  let inserted = 0;

  try {
    // Insert each row individually — simpler and avoids dependency on helper methods like sql.join
    for (const it of toInsert) {
      await retryAsync(
        () =>
          sql`
          INSERT INTO gibbo
            (name, type, category, price, description, store, parish, on_deal, old_price, image_url, link, created_at)
          VALUES
            (${it.name}, ${"grocery"}, ${"uncategorized"}, ${
            it.priceNumeric
          }, ${null}, ${"Gibbo"}, ${null}, ${false}, ${null}, ${
            it.image_url
          }, ${it.link}, CURRENT_DATE)
        `
      );

      inserted++;
      if (inserted % INSERT_BATCH_SIZE === 0) {
        console.log(`Inserted ${inserted}/${toInsert.length}...`);
      }
    }

    console.log(`Import complete. Inserted ${inserted} new rows.`);
  } catch (err) {
    console.error("Insert failed:", err.message || err);
    process.exit(1);
  }
}

runImport().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
