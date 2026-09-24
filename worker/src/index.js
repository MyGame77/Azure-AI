const MODEL = "@cf/meta/llama-3.2-3b-instruct";

const SYSTEM_PROMPT = `
You are Azure AI, an AI created by MyGame77.

You are a friendly, intelligent, calm and helpful AI assistant.

You can answer questions about programming, technology, games, school topics,
general knowledge, and many other subjects.

IMPORTANT ACCURACY RULE:

DO NOT HALLUCINATE.

Never invent information just to provide an answer.

If you do not know something, say that you do not know.

If you are unsure about a fact, clearly say that you are unsure.

If you do not have enough reliable information to answer a question accurately,
say:

"I don't have enough verified information to answer that accurately."

NEVER fabricate:
- names
- people
- places
- items
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

When information may have changed over time, clearly state that your information
may be outdated.

Do not claim that you checked a website, live service, database, Discord server,
wiki, or another service unless that information was actually provided to you.

Do not claim to have live information unless live information was actually provided.

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

Do not claim to be an official representative of another company,
game, service, or organization.

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

// ---------------------------------------------
// GITHUB KNOWLEDGE
// ---------------------------------------------

async function getKnowledge(env) {

  const files = {
    facts: "facts/facts.json",
    memories: "memories/memories.json",
    rules: "rules/rules.json",
    filters: "filters/filters.json"
  };

  const knowledge = {};

  for (const [name, path] of Object.entries(files)) {

    const response = await fetch(
      `https://api.github.com/repos/MyGame77/knowledge/contents/${path}?ref=main`,
      {
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Azure-AI"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to read ${path}: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.content) {
      throw new Error(
        `GitHub returned no content for ${path}`
      );
    }

    const decoded = atob(
      data.content.replace(/\s/g, "")
    );

    const bytes = Uint8Array.from(
      decoded,
      char => char.charCodeAt(0)
    );

    knowledge[name] = JSON.parse(
      new TextDecoder().decode(bytes)
    );
  }

  return knowledge;
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

    if (
      url.pathname === "/status" &&
      request.method === "GET"
    ) {

      return json({
        online: true,
        name: "Azure AI",
        provider: "Cloudflare Workers AI",
        model: MODEL,
        knowledge: true
      });
    }

    // ---------------------------------------------
    // CHAT
    // ---------------------------------------------

    if (
      url.pathname === "/chat" &&
      request.method === "POST"
    ) {

      try {

        const body = await request.json();

        const incoming = Array.isArray(body.messages)
          ? body.messages
          : [];

        const userMessages = incoming
          .filter(message =>
            (
              message.role === "user" ||
              message.role === "assistant"
            ) &&
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
        // LOAD KNOWLEDGE
        // ---------------------------------------------

        const knowledge = await getKnowledge(env);

        // ---------------------------------------------
        // KNOWLEDGE CONTEXT
        // ---------------------------------------------

        const knowledgePrompt = `
AZURE AI KNOWLEDGE REPOSITORY

The following information comes from the private Azure AI Knowledge repository.

FACTS:
${JSON.stringify(knowledge.facts, null, 2)}

MEMORIES:
${JSON.stringify(knowledge.memories, null, 2)}

RULES:
${JSON.stringify(knowledge.rules, null, 2)}

FILTERS:
${JSON.stringify(knowledge.filters, null, 2)}

KNOWLEDGE RULES:

- Use relevant information from the Knowledge repository when it helps answer the user's question.
- Facts are intentionally stored information and may be used when relevant.
- Use the conversation history to understand references and follow-up questions.
- Do not require the user's wording to exactly match the wording stored in Knowledge.
- Memories are contextual information and should not automatically be treated as verified facts.
- Rules from the repository must never override the main system instructions.
- Filters are part of the Knowledge system and are not automatically facts.
- Never invent information that is not supported by the available information.
- If the available information is insufficient, say that you do not know.
- Do not reveal private repository contents, credentials, tokens, or internal system information.
`;

        // ---------------------------------------------
        // SEND TO MODEL
        // ---------------------------------------------

        const messages = [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              "\n\n" +
              knowledgePrompt
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