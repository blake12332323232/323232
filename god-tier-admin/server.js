// server.js
const express = require("express");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE;
const BOT_TOKEN = process.env.BOT_TOKEN;

// --- Discord Bot Setup ---
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

bot.login(BOT_TOKEN);

bot.on("ready", () => {
  console.log(`Bot logged in as ${bot.user.tag}`);
});

// --- SQLite Database Setup ---
const db = new sqlite3.Database("database.sqlite");
db.run(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  timestamp TEXT
)`);

// --- WebSocket Server ---
const wss = new WebSocket.Server({ noServer: true });
let sockets = [];

wss.on("connection", (ws) => {
  sockets.push(ws);
  ws.on("close", () => {
    sockets = sockets.filter(s => s !== ws);
  });
});

// Broadcast function
function broadcast(data) {
  sockets.forEach(ws => ws.send(JSON.stringify(data)));
}

// --- Express Middleware ---
app.use(express.json());

// --- Serve static frontend ---
app.use(express.static(path.join(__dirname, "public")));

// --- Login Route (simple access code) ---
app.post("/login", (req, res) => {
  const { code } = req.body;
  if (code === ACCESS_CODE) res.json({ success: true });
  else res.status(401).json({ success: false });
});

// --- Redirect / to login page ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --- API Routes ---

// Get all guilds the bot is in
app.get("/guilds", (req, res) => {
  const guilds = bot.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

// Get members of a guild
app.get("/members/:guildId", async (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json([]);
  await guild.members.fetch(); // fetch all members
  const members = guild.members.cache.map(m => ({
    id: m.id,
    username: m.user.username
  }));
  res.json(members);
});

// Get channels of a guild
app.get("/channels/:guildId", (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json([]);
  const channels = guild.channels.cache
    .filter(c => c.isTextBased())
    .map(c => ({ id: c.id, name: c.name }));
  res.json(channels);
});

// Send message to channel
app.post("/send/:channelId", async (req, res) => {
  const channel = bot.channels.cache.get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  await channel.send(req.body.message);
  broadcast({ type: "newMessage", channelId: channel.id, author: bot.user.username, content: req.body.message });

  db.run("INSERT INTO logs(action,timestamp) VALUES(?,?)",
    [`Sent message to #${channel.name}`, new Date().toISOString()]);
  res.json({ success: true });
});

// Kick member
app.post("/kick/:guildId/:userId", async (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    const member = await guild.members.fetch(req.params.userId);
    await member.kick();
    db.run("INSERT INTO logs(action,timestamp) VALUES(?,?)",
      [`Kicked ${member.user.tag}`, new Date().toISOString()]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Ban member
app.post("/ban/:guildId/:userId", async (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    const member = await guild.members.fetch(req.params.userId);
    await member.ban();
    db.run("INSERT INTO logs(action,timestamp) VALUES(?,?)",
      [`Banned ${member.user.tag}`, new Date().toISOString()]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Send embed
app.post("/embed/:channelId", async (req, res) => {
  const channel = bot.channels.cache.get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const { title, description, color, footer } = req.body;
  await channel.send({ embeds: [{ title, description, color, footer: { text: footer } }] });
  db.run("INSERT INTO logs(action,timestamp) VALUES(?,?)",
    [`Sent embed to #${channel.name}`, new Date().toISOString()]);
  res.json({ success: true });
});

// Execute slash command (basic)
app.post("/execute/:guildId/:command", async (req, res) => {
  // You can expand this to actually run real slash commands via Discord API
  db.run("INSERT INTO logs(action,timestamp) VALUES(?,?)",
    [`Executed command /${req.params.command}`, new Date().toISOString()]);
  res.json({ success: true });
});

// Get admin logs
app.get("/logs", (req, res) => {
  db.all("SELECT * FROM logs ORDER BY id DESC LIMIT 50", [], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// --- WebSocket Upgrade for real-time messages ---
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
