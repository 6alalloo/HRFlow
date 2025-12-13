import path from "path";
import dotenv from "dotenv";

// always load backend/.env (even if process is started from repo root)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import app from "./app";


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`HRFlow backend running on http://localhost:${PORT}`);
});
