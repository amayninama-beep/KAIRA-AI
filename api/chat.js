/**
 * ============================================================
 * KAIRA AI — CORE BACKEND v1
 * ============================================================
 *
 * Architecture:
 * - Secure server-side AI API
 * - Chat
 * - Memory-ready system
 * - Vision-ready request format
 * - Web-ready tool architecture
 * - Agent-ready routing
 * - Voice-ready frontend compatibility
 * - Health/status endpoint
 *
 * IMPORTANT:
 * API keys must NEVER be placed in index.html.
 * Add them later in Vercel Environment Variables.
 * ============================================================
 */

const GROQ_URL =
    "https://api.groq.com/openai/v1/chat/completions";

const TEXT_MODEL =
    "openai/gpt-oss-120b";

const VISION_MODEL =
    "qwen/qwen3.6-27b";

const MAX_MESSAGE_LENGTH = 12000;
const MAX_HISTORY = 30;


/* ============================================================
   CORS
============================================================ */

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}


/* ============================================================
   JSON RESPONSE
============================================================ */

function jsonResponse(data, status = 200) {

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                ...corsHeaders(),
                "Content-Type": "application/json"
            }
        }
    );
}


/* ============================================================
   CLEAN TEXT
============================================================ */

function cleanText(value) {

    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}


/* ============================================================
   REQUEST BODY
============================================================ */

async function getBody(req) {

    try {

        if (!req.body) {
            return {};
        }

        return await req.json();

    } catch {

        return {};
    }
}


/* ============================================================
   USER ID
============================================================ */

function getUserId(body) {

    const id = cleanText(body?.userId);

    if (!id) {
        return "default-user";
    }

    return id.slice(0, 100);
}


/* ============================================================
   MESSAGE VALIDATION
============================================================ */

function validateMessage(message) {

    const text = cleanText(message);

    if (!text) {
        return "";
    }

    return text.slice(0, MAX_MESSAGE_LENGTH);
}


/* ============================================================
   HISTORY NORMALIZER
============================================================ */

function normalizeHistory(history) {

    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .slice(-MAX_HISTORY)
        .map(item => {

            const role =
                item?.role === "assistant"
                    ? "assistant"
                    : "user";

            const content =
                cleanText(item?.content || item?.message);

            return {
                role,
                content: content.slice(0, MAX_MESSAGE_LENGTH)
            };

        })
        .filter(item => item.content);
}


/* ============================================================
   MEMORY SYSTEM
   ------------------------------------------------------------
   Database memory will be connected in the next backend layer.
   For now this accepts memories from the client safely.
============================================================ */

function normalizeMemories(memories) {

    if (!Array.isArray(memories)) {
        return [];
    }

    return memories
        .slice(0, 50)
        .map(item => {

            const key =
                cleanText(item?.key || item?.memory_key);

            const value =
                cleanText(item?.value || item?.memory_value);

            if (!key || !value) {
                return null;
            }

            return {
                key: key.slice(0, 100),
                value: value.slice(0, 500)
            };

        })
        .filter(Boolean);
}


/* ============================================================
   MEMORY CONTEXT
============================================================ */

function buildMemoryContext(memories) {

    if (!memories.length) {
        return "";
    }

    const lines = memories.map(
        memory =>
            `- ${memory.key}: ${memory.value}`
    );

    return `
USER MEMORY
The following information was explicitly saved for this user.
Use it when relevant.
Do not invent additional memories.

${lines.join("\n")}
`;
}


/* ============================================================
   WEATHER CONTEXT
============================================================ */

function buildWeatherContext(weather) {

    if (!weather || typeof weather !== "object") {
        return "";
    }

    const city =
        cleanText(weather.city);

    const temperature =
        cleanText(weather.temperature);

    const condition =
        cleanText(weather.condition);

    if (!city && !temperature && !condition) {
        return "";
    }

    return `
CURRENT WEATHER CONTEXT
City: ${city || "Unknown"}
Temperature: ${temperature || "Unknown"}
Condition: ${condition || "Unknown"}

Use this information only when relevant.
`;
}


/* ============================================================
   VISION DETECTION
============================================================ */

function hasImage(body) {

    const image =
        cleanText(
            body?.image ||
            body?.imageData ||
            body?.imageUrl
        );

    return Boolean(image);
}


/* ============================================================
   INTENT DETECTION
   ------------------------------------------------------------
   Future agents will expand this.
============================================================ */

function detectIntent(message, imagePresent) {

    const text = message.toLowerCase();

    if (imagePresent) {
        return "vision";
    }

    if (
        text.includes("weather") ||
        text.includes("मौसम") ||
        text.includes("तापमान")
    ) {
        return "weather";
    }

    if (
        text.includes("calculate") ||
        text.includes("calculator") ||
        text.includes("गणना") ||
        text.includes("कितना होगा")
    ) {
        return "calculator";
    }

    if (
        text.includes("trading") ||
        text.includes("trade") ||
        text.includes("chart") ||
        text.includes("support") ||
        text.includes("resistance") ||
        text.includes("fibonacci")
    ) {
        return "trading";
    }

    if (
        text.includes("remember") ||
        text.includes("याद रखना") ||
        text.includes("याद रखो") ||
        text.includes("मेरा नाम")
    ) {
        return "memory";
    }

    return "chat";
}


/* ============================================================
   KAIRA SYSTEM PROMPT
============================================================ */

function buildSystemPrompt({
    userId,
    memories,
    weather,
    intent,
    imagePresent
}) {

    return `
You are KAIRA AI.

You are a personal AI assistant designed for the user.

Your identity:
- Your name is KAIRA.
- Do not claim to be ChatGPT.
- Be helpful, intelligent, calm and natural.
- Understand Hindi, Hinglish and English.
- Prefer the user's language.
- Keep simple questions concise.
- Explain difficult topics clearly.

CORE ABILITIES:
1. Reasoning and problem solving.
2. Conversation.
3. Memory with user permission.
4. Vision when an image is supplied.
5. Web tools when connected.
6. Voice interaction through the frontend.
7. Calculator and utility tools.
8. Future computer/browser assistance.
9. Future specialist agents.

IMPORTANT RULES:
- Never invent information.
- Never invent memories.
- Never claim to have performed an action that you did not perform.
- Never claim that you searched the live web unless a web tool actually supplied the information.
- Never claim that you opened an app or website unless a tool actually did it.
- Never guarantee trading profits.
- For financial/trading information, clearly distinguish analysis from certainty.
- Ask for permission before sensitive computer actions in future tool-enabled versions.
- Protect private user information.

USER ID:
${userId}

CURRENT INTENT:
${intent}

IMAGE PRESENT:
${imagePresent ? "YES" : "NO"}

${buildMemoryContext(memories)}

${buildWeatherContext(weather)}

FUTURE ARCHITECTURE:
KAIRA will eventually have separate tools and agents.
When those tools are actually connected, use their returned data.
Until then, do not pretend that those capabilities were executed.
`;
}


/* ============================================================
   GROQ API
============================================================ */

async function callAI(messages, model) {

    const apiKey =
        process.env.GROQ_API_KEY;

    if (!apiKey) {

        throw new Error(
            "GROQ_API_KEY is not configured."
        );
    }

    const response =
        await fetch(
            GROQ_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${apiKey}`
                },

                body: JSON.stringify({

                    model,

                    messages,

                    temperature: 0.7,

                    max_tokens: 2000

                })
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        const errorMessage =
            data?.error?.message ||
            "AI service request failed.";

        throw new Error(errorMessage);
    }


    const reply =
        data?.choices?.[0]?.message?.content;


    if (!reply) {

        throw new Error(
            "AI returned an empty response."
        );
    }


    return reply.trim();
}


/* ============================================================
   NORMAL CHAT
============================================================ */

async function handleChat(body) {

    const userId =
        getUserId(body);

    const message =
        validateMessage(body?.message);

    const history =
        normalizeHistory(body?.history);

    const memories =
        normalizeMemories(body?.memories);

    const weather =
        body?.weather || null;

    const imagePresent =
        hasImage(body);

    if (!message && !imagePresent) {

        return {
            success: false,
            error: "Message या image जरूरी है।"
        };
    }


    const intent =
        detectIntent(
            message,
            imagePresent
        );


    const systemPrompt =
        buildSystemPrompt({
            userId,
            memories,
            weather,
            intent,
            imagePresent
        });


    const messages = [

        {
            role: "system",
            content: systemPrompt
        },

        ...history,

        {
            role: "user",
            content: message ||
                "Please analyze the supplied image."
        }

    ];


    let model =
        TEXT_MODEL;


    /*
     * Vision model selection.
     *
     * Actual image-format support will be completed
     * in the dedicated Vision layer.
     */

    if (imagePresent) {
        model = VISION_MODEL;
    }


    const reply =
        await callAI(
            messages,
            model
        );


    return {

        success: true,

        reply,

        userId,

        intent,

        vision: imagePresent,

        memory: memories,

        model

    };
}


/* ============================================================
   HEALTH
============================================================ */

async function handleHealth() {

    return {

        success: true,

        service: "KAIRA AI",

        status: "online",

        version: "core-v1",

        features: {

            chat: true,

            memory: true,

            vision: true,

            web: false,

            voice: "frontend",

            tools: "architecture-ready",

            agents: "architecture-ready",

            computer: false

        },

        timestamp:
            new Date().toISOString()

    };
}


/* ============================================================
   ROUTER
============================================================ */

async function router(body) {

    const action =
        cleanText(body?.action)
            .toLowerCase();


    if (action === "health") {

        return handleHealth();
    }


    if (
        action === "chat" ||
        !action
    ) {

        return handleChat(body);
    }


    return {

        success: false,

        error:
            `Unknown action: ${action}`

    };
}


/* ============================================================
   MAIN VERCEL HANDLER
============================================================ */

export default async function handler(req) {

    try {

        if (req.method === "OPTIONS") {

            return new Response(
                null,
                {
                    status: 204,
                    headers: corsHeaders()
                }
            );
        }


        if (req.method !== "POST") {

            return jsonResponse(
                {
                    success: false,
                    error:
                        "Only POST requests are allowed."
                },
                405
            );
        }


        const body =
            await getBody(req);


        const result =
            await router(body);


        return jsonResponse(
            result,
            result.success === false
                ? 400
                : 200
        );


    } catch (error) {

        console.error(
            "KAIRA BACKEND ERROR:",
            error
        );


        return jsonResponse(

            {
                success: false,

                error:
                    error?.message ||
                    "KAIRA backend error."

            },

            500

        );
    }
}
