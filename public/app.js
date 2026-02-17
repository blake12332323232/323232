let selectedGuild = null;
let selectedChannel = null;
let channelsCache = [];
let membersCache = [];

let ws = new WebSocket(`ws://${location.host}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if(data.type==="newMessage" && data.channelId===selectedChannel)
        addMessage(data.author,data.content);
};

async function loadGuilds() {
    const res = await fetch("/guilds");
    const guilds = await res.json();
    const list = document.getElementById("guildList");
    list.innerHTML="";
    guilds.forEach(g=>{
        const li=document.createElement("li");
        li.innerText=g.name;
        li.onclick=()=>selectGuild(g.id);
        list.appendChild(li);
    });
}

async function selectGuild(id){
    selectedGuild=id;
    await loadChannels(id);
    await loadMembers(id);
}

async function loadChannels(guildId){
    const res=await fetch(`/channels/${guildId}`);
    channelsCache=await res.json();
    renderChannels(channelsCache);
}

function renderChannels(listData){
    const list=document.getElementById("channelList");
    list.innerHTML="";
    listData.forEach(c=>{
        const li=document.createElement("li");
        li.innerText="#"+c.name;
        li.onclick=()=>selectChannel(c.id,c.name);
        list.appendChild(li);
    });
}

function filterChannels(search){
    renderChannels(channelsCache.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())));
}

function selectChannel(id,name){
    selectedChannel=id;
    document.getElementById("channelTitle").innerText="#"+name;
    document.getElementById("messages").innerHTML="";
}

async function loadMembers(guildId){
    const res=await fetch(`/members/${guildId}`);
    membersCache=await res.json();
    renderMembers(membersCache);
}

function renderMembers(listData){
    const list=document.getElementById("memberList");
    list.innerHTML="";
    listData.forEach(m=>{
        const li=document.createElement("li");
        li.innerHTML=`${m.username} 
            <button onclick="kickMember('${m.id}')">Kick</button>
            <button onclick="banMember('${m.id}')">Ban</button>`;
        list.appendChild(li);
    });
}

function filterMembers(search){
    renderMembers(membersCache.filter(m=>m.username.toLowerCase().includes(search.toLowerCase())));
}

async function kickMember(userId){
    await fetch(`/kick/${selectedGuild}/${userId}`,{method:"POST"});
    alert("Member kicked"); loadMembers(selectedGuild);
}

async function banMember(userId){
    await fetch(`/ban/${selectedGuild}/${userId}`,{method:"POST"});
    alert("Member banned"); loadMembers(selectedGuild);
}

async function sendMessage(){
    const input=document.getElementById("messageInput");
    if(!selectedChannel)return;
    await fetch(`/send/${selectedChannel}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:input.value})
    });
    input.value="";
}

function addMessage(author,content){
    const div=document.createElement("div");
    div.className="message";
    div.innerHTML=`<strong>${author}</strong>: ${content} <button onclick="deleteMessage(this)">X</button>`;
    document.getElementById("messages").appendChild(div);
}

function deleteMessage(button){
    button.parentElement.remove();
}

function openEmbedBuilder(){ document.getElementById("embedModal").classList.remove("hidden"); }
function closeEmbed(){ document.getElementById("embedModal").classList.add("hidden"); }

async function sendEmbed(){
    await fetch(`/embed/${selectedChannel}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            title:embedTitle.value,
            description:embedDesc.value,
            color:parseInt(embedColor.value||"5865F2",16),
            footer:embedFooter.value
        })
    });
    closeEmbed();
}

function toggleTheme(){ document.body.classList.toggle("light"); }

function openLogs(){ document.getElementById("logsPanel").classList.remove("hidden"); loadLogs(); }
function closeLogs(){ document.getElementById("logsPanel").classList.add("hidden"); }
async function loadLogs(){
    const res=await fetch("/logs");
    const logs=await res.json();
    const container=document.getElementById("logsContainer");
    container.innerHTML="";
    logs.forEach(l=>{
        const div=document.createElement("div");
        div.innerText=`[${l.timestamp}] ${l.action}`;
        container.appendChild(div);
    });
}

function openCommandPanel(){ document.getElementById("commandPanel").classList.remove("hidden"); }
function closeCommandPanel(){ document.getElementById("commandPanel").classList.add("hidden"); }

async function executeCommand(){
    const name=document.getElementById("commandName").value.replace("/","");
    const args=document.getElementById("commandArgs").value || "{}";
    await fetch(`/execute/${selectedGuild}/${name}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:args
    });
    alert("Command executed");
    closeCommandPanel();
}

loadGuilds();
