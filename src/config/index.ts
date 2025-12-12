import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
  port: process.env.PORT || 5000,

  // Database info
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",    
  database: process.env.DB_NAME || "testdb", 
  db_port: process.env.DB_PORT || 3306     
};

export default config;
