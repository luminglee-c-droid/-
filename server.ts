import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/db";
import { registerSocketHandlers } from "./src/socket";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server attached to HTTP server
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // Initialize SQLite persistence
  initDb();

  // Handle Socket connections
  registerSocketHandlers(io);

  app.use(express.json());

  // API Routes for REST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
