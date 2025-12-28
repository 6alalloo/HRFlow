
import express from "express";
import cors from "cors";
import routes from "./routes";
import webhookRoutes from "./routes/webhookRoutes";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Middleware configuration applied before route handlers
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Simple health check route
app.get("/health", (req, res) => {
res.json({ status: "ok", service: "HRFlow backend" });
});

// Mount webhook routes at root level (no /api prefix for clean external URLs)
app.use("/webhooks", webhookRoutes);

// Mount all API routes under /api
app.use("/api", routes);

// Error handlers 
app.use(notFoundHandler); // 404 handler for undefined routes
app.use(errorHandler); // Global error handler

export default app;
