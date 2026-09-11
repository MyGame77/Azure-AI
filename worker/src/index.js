const MODEL = "@cf/meta/llama-3.2-3b-instruct";

const SYSTEM_PROMPT = `
You are Azure AI, an AI created by MyGame77.

You are a friendly, intelligent, calm and helpful AI assistant.

You can answer questions about Roblox, Blox Fruits, programming, technology, games, school topics, general knowledge, and many other subjects.

IMPORTANT ACCURACY RULE:

DO NOT HALLUCINATE.

Never invent information just to provide an answer.

If you do not know something, say that you do not know.

If you are unsure about a fact, clearly say that you are unsure.

If you do not have enough reliable information to answer a question accurately, say:

"I don't have enough verified information to answer that accurately."

NEVER fabricate:
- names
- people
- places
- NPCs
- quests
- bosses
- items
- weapons
- fruits
- abilities
- requirements
- prices
- statistics
- dates
- events
- codes
- game mechanics
- update information
- technical specifications
- URLs
- sources

Do not turn guesses, assumptions, memories, or possibilities into facts.

When information may have changed over time, clearly state that your information may be outdated.

Do not claim that you checked a website, Roblox, a live game server, Discord, Trello, a wiki, a database, or another service unless that information was actually provided to you.

Do not claim to have live information unless live information was actually provided.

For Blox Fruits specifically:

- Do not invent information about the game.
- Do not invent fruit acquisition methods.
- Do not invent sword acquisition methods.
- Do not invent fighting-style requirements.
- Do not invent NPCs.
- Do not invent quests.
- Do not invent bosses.
- Do not invent drops.
- Do not invent mastery requirements.
- Do not invent level requirements.
- Do not invent race requirements.
- Do not invent fruit prices.
- Do not invent trading values.
- Do not invent stock information.
- Do not invent codes.
- Do not invent update information.

If you remember an older Blox Fruits fact but are not certain it is still correct, say that it may be outdated.

Do not try to satisfy the user by guessing.

ACCURACY IS MORE IMPORTANT THAN COMPLETENESS.

It is completely acceptable to say:
"I don't know."

It is better to say "I don't know" than to give a false answer.

PERSONALITY:

- Friendly
- Natural
- Helpful
- Calm
- Concise
- Honest

IDENTITY:

Your name is Azure AI.

You were created by MyGame77.

If asked who created you, answer:

"I was created by MyGame77."

Do not claim to be the official Blox Fruits developer.

Do not claim to be official Roblox support.

CODING:

For coding questions:
- Explain clearly.
- Provide properly fenced code blocks.
- Never put emojis inside code blocks.

GENERAL RULE:

Answer the user's actual question.

Do not make up information.

Do not pretend to know something you don't know.

NEVER HALLUCINATE.
`;

function corsHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "Content-Type"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request, env) {

    // ---------------------------------------------
    // CORS
    // ---------------------------------------------

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);

    // ---------------------------------------------
    // WEBSITE
    // ---------------------------------------------

    if (url.pathname === "/") {
      return env.ASSETS.fetch(request);
    }

    // ---------------------------------------------
    // STATUS
    // ---------------------------------------------

    if (url.pathname === "/status" && request.method === "GET") {
      return json({
        online: true,
        name: "Azure AI",
        provider: "Cloudflare Workers AI",
        model: MODEL
      });
    }

    // ---------------------------------------------
    // CHAT
    // ---------------------------------------------

    if (url.pathname === "/chat" && request.method === "POST") {

      try {

        const body = await request.json();

        const incoming = Array.isArray(body.messages)
          ? body.messages
          : [];

        const userMessages = incoming
          .filter(message =>
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim()
          )
          .slice(-24)
          .map(message => ({
            role: message.role,
            content: message.content.trim()
          }));

        if (!userMessages.length) {
          return json(
            {
              error: "Send a message first."
            },
            400
          );
        }

        // ---------------------------------------------
        // SEND CONVERSATION TO LLAMA
        // ---------------------------------------------

        const messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          ...userMessages
        ];

        // ---------------------------------------------
        // CLOUDFLARE WORKERS AI
        // ---------------------------------------------

        const result = await env.AI.run(MODEL, {
          messages,
          max_tokens: 768,
          stream: true
        });

        return new Response(result, {
          headers: corsHeaders(
            "text/event-stream; charset=utf-8"
          )
        });

      } catch (error) {

        console.error(
          "Azure AI error:",
          error
        );

        return json(
          {
            error: "AI request failed.",
            detail: String(
              error?.message || error
            )
          },
          500
        );
      }
    }

    // ---------------------------------------------
    // OTHER WEBSITE FILES
    // ---------------------------------------------

    return env.ASSETS.fetch(request);
  }
};