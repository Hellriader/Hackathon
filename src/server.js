import express, { response } from "express";
import dotenv from "dotenv";
//import { sql } from "./config/db.js";

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

//Function to initialize database, not yet called/started
async function initDB() {
  try {
    await sql`
          CREATE TABLE IF NOT EXISTS pricesmart(
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
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
            url TEXT

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
