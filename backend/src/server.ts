import path from "path";
import dotenv from "dotenv";

// Load .env from project root (two directories up from dist/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import app from "./app";


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`HRFlow backend running on http://localhost:${PORT}`);
});
