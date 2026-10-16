import dotenv from "dotenv";
// Load environment variables in development at the very top
dotenv.config();

import express from "express";
import path from "path";
import app from "./src/server/app.js";

const PORT = Number(process.env.PORT) || 4005;

async function startServer() {
  if (process.env.VERCEL) {
    console.log("[PSCQUBE Server] Running in Vercel serverless environment (Anti-timeout 8s & CDN Cache-Control enabled). Dynamic port listening is bypassed.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PSCQUBE Server] Modular backend running on port ${PORT}`);
  });
}

startServer();

export default app;
