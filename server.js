import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PROVIDER = process.env.PROVIDER || "ollama"; // 'ollama' or 'custom'
const MODEL    = process.env.MODEL    || "llama3.1:8b"; // adjust if you like

// --- Provider adapters -------------------------------------------------------

// 1) Local: Ollama (https://ollama.com) — `ollama serve` must be running and model pulled.
async function callOllama({ system, messages }) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        ...(system ? [{ role:"system", content: system }] : []),
        ...messages
      ]
    })
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.message?.content?.trim();
}

// 2) Custom cloud provider placeholder (wire in your favorite API here).
async function callCustom({ system, messages }) {
  // Example skeleton:
  // const res = await fetch("https://provider.example.com/chat", { ... });
  // return parsedText;
  throw new Error("No cloud provider configured. Set PROVIDER=ollama (default) or implement callCustom().");
}

// ----------------------------------------------------------------------------

const systemPrompt = `
You are a concise, friendly assistant for a website. 
- Be helpful, clear, and honest.
- If you don’t know, say so briefly and propose the next best step.
- Prefer short paragraphs and bullet points.
`.trim();

app.post("/chat", async (req, res) => {
  try {
    const { history = [], message = "" } = req.body || {};
    const messages = history.concat([{ role:"user", content: message }]);

    let reply;
    if (PROVIDER === "ollama") {
      reply = await callOllama({ system: systemPrompt, messages });
    } else {
      reply = await callCustom({ system: systemPrompt, messages });
    }
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chat_failed" });
  }
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => console.log(`chat server listening on http://localhost:${PORT}`));
