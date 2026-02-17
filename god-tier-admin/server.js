require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const SQLite = require("better-sqlite3");
const WebSocket = require("ws");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.ACCESS_CODE,
    resave: false,
    saveUninitialized: false
}));

// ===== DATABASE =====

const db = new SQLite("database.sqlite");
db.prepare(`
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    timestamp TEXT
)
`).run();

// ===== BOT =====

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.login(process.env.BOT_TOKEN);

client.once("ready", () => {
    console.log("God Tier Ready:", client.user.tag);
});

// ===== REAL-TIME MESSAGE STREAM =====

client.on("messageCreate", msg => {
    const data = JSON.stringify({
        type: "newMessage",
        channelId: msg.channel.id,
        author: msg.author.username,
        content: msg.content
    });

    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });
});

// ===== AUTH =====

app.post("/login", (req, res) => {
    if (req.body.code === process.env.ACCESS_CODE) {
        req.session.auth = true;
        return res.json({ success: true });
    }
    res.json({ success: false });
});

function auth(req, res, next) {
    if (!req.session.auth) return res.redirect("/login.html");
    next();
}

// ===== SERVERS LIST =====

app.get("/guilds", auth, async (req, res) => {
    const guilds = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name
    }));
    res.json(guilds);
});

// ===== CHANNELS =====

app.get("/channels/:guildId", auth, async (req, res) => {
    const guild = await client.guilds.fetch(req.params.guildId);
    const channels = await guild.channels.fetch();
    res.json(
        channels.filter(c => c.isTextBased())
        .map(c => ({ id: c.id, name: c.name }))
    );
});

// ===== SEND MESSAGE =====

app.post("/send/:channelId", auth, async (req, res) => {
    const channel = await client.channels.fetch(req.params.channelId);
    await channel.send(req.body.message);
    log("Sent Message");
    res.json({ success: true });
});

// ===== EMBED BUILDER =====

app.post("/embed/:channelId", auth, async (req, res) => {
    const channel = await client.channels.fetch(req.params.channelId);

    const embed = new EmbedBuilder()
        .setTitle(req.body.title)
        .setDescription(req.body.description)
        .setColor(req.body.color || 0x5865F2);

    if (req.body.footer)
        embed.setFooter({ text: req.body.footer });

    if (req.body.thumbnail)
        embed.setThumbnail(req.body.thumbnail);

    if (req.body.fields)
        req.body.fields.forEach(f =>
            embed.addFields({ name: f.name, value: f.value, inline: true })
        );

    await channel.send({ embeds: [embed] });
    log("Sent Embed");
    res.json({ success: true });
});

// ===== MEMBER MANAGEMENT =====

app.get("/members/:guildId", auth, async (req, res) => {
    const guild = await client.guilds.fetch(req.params.guildId);
    const members = await guild.members.fetch();

    res.json(members.map(m => ({
        id: m.id,
        username: m.user.username
    })));
});

app.post("/kick/:guildId/:userId", auth, async (req, res) => {
    const guild = await client.guilds.fetch(req.params.guildId);
    await guild.members.kick(req.params.userId);
    log("Kicked Member");
    res.json({ success: true });
});

// ===== COMMAND SYSTEM =====

const commands = {
    ping: async (guild) => {
        if (guild.systemChannel)
            await guild.systemChannel.send("Pong from God Tier!");
    }
};

app.post("/execute/:guildId/:command", auth, async (req, res) => {
    const guild = await client.guilds.fetch(req.params.guildId);
    const cmd = req.params.command;

    if (commands[cmd]) {
        await commands[cmd](guild);
        log("Executed Command: " + cmd);
        return res.json({ success: true });
    }

    res.json({ success: false });
});

// ===== LOGGING =====

function log(action) {
    db.prepare("INSERT INTO logs (action, timestamp) VALUES (?, ?)")
      .run(action, new Date().toISOString());
}

app.get("/logs", auth, (req, res) => {
    const rows = db.prepare("SELECT * FROM logs ORDER BY id DESC").all();
    res.json(rows);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("God Tier Running"));
