import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import axios from "axios";

const db = new Database("database.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    admin_code TEXT NOT NULL,
    user_code TEXT NOT NULL,
    monthly_amount INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    secondary_password TEXT,
    current_tracking_month TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    receive_date TEXT,
    note_amount INTEGER DEFAULT 0,
    total_received INTEGER DEFAULT 0,
    is_paid TEXT DEFAULT '',
    FOREIGN KEY (group_id) REFERENCES groups (id)
  );
`);

// Seed initial data if empty
const groupCount = db.prepare("SELECT COUNT(*) as count FROM groups").get() as { count: number };
if (groupCount.count === 0) {
  const insertGroup = db.prepare("INSERT INTO groups (name, admin_code, user_code, monthly_amount, start_date, secondary_password) VALUES (?, ?, ?, ?, ?, ?)");
  const insertMember = db.prepare("INSERT INTO members (group_id, name) VALUES (?, ?)");

  const groupId = insertGroup.run("Dây tháng 5 (AdminA-UserB)", "AdminA", "UserB", 5000, "05/2024", "123").lastInsertRowid;
  ["Nguyễn Văn A", "Trần Thị B", "Lê Văn C", "Phạm Thị D", "Hoàng Văn E"].forEach(name => {
    insertMember.run(groupId, name);
  });
}

const GAS_URL = process.env.GAS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbySe5vgv20xcwQ1rUzX_j3k9iDJhFUQfslgzT_6M-HiMhd8AEc8o-Vth6S5cKuqkpxUAg/exec";
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1T8YaxIE_xWBMl4VNIfBnl3Njdtdi_wDkPQPHs9R81S0";

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper to fetch from GAS
  const fetchFromGAS = async (params?: any) => {
    if (!GAS_URL) return null;
    try {
      if (!params) {
        const res = await axios.get(GAS_URL);
        return res.data;
      } else {
        const res = await axios.post(GAS_URL, params);
        return res.data;
      }
    } catch (e) {
      console.error("GAS Error:", e);
      return null;
    }
  };

  // Auth & Data API
  app.post("/api/auth", async (req, res) => {
    const { code } = req.body;
    
    // Try Google Sheets first if URL exists
    const gasData = await fetchFromGAS();
    if (gasData) {
      if (code === "Anhdung1@") {
        const groups = gasData.map((g: any, idx: number) => ({
          id: idx,
          name: g.name,
          admin_code: g.name.match(/\((.*?)-/)?.[1] || '',
          user_code: g.name.match(/-(.*?)\)/)?.[1] || '',
          monthly_amount: g.monthly_amount,
          start_date: g.start_date,
          secondary_password: g.secondary_password,
          current_tracking_month: g.current_tracking_month
        }));
        return res.json({ role: "SUPER_ADMIN", groups });
      }

      const foundGroup = gasData.find((g: any) => {
        const adminCode = g.name.match(/\((.*?)-/)?.[1];
        const userCode = g.name.match(/-(.*?)\)/)?.[1];
        return adminCode === code || userCode === code;
      });

      if (foundGroup) {
        const adminCode = foundGroup.name.match(/\((.*?)-/)?.[1];
        const role = adminCode === code ? "ADMIN" : "USER";
        return res.json({ 
          role, 
          group: {
            id: gasData.indexOf(foundGroup),
            name: foundGroup.name,
            monthly_amount: foundGroup.monthly_amount,
            start_date: foundGroup.start_date,
            secondary_password: foundGroup.secondary_password,
            current_tracking_month: foundGroup.current_tracking_month
          } 
        });
      }
    }

    // Fallback to SQLite
    if (code === "Anhdung1@") {
      const groups = db.prepare("SELECT * FROM groups").all();
      return res.json({ role: "SUPER_ADMIN", groups });
    }
    const adminGroup = db.prepare("SELECT * FROM groups WHERE admin_code = ?").get(code);
    if (adminGroup) return res.json({ role: "ADMIN", group: adminGroup });
    const userGroup = db.prepare("SELECT * FROM groups WHERE user_code = ?").get(code);
    if (userGroup) return res.json({ role: "USER", group: userGroup });

    res.status(401).json({ error: "Mã truy cập không đúng" });
  });

  app.get("/api/group/:id/members", async (req, res) => {
    const gasData = await fetchFromGAS();
    if (gasData && gasData[req.params.id]) {
      return res.json(gasData[req.params.id].members);
    }
    const members = db.prepare("SELECT * FROM members WHERE group_id = ?").all(req.params.id);
    res.json(members);
  });

  app.post("/api/settle", async (req, res) => {
    const { groupId, memberId, receiveDate, noteAmount, password } = req.body;
    
    const gasData = await fetchFromGAS();
    if (gasData && gasData[groupId]) {
      const group = gasData[groupId];
      if (group.secondary_password && String(group.secondary_password) !== String(password)) {
        return res.status(403).json({ error: "Mật khẩu phụ không đúng" });
      }

      const members = group.members;
      const totalMembers = members.length;
      const countUnreceivedOthers = members.filter((m: any) => !m.receive_date).length - 1;
      
      // Formula: (TotalMembers - 1) * Monthly - (UnreceivedOthers * Bid)
      const totalReceived = (totalMembers - 1) * group.monthly_amount - (countUnreceivedOthers * noteAmount);

      // Find member row in GAS (memberId is the row index + offset in my GAS logic)
      await fetchFromGAS({
        action: 'settle',
        sheetName: group.name,
        row: memberId, // GAS uses row number
        receiveDate,
        noteAmount,
        totalReceived
      });
      return res.json({ success: true });
    }

    // SQLite Fallback
    const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId) as any;
    if (group.secondary_password && group.secondary_password !== password) {
      return res.status(403).json({ error: "Mật khẩu phụ không đúng" });
    }
    const members = db.prepare("SELECT * FROM members WHERE group_id = ?").all(groupId) as any[];
    const totalMembers = members.length;
    const countUnreceivedOthers = members.filter(m => !m.receive_date).length - 1;
    
    // Formula: (TotalMembers - 1) * Monthly - (UnreceivedOthers * Bid)
    const totalReceived = (totalMembers - 1) * group.monthly_amount - (countUnreceivedOthers * noteAmount);

    db.transaction(() => {
      db.prepare("UPDATE members SET receive_date = ?, note_amount = ?, total_received = ? WHERE id = ?")
        .run(receiveDate, noteAmount, totalReceived, memberId);
      db.prepare("UPDATE members SET is_paid = '' WHERE group_id = ?").run(groupId);
    })();
    res.json({ success: true });
  });

  app.post("/api/tracking", async (req, res) => {
    const { groupId, month } = req.body;
    const gasData = await fetchFromGAS();
    if (gasData && gasData[groupId]) {
      await fetchFromGAS({
        action: 'updateTracking',
        sheetName: gasData[groupId].name,
        month
      });
      return res.json({ success: true });
    }
    db.prepare("UPDATE groups SET current_tracking_month = ? WHERE id = ?").run(month, groupId);
    res.json({ success: true });
  });

  app.post("/api/payment/toggle", async (req, res) => {
    const { memberId, isPaid, groupId } = req.body; // Added groupId for GAS
    const gasData = await fetchFromGAS();
    if (gasData && groupId !== undefined && gasData[groupId]) {
      await fetchFromGAS({
        action: 'togglePayment',
        sheetName: gasData[groupId].name,
        row: memberId,
        isPaid
      });
      return res.json({ success: true });
    }
    db.prepare("UPDATE members SET is_paid = ? WHERE id = ?").run(isPaid ? 'x' : '', memberId);
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
