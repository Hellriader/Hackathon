import "dotenv/config";
import pkg from "pg";
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Please set DATABASE_URL in .env");
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 60000,
});

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "by",
  "of",
  "in",
  "on",
  "a",
  "an",
  "to",
  "new",
  "mini",
  "set",
  "pack",
  "xl",
  "large",
  "small",
  "red",
  "blue",
  "green",
  "black",
  "white",
]);

function normalizeName(name) {
  if (!name) return "";
  let s = name.toLowerCase();
  s = s.replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()\[\]\+]/g, " ");
  s = s.replace(/\btee\b/g, "t-shirt");
  s = s.replace(/\btv\b/g, "television");
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter((t) => t && !STOPWORDS.has(t));
  const uniq = Array.from(new Set(tokens)).sort();
  return { normalized: s, tokens, fingerprint: uniq.join(" ") };
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(a) {
    return this.parent[a] === a
      ? a
      : (this.parent[a] = this.find(this.parent[a]));
  }
  union(a, b) {
    const pa = this.find(a),
      pb = this.find(b);
    if (pa !== pb) this.parent[pb] = pa;
  }
}

function jaccard(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

async function main() {
  await client.connect();

  const res = await client.query(`
    SELECT id, name, norm_name, 'gibbo' AS store_table FROM gibbo
    UNION ALL
    SELECT id, name, norm_name, 'loshusans' AS store_table FROM loshusans
    UNION ALL
    SELECT id, name, norm_name, 'pricesmart' AS store_table FROM pricesmart
    UNION ALL
    SELECT id, name, norm_name, 'sampars' AS store_table FROM sampars
  `);

  const rows = res.rows;
  console.log(`Loaded ${rows.length} products from all stores`);

  const items = rows.map((r) => {
    const norm = normalizeName(r.name);
    return {
      id: r.id,
      name: r.name,
      normalized: r.norm_name || norm.normalized,
      tokens: norm.tokens,
      store_table: r.store_table,
    };
  });

  const uf = new UnionFind(items.length);
  const THRESHOLD = 0.7;

  // Cluster based on token Jaccard similarity
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = jaccard(items[i].tokens, items[j].tokens);
      if (sim >= THRESHOLD) uf.union(i, j);
    }
  }

  const clusters = new Map();
  items.forEach((it, idx) => {
    const root = uf.find(idx);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(idx);
  });

  console.log(`Found ${clusters.size} clusters`);

  // Pick canonical names based on cross-store frequency
  for (const [root, idxs] of clusters.entries()) {
    const nameCounts = {};
    idxs.forEach((i) => {
      const n = items[i].name;
      nameCounts[n] = (nameCounts[n] || 0) + 1;
    });

    let canonicalName = null;
    let maxCount = -1;
    // Prefer non-gibbo tables first
    idxs.forEach((i) => {
      if (items[i].store_table !== "gibbo") {
        const n = items[i].name;
        if (nameCounts[n] > maxCount) {
          maxCount = nameCounts[n];
          canonicalName = n;
        }
      }
    });

    // Fallback to most frequent gibbo name
    if (!canonicalName) {
      canonicalName = Object.entries(nameCounts).sort(
        (a, b) => b[1] - a[1]
      )[0][0];
    }

    for (const i of idxs) {
      const item = items[i];
      if (item.store_table === "gibbo") {
        const confidence = 0.85;
        await client.query(
          `UPDATE gibbo SET alias=$1, alias_confidence=$2 WHERE id=$3`,
          [canonicalName, confidence, item.id]
        );
      }
    }
  }

  console.log(
    "Updated gibbo.alias and gibbo.alias_confidence using token-based Jaccard clustering"
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  client.end();
});
