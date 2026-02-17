let selectedGuild = null;
let selectedChannel = null;
let ws = new WebSocket(`ws://${location.host}`);

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);

    if (data.type === "newMessage" && data.channelId === selectedChannel) {
        addMessage(data.author, data.content);
    }
};

async function loadGuilds() {
    const res = await fetch("/guilds");
    const guilds = await res.json();

    const list = document.getElementById("guildList");
    list.innerHTML = "";

    guilds.forEach(g => {
        const li = document.createElement("li");
        li.innerText = g.name;
        li.onclick = () => selectGuild(g.id);
        list.appendChild(li);
    });
}

async function selectGuild(guildId) {
    selectedGuild = guildId;
    loadChannels(guildId);
    loadMembers(guildId);
}

async function loadChannels(guildId) {
    const res = await fetch(`/channels/${guildId}`);
    const channels = await res.json();

    const list = document.getElementById("channelList");
    list.innerHTML = "";

    channels.forEach(c => {
        const li = document.createElement("li");
        li.innerText = "#" + c.name;
        li.onclick = () => selectChannel(c.id, c.name);
        list.appendChild(li);
    });
}

function selectChannel(channelId, name) {
    selectedChannel = channelId;
    document.getElementById("channelTitle").innerText = "#" + name;
    document.getElementById("messages").innerHTML = "";
}

async function loadMembers(guildId) {
    const res = await fetch(`/members/${guildId}`);
    const members = await res.json();

    const list = document.getElementById("memberList");
    list.innerHTML = "";

    members.forEach(m => {
        const li = document.createElement("li");
        li.innerText = m.username;
        list.appendChild(li);
    });
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    if (!selectedChannel) return;

    await fetch(`/send/${selectedChannel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.value })
    });

    input.value = "";
}

function addMessage(author, content) {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>${author}</strong>: ${content}`;
    document.getElementById("messages").appendChild(div);
}

loadGuilds();
