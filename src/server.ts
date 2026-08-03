import { app, bootstrapDatabase } from "./app"; // Adjust path as needed
import config from "./config";

const startServer = async () => {
  try {
    // 1. Execute the database initialization & migrations FIRST
    await bootstrapDatabase();


    app.listen(config.port || 5000, () => {
      console.log(`Server is running on port ${config.port || 5000}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();