import express, { response } from "express";
import dotenv from "dotenv";
//import { sql } from "./config/db.js";
import pkg from "pg";
const { Client } = pkg;
import { GoogleGenAI } from "@google/genai";

import { neon } from "@neondatabase/serverless";

//Emvironment variables
dotenv.config();

//Start express server
const app = express();
app.use(express.json());

// connect to neon database
const sql = neon(process.env.DATABASE_URL);

//set server port to port set in enviroment variable or 5001
const PORT = process.env.PORT || 5001;

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get("/api/ai/:query", async (req, res) => {
  try {
    const { query } = req.params;

    const response = await getGeminiResponse(query, prompt);

    // Sanitize AI output: remove code fences and surrounding text
    let sqlText = String(response || "").trim();
    // Remove markdown code fences if present
    sqlText = sqlText
      .replace(/```(sql|SQL)?\n?/g, "")
      .replace(/```$/g, "")
      .trim();

    // Basic validation: only allow SELECT/COUNT queries to prevent destructive operations
    const allowed = /^(SELECT|WITH|EXPLAIN|SHOW|PRAGMA)\b/i;
    if (!allowed.test(sqlText)) {
      return res.status(400).json({
        error: "Generated SQL not allowed or couldn't be validated.",
        sql: sqlText,
      });
    }

    try {
      // Use pg client for executing dynamically generated SQL strings
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const { rows } = await client.query(sqlText);
        await client.end();
        return res.status(200).json(rows);
      } catch (qErr) {
        await client.end();
        console.error("Query error executing AI-generated SQL:", qErr);
        return res.status(500).json({
          error: "Error executing SQL",
          details: qErr.message,
          sql: sqlText,
        });
      }
    } catch (e) {
      console.error("Error setting up DB client or executing SQL:", e);
      return res.status(500).json({
        error: "Error executing SQL",
        details: e.message,
        sql: sqlText,
      });
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Server error fetching products" });
  }
});

app.get("/api/ai-first/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const text = await getFirstGeminiResponse(query, prompt);

    // Log the returned string (not text property of it)
    console.log("AI route returning:", text);

    // Send back as plain text or JSON depending on your client expectation
    return res.status(200).send(text);
    // or: return res.json({ text });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Server error fetching products" });
  }
});

async function getGeminiResponse(question, prompt) {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
      config: {
        systemInstruction: prompt[0],
      },
    });

    console.log(response.text);

    // Extract text output
    // const response = await result.response;
    const text = response.text;

    return text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Error generating response.";
  }
}
async function getFirstGeminiResponse(question, prompt) {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
      config: {
        systemInstruction: prompt[1],
      },
    });

    console.log(response.text);

    const text = response?.text ?? response?.output?.[0]?.content?.text ?? "";

    return text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Error generating response.";
  }
}

const prompt = [
  "You are an expert at converting natural language to SQL queries! " +
    "There are four SQL tables named 'gibbo', 'sampars', 'pricesmart', and 'loshusans', " +
    "each with the same columns: id, name, type, category, price, description, store, parish, created_at, on_deal, old_price, image_url. \n\n" +
    "Your task: Convert user requests in natural language into accurate SQL queries. " +
    "The SQL must combine all four tables when necessary, to find the item across all tables and compare their prices. " +
    "Always return results sorted by price ascending so the cheapest option is first. " +
    "Always return the first 5 results unless otherwise stated by the user " +
    "Do not include <code> or the word 'sql' in your output.\n\n" +
    "Here are examples of how to respond:\n\n" +
    // === BASIC QUERIES ===
    "Example 1 - How many entries are present? \n" +
    "SELECT COUNT(*) FROM (\n" +
    "  SELECT * FROM gibbo\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans\n" +
    ") AS all_tables;\n\n" +
    "Example 2 - Tell me all the products with the type soap. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE type ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE type ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE type ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE type ILIKE '%soap%'\n" +
    ") AS all_tables;\n\n" +
    "Example 2.5 - Soap. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE type ILIKE '%soap%' OR name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE type ILIKE '%soap%' OR name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE type ILIKE '%soap%' OR name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE type ILIKE '%soap%' OR name ILIKE '%soap%'\n" +
    ") AS all_tables ORDER BY price ASC LIMIT 5;\n\n" +
    // === PRICE-BASED COMPARISONS ===
    "Example 3 - Which store has the cheapest price for milk? \n" +
    "SELECT store, parish, price FROM (\n" +
    "  SELECT store, parish, price FROM gibbo WHERE name ILIKE '%milk%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM sampars WHERE name ILIKE '%milk%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM pricesmart WHERE name ILIKE '%milk%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM loshusans WHERE name ILIKE '%milk%'\n" +
    ") AS all_tables ORDER BY price ASC LIMIT 1;\n\n" +
    "Example 4 - Show me the top 5 cheapest rice products. \n" +
    "SELECT name, store, parish, price FROM (\n" +
    "  SELECT name, store, parish, price FROM gibbo WHERE name ILIKE '%rice%'\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, price FROM sampars WHERE name ILIKE '%rice%'\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, price FROM pricesmart WHERE name ILIKE '%rice%'\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, price FROM loshusans WHERE name ILIKE '%rice%'\n" +
    ") AS all_tables ORDER BY price ASC LIMIT 5;\n\n" +
    "Example 5 - Compare the price of bread across all stores. \n" +
    "SELECT store, parish, price FROM (\n" +
    "  SELECT store, parish, price FROM gibbo WHERE name ILIKE '%bread%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM sampars WHERE name ILIKE '%bread%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM pricesmart WHERE name ILIKE '%bread%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, parish, price FROM loshusans WHERE name ILIKE '%bread%'\n" +
    ") AS all_tables ORDER BY price ASC;\n\n" +
    // === DEALS & DISCOUNTS ===
    "Example 6 - Which products are currently on deal? \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE on_deal = TRUE\n" +
    ") AS all_tables;\n\n" +
    "Example 7 - What are the biggest discounts available right now? \n" +
    "SELECT name, store, parish, old_price, price, (old_price - price) AS discount_amount FROM (\n" +
    "  SELECT name, store, parish, old_price, price FROM gibbo WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, old_price, price FROM sampars WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, old_price, price FROM pricesmart WHERE on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT name, store, parish, old_price, price FROM loshusans WHERE on_deal = TRUE\n" +
    ") AS all_tables ORDER BY discount_amount DESC;\n\n" +
    // === LOCATION FILTERS ===
    "Example 8 - Show me all the deals available in Kingston. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE parish ILIKE '%Kingston%' AND on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE parish ILIKE '%Kingston%' AND on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE parish ILIKE '%Kingston%' AND on_deal = TRUE\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE parish ILIKE '%Kingston%' AND on_deal = TRUE\n" +
    ") AS all_tables;\n\n" +
    "Example 9 - Find the cheapest detergent in St. Andrew. \n" +
    "SELECT store, price FROM (\n" +
    "  SELECT store, price FROM gibbo WHERE parish ILIKE '%St. Andrew%' AND name ILIKE '%detergent%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM sampars WHERE parish ILIKE '%St. Andrew%' AND name ILIKE '%detergent%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM pricesmart WHERE parish ILIKE '%St. Andrew%' AND name ILIKE '%detergent%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM loshusans WHERE parish ILIKE '%St. Andrew%' AND name ILIKE '%detergent%'\n" +
    ") AS all_tables ORDER BY price ASC LIMIT 1;\n\n" +
    // === CATEGORY AND TYPE SEARCH ===
    "Example 10 - List all beverages available. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE category ILIKE '%beverage%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE category ILIKE '%beverage%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE category ILIKE '%beverage%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE category ILIKE '%beverage%'\n" +
    ") AS all_tables;\n\n" +
    "Example 11 - Show me all products under the category snacks with price below 500. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE category ILIKE '%snack%' AND price < 500\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE category ILIKE '%snack%' AND price < 500\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE category ILIKE '%snack%' AND price < 500\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE category ILIKE '%snack%' AND price < 500\n" +
    ") AS all_tables;\n\n" +
    // === TIME-BASED QUERIES ===
    "Example 12 - What are the latest products added this week? \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE created_at >= NOW() - INTERVAL '7 days'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE created_at >= NOW() - INTERVAL '7 days'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE created_at >= NOW() - INTERVAL '7 days'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE created_at >= NOW() - INTERVAL '7 days'\n" +
    ") AS all_tables ORDER BY created_at DESC;\n\n" +
    // === DESCRIPTION SEARCH ===
    "Example 13 - Find products that mention 'organic' in their description. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE description ILIKE '%organic%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE description ILIKE '%organic%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE description ILIKE '%organic%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE description ILIKE '%organic%'\n" +
    ") AS all_tables;\n\n" +
    // === STORE-SPECIFIC ===
    "Example 14 - Show all products sold by MegaMart. \n" +
    "SELECT * FROM (\n" +
    "  SELECT * FROM gibbo WHERE store ILIKE '%MegaMart%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM sampars WHERE store ILIKE '%MegaMart%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM pricesmart WHERE store ILIKE '%MegaMart%'\n" +
    "  UNION ALL\n" +
    "  SELECT * FROM loshusans WHERE store ILIKE '%MegaMart%'\n" +
    ") AS all_tables;\n\n" +
    "Example 15 - Which store in St. James has the lowest prices overall? \n" +
    "SELECT store, AVG(price) AS avg_price FROM (\n" +
    "  SELECT store, price FROM gibbo WHERE parish ILIKE '%St. James%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM sampars WHERE parish ILIKE '%St. James%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM pricesmart WHERE parish ILIKE '%St. James%'\n" +
    "  UNION ALL\n" +
    "  SELECT store, price FROM loshusans WHERE parish ILIKE '%St. James%'\n" +
    ") AS all_tables GROUP BY store ORDER BY avg_price ASC LIMIT 1;\n\n" +
    // === FLEXIBLE PRICE COMPARISONS ===
    "Example 16 - Compare chicken prices between Kingston and St. Catherine. \n" +
    "SELECT parish, store, price FROM (\n" +
    "  SELECT parish, store, price FROM gibbo WHERE name ILIKE '%chicken%' AND parish IN ('Kingston','St. Catherine')\n" +
    "  UNION ALL\n" +
    "  SELECT parish, store, price FROM sampars WHERE name ILIKE '%chicken%' AND parish IN ('Kingston','St. Catherine')\n" +
    "  UNION ALL\n" +
    "  SELECT parish, store, price FROM pricesmart WHERE name ILIKE '%chicken%' AND parish IN ('Kingston','St. Catherine')\n" +
    "  UNION ALL\n" +
    "  SELECT parish, store, price FROM loshusans WHERE name ILIKE '%chicken%' AND parish IN ('Kingston','St. Catherine')\n" +
    ") AS all_tables ORDER BY price ASC;\n\n" +
    // === MISC ===
    "Example 17 - Show me all unique categories. \n" +
    "SELECT DISTINCT category FROM (\n" +
    "  SELECT category FROM gibbo\n" +
    "  UNION ALL\n" +
    "  SELECT category FROM sampars\n" +
    "  UNION ALL\n" +
    "  SELECT category FROM pricesmart\n" +
    "  UNION ALL\n" +
    "  SELECT category FROM loshusans\n" +
    ") AS all_tables;\n\n" +
    "Example 18 - What is the average price of soap? \n" +
    "SELECT AVG(price) FROM (\n" +
    "  SELECT price FROM gibbo WHERE name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT price FROM sampars WHERE name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT price FROM pricesmart WHERE name ILIKE '%soap%'\n" +
    "  UNION ALL\n" +
    "  SELECT price FROM loshusans WHERE name ILIKE '%soap%'\n" +
    ") AS all_tables;\n\n" +
    "Always output only the SQL query as your answer.",

  "You are an shopping assistant providing responses to the user to display on the screen! " +
    "Your task: Respond to user requests as a chat bot. " +
    "Here are examples of how to respond:\n\n" +
    "Example 1 - How many entries are present? \n" +
    "Here are the entries I found\n\n" +
    "Example 2 - Tell me all the products with the type soap. \n" +
    "This is what if found for products of type soap;\n\n" +
    "Example 2.5 - Soap. \n" +
    "Here are some soaps I found ;\n\n",
];

//Function to initialize database, not yet called/started
async function initDB() {
  try {
    await sql`
          CREATE TABLE IF NOT EXISTS gibbo(
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            type VARCHAR(100) NOT NULL,
            category VARCHAR(100) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            description TEXT,
            store VARCHAR(100),
            parish VARCHAR(100),
            created_at DATE NOT NULL DEFAULT CURRENT_DATE,
            on_deal BOOLEAN DEFAULT FALSE,
            old_price DECIMAL(10, 2),
            image_url TEXT,
            link TEXT

        )`;
    console.log("Database initialized successfully");
  } catch (error) {
    console.log("Error initializing DB", error);
    process.exit(1);
  }
}

//Start server after ensuring database is ready
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
