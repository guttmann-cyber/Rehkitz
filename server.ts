import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("rehkitz.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS search_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    search_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add columns if they don't exist (for existing databases)
const tableInfo = db.prepare("PRAGMA table_info(search_requests)").all() as any[];
const columns = tableInfo.map(col => col.name);

if (!columns.includes('status')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN status TEXT DEFAULT 'active'");
}
if (!columns.includes('search_date')) {
  // Default to current date if missing
  db.exec("ALTER TABLE search_requests ADD COLUMN search_date TEXT DEFAULT CURRENT_DATE");
}
if (!columns.includes('contact_name')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN contact_name TEXT DEFAULT ''");
}
if (!columns.includes('contact_phone')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN contact_phone TEXT DEFAULT ''");
}
if (!columns.includes('fawns_found')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN fawns_found INTEGER DEFAULT 0");
}
if (!columns.includes('photo')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN photo TEXT");
}
if (!columns.includes('area_ha')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN area_ha REAL");
}
if (!columns.includes('notes')) {
  db.exec("ALTER TABLE search_requests ADD COLUMN notes TEXT");
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.get("/api/requests", (req, res) => {
    const requests = db.prepare("SELECT * FROM search_requests ORDER BY created_at DESC").all();
    res.json(requests.map(r => ({
      ...r,
      area: JSON.parse(r.area as string)
    })));
  });

  app.post("/api/requests", (req, res) => {
    const { area, message, contact_name, contact_phone, search_date, area_ha, notes } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO search_requests (area, message, contact_name, contact_phone, search_date, status, area_ha, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `);
    
    const result = stmt.run(JSON.stringify(area), message, contact_name, contact_phone, search_date, area_ha, notes);
    const newRequest = {
      id: result.lastInsertRowid,
      area,
      message,
      contact_name,
      contact_phone,
      search_date,
      area_ha,
      notes,
      status: 'active',
      created_at: new Date().toISOString()
    };

    // Broadcast to all connected clients
    broadcast({ type: "NEW_REQUEST", payload: newRequest });

    res.json(newRequest);
  });

  app.patch("/api/requests/:id", (req, res) => {
    const { id } = req.params;
    const { status, message, contact_name, contact_phone, search_date, fawns_found, photo, area_ha, notes } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];

    if (status) { updates.push("status = ?"); params.push(status); }
    if (message) { updates.push("message = ?"); params.push(message); }
    if (contact_name) { updates.push("contact_name = ?"); params.push(contact_name); }
    if (contact_phone) { updates.push("contact_phone = ?"); params.push(contact_phone); }
    if (search_date) { updates.push("search_date = ?"); params.push(search_date); }
    if (fawns_found !== undefined) { updates.push("fawns_found = ?"); params.push(fawns_found); }
    if (photo !== undefined) { updates.push("photo = ?"); params.push(photo); }
    if (area_ha !== undefined) { updates.push("area_ha = ?"); params.push(area_ha); }
    if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE search_requests SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }
    
    const updated = db.prepare("SELECT * FROM search_requests WHERE id = ?").get(id) as any;
    const payload = { ...updated, area: JSON.parse(updated.area) };
    
    broadcast({ type: "UPDATE_REQUEST", payload });
    res.json(payload);
  });

  app.delete("/api/requests/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM search_requests WHERE id = ?").run(id);
    broadcast({ type: "DELETE_REQUEST", payload: { id: parseInt(id) } });
    res.json({ success: true });
  });

  // WebSocket handling
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
