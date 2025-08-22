const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const tpl  = document.getElementById("msg-tpl");

let KB = [];
fetch("faq.json").then(r => r.json()).then(data => KB = data);

function elMsg(text, who = "bot") {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.classList.add(who);
  const bubble = node.querySelector(".bubble");
  bubble.innerHTML = text;
  node.querySelector(".time").textContent = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  return node;
}

function addMessage(text, who = "bot") {
  const node = elMsg(text, who);
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
  return node;
}

function typingBubble() {
  const node = addMessage('<span class="typing">⎔</span> typing…', "bot");
  return { remove() { node.remove(); } };
}

function sanitize(t){ return t.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s])); }

// Tiny Markdown-ish formatter for code blocks, backticks, and links
function mdFormat(text){
  return sanitize(text)
    .replace(/```([\s\S]*?)```/g, (_,code)=>`<pre><code>${code}</code></pre>`)
    .replace(/`([^`]+)`/g, (_,c)=>`<code>${c}</code>`)
    .replace(/\b(https?:\/\/[^\s)]+)\b/g, url=>`<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

function bestAnswer(query) {
  const q = query.toLowerCase();
  // 1) regex keyword hit
  for (const item of KB) {
    const re = new RegExp(`\\b(${item.q})\\b`, "i");
    if (re.test(q)) return { a: item.a, why: "faq" };
  }
  // 2) simple score
  let best = {score: 0, a: null};
  for (const item of KB) {
    const keys = item.q.split("|");
    let score = 0;
    for (const k of keys) if (q.includes(k)) score += 1;
    if (score > best.score) best = {score, a: item.a};
  }
  if (best.a) return { a: best.a, why: "faq" };
  return { a: null, why: "none" };
}

async function askLLM(history, userText) {
  // Calls your backend; backend chooses provider (local/cloud).
  const res = await fetch("/chat", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ history, message: userText })
  });
  if (!res.ok) throw new Error("Chat error");
  const data = await res.json();
  return data.reply;
}

const history = []; // {role:"user"|"assistant", content:"..."}

addMessage("Hi! I’m your virtual assistant. How can I help you today?");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage(mdFormat(text), "user");
  history.push({ role:"user", content:text });

  const t = typingBubble();

  try {
    // Try FAQ first
    const fa = bestAnswer(text);
    let answer;
    if (fa.a) {
      answer = fa.a;
    } else {
      // Fallback to LLM
      const reply = await askLLM(history, text);
      answer = reply || "I’m not sure yet. Could you rephrase?";
    }
    t.remove();
    addMessage(mdFormat(answer), "bot");
    history.push({ role:"assistant", content: answer });
  } catch (err) {
    t.remove();
    addMessage("Hmm, I hit a snag talking to the brain. Please try again.", "bot");
    console.error(err);
  }
});
