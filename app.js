const API="https://azure-ai.mygame77123.workers.dev";
const STORAGE="eternal_crimson_chats_v1";

const chat=document.getElementById("chat");
const welcome=document.getElementById("welcome");
const form=document.getElementById("form");
const input=document.getElementById("input");
const send=document.getElementById("send");
const statusEl=document.getElementById("status");
const conversationsEl=document.getElementById("conversations");

let state=loadState();

function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE));
    if(saved?.conversations?.length) return saved;
  }catch{}
  return {currentId:crypto.randomUUID(),conversations:[{id:null,title:"New chat",messages:[]}]};
}
if(!state.conversations[0].id) state.conversations[0].id=state.currentId;

function save(){localStorage.setItem(STORAGE,JSON.stringify(state));}
function current(){return state.conversations.find(c=>c.id===state.currentId)||state.conversations[0];}

function titleFrom(text){
  const clean=text.replace(/\s+/g," ").trim();
  return clean.length>34?clean.slice(0,34)+"…":clean||"New chat";
}

function renderSidebar(){
  conversationsEl.innerHTML="";
  [...state.conversations].reverse().forEach(c=>{
    const row=document.createElement("div");
    row.className="convo"+(c.id===state.currentId?" active":"");
    row.onclick=()=>switchChat(c.id);
    const title=document.createElement("div");
    title.className="convo-title"; title.textContent=c.title;
    const del=document.createElement("button");
    del.className="convo-delete"; del.textContent="×"; del.title="Delete chat";
    del.onclick=e=>{e.stopPropagation();deleteChat(c.id)};
    row.append(title,del); conversationsEl.appendChild(row);
  });
}

function switchChat(id){
  state.currentId=id; save(); renderChat(); renderSidebar();
}

function newChat(){
  const c={id:crypto.randomUUID(),title:"New chat",messages:[]};
  state.conversations.push(c); state.currentId=c.id; save(); renderChat(); renderSidebar(); input.focus();
}

function deleteChat(id){
  if(state.conversations.length===1){state.conversations[0].messages=[];state.conversations[0].title="New chat";state.currentId=state.conversations[0].id}
  else{state.conversations=state.conversations.filter(c=>c.id!==id);if(state.currentId===id)state.currentId=state.conversations[state.conversations.length-1].id}
  save();renderChat();renderSidebar();
}

function clearCurrent(){
  const c=current(); c.messages=[]; c.title="New chat"; save(); renderChat(); renderSidebar();
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function inlineMd(s){
  s=escapeHtml(s);
  s=s.replace(/`([^`\n]+)`/g,"<code>$1</code>");
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  s=s.replace(/\*([^*]+)\*/g,"<em>$1</em>");
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

function renderMarkdown(text){
  const lines=text.replace(/\r/g,"").split("\n"), out=[];
  let inCode=false, code=[];
  for(const line of lines){
    if(line.trim().startsWith("```")){
      if(inCode){out.push("<pre><code>"+escapeHtml(code.join("\n"))+"</code></pre>");code=[];inCode=false}
      else inCode=true;
      continue;
    }
    if(inCode){code.push(line);continue}
    if(!line.trim()){out.push("");continue}
    if(/^#{1,3}\s/.test(line)) out.push("<h3>"+inlineMd(line.replace(/^#{1,3}\s/,""))+"</h3>");
    else if(/^\s*[-*]\s+/.test(line)) out.push("<li>"+inlineMd(line.replace(/^\s*[-*]\s+/,""))+"</li>");
    else out.push("<p>"+inlineMd(line)+"</p>");
  }
  if(inCode) out.push("<pre><code>"+escapeHtml(code.join("\n"))+"</code></pre>");
  let html=out.join("");
  html=html.replace(/(<li>.*?<\/li>)+/gs,m=>"<ul>"+m+"</ul>");
  return html;
}

function addMessage(role,text,stream=false){
  welcome.style.display="none";
  const row=document.createElement("div"); row.className=`message ${role}`;
  const bubble=document.createElement("div"); bubble.className="bubble";
  if(stream) bubble.innerHTML='<span class="typing-dot">●</span>';
  else bubble.innerHTML=role==="assistant"?renderMarkdown(text):escapeHtml(text).replace(/\n/g,"<br>");
  row.appendChild(bubble); chat.appendChild(row); chat.scrollTop=chat.scrollHeight;
  return bubble;
}

function renderChat(){
  chat.querySelectorAll(".message").forEach(x=>x.remove());
  const c=current();
  welcome.style.display=c.messages.length?"none":"block";
  c.messages.forEach(m=>addMessage(m.role,m.content));
  chat.scrollTop=chat.scrollHeight;
}

async function checkStatus(){
  if(API==="YOUR_WORKER_URL"){statusEl.textContent="Set your Worker URL in app.js";return}
  try{
    const r=await fetch(API+"/status"); const d=await r.json();
    statusEl.textContent=d.online?"● Online · MyGame AI":"○ Offline";
  }catch{statusEl.textContent="○ AI offline"}
}

function extractText(obj){
  if(typeof obj==="string")return obj;
  if(!obj||typeof obj!=="object")return "";
  return obj.response ?? obj.response?.text ?? obj.result?.response ?? obj.text ?? "";
}

async function streamChat(messages,bubble){
  const r=await fetch(API+"/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages})
  });

  if(!r.ok){
    let d={}; try{d=await r.json()}catch{}
    throw new Error(d.error||d.detail||`Request failed (${r.status})`);
  }

  if(!r.body) throw new Error("Streaming is not available in this browser.");

  const reader=r.body.getReader();
  const decoder=new TextDecoder();
  let buffer="", full="";

  function handleEvent(raw){
    const lines=raw.split(/\r?\n/);
    const dataLines=lines
      .filter(line=>line.startsWith("data:"))
      .map(line=>line.slice(5).trimStart());

    if(!dataLines.length)return;

    const data=dataLines.join("\n").trim();
    if(!data || data==="[DONE]")return;

    try{
      const obj=JSON.parse(data);
      let piece="";

      if(typeof obj==="string") piece=obj;
      else piece=obj.response ?? obj.result?.response ?? obj.text ?? obj.choices?.[0]?.delta?.content ?? "";

      if(piece){
        full+=piece;
        bubble.innerHTML=renderMarkdown(full);
        chat.scrollTop=chat.scrollHeight;
      }
    }catch{
      // Ignore incomplete/non-JSON SSE events.
    }
  }

  while(true){
    const {value,done}=await reader.read();
    if(done)break;

    buffer+=decoder.decode(value,{stream:true});
    const events=buffer.split(/\r?\n\r?\n/);
    buffer=events.pop()||"";

    for(const event of events)handleEvent(event);
  }

  if(buffer.trim())handleEvent(buffer);

  if(!full) throw new Error("The AI returned an empty response.");
  return full;
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=input.value.trim(); if(!text)return;
  const c=current();
  if(!c.messages.length)c.title=titleFrom(text);
  c.messages.push({role:"user",content:text});
  save(); renderSidebar(); addMessage("user",text);
  input.value="";input.style.height="auto";send.disabled=true;
  const bubble=addMessage("assistant","",true);
  try{
    const reply=await streamChat(c.messages,bubble);
    c.messages.push({role:"assistant",content:reply}); save();
  }catch(err){
    bubble.innerHTML=renderMarkdown("Sorry — "+err.message);
  }finally{send.disabled=false;input.focus();}
});

input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,180)+"px"});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
document.getElementById("newChat").onclick=newChat;
document.getElementById("mobileNew").onclick=newChat;
document.getElementById("clearChat").onclick=clearCurrent;

renderSidebar();renderChat();checkStatus();save();
