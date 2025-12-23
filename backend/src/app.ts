
import express from "express";
import cors from "cors";
import routes from "./routes";
import webhookRoutes from "./routes/webhookRoutes";

const app = express();

// Middlewares: things that run before your route handlers
app.use(cors());
app.use(express.json()); // parse JSON request bodies

// Simple health check route
app.get("/health", (req, res) => {
res.json({ status: "ok", service: "HRFlow backend" });
});

// Mount webhook routes at root level (no /api prefix for clean external URLs)
app.use("/webhooks", webhookRoutes);

// Mount all API routes under /api
app.use("/api", routes);

export default app;
