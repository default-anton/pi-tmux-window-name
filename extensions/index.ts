import { completeSimple, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@mariozechner/pi-coding-agent";

const WINDOW_NAME_PROMPT = `You generate tmux window names for coding sessions.

Rules:
- Return exactly 1 or 2 words.
- Keep it specific to the user's task.
- Use plain letters/numbers only.
- No punctuation, quotes, markdown, emojis, or explanations.
- Max 24 characters total.

Examples:
- "Fix flaky CI tests" -> "CI Flakes"
- "add oauth callback handling in auth service" -> "OAuth Callback"
- "investigate memory leak in websocket client" -> "WS Leak"`;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "for",
  "from",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "please",
  "the",
  "this",
  "to",
  "we",
  "with",
]);

function normalizeWords(value: string): string[] {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/["'`“”‘’]/g, " ")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function toTitle(word: string): string {
  if (word.length <= 1) return word.toUpperCase();
  const hasUppercase = /[A-Z]/.test(word.slice(1));
  if (hasUppercase) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function compactWindowName(value: string): string | undefined {
  const words = normalizeWords(value).slice(0, 2).map(toTitle);
  if (words.length === 0) return undefined;

  const name = words.join(" ").trim();
  if (!name) return undefined;
  return name.slice(0, 24).trim();
}

function fallbackWindowName(prompt: string): string {
  const words = normalizeWords(prompt);
  const preferred = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));

  const source = preferred.length > 0 ? preferred : words;
  const name = compactWindowName(source.slice(0, 2).join(" "));
  return name || "Pi Task";
}

function extractTextFromUserContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        !!part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part,
    )
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getFirstUserPrompt(entries: SessionEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    if (entry.message.role !== "user") continue;

    const text = extractTextFromUserContent(entry.message.content);
    if (text) return text;
  }

  return undefined;
}

async function renameCurrentTmuxWindow(pi: ExtensionAPI, name: string): Promise<boolean> {
  if (!process.env.TMUX) return false;

  try {
    const result = await pi.exec("tmux", ["rename-window", name]);
    return result.code === 0;
  } catch {
    return false;
  }
}

async function generateWindowName(prompt: string, ctx: ExtensionContext): Promise<string> {
  const fallback = fallbackWindowName(prompt);
  const seed = prompt.trim();
  if (!seed) return fallback;

  if (!ctx.model) {
    return fallback;
  }

  const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
  if (!apiKey) {
    return fallback;
  }

  const message: UserMessage = {
    role: "user",
    content: [{ type: "text", text: seed.slice(0, 4000) }],
    timestamp: Date.now(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const response = await completeSimple(
    ctx.model,
    {
      systemPrompt: WINDOW_NAME_PROMPT,
      messages: [message],
    },
    {
      apiKey,
      reasoning: "low",
      maxTokens: 40,
      signal: controller.signal,
    },
  ).finally(() => {
    clearTimeout(timeoutId);
  });

  const generated = response.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");

  return compactWindowName(generated) || fallback;
}

export default function tmuxWindowNameExtension(pi: ExtensionAPI) {
  let hasNameForSession = false;
  let renameInFlight: Promise<void> | null = null;
  let sessionEpoch = 0;

  const resetSessionState = () => {
    sessionEpoch += 1;
    hasNameForSession = false;
    renameInFlight = null;
  };

  const applyName = async (seedPrompt: string | undefined, ctx: ExtensionContext): Promise<void> => {
    if (hasNameForSession || renameInFlight) return;

    const existing = pi.getSessionName();
    if (existing) {
      await renameCurrentTmuxWindow(pi, existing);
      hasNameForSession = true;
      return;
    }

    const prompt = seedPrompt?.trim();
    if (!prompt) return;

    const currentEpoch = sessionEpoch;
    const work = (async () => {
      let name: string;
      try {
        name = await generateWindowName(prompt, ctx);
      } catch {
        name = fallbackWindowName(prompt);
      }

      if (currentEpoch !== sessionEpoch) return;

      pi.setSessionName(name);
      await renameCurrentTmuxWindow(pi, name);
      if (currentEpoch === sessionEpoch) {
        hasNameForSession = true;
      }
    })();

    const inFlight = work.finally(() => {
      if (renameInFlight === inFlight) {
        renameInFlight = null;
      }
    });

    renameInFlight = inFlight;
    await inFlight;
  };

  const restoreExistingSessionName = async () => {
    const existing = pi.getSessionName();
    if (!existing) return;
    await renameCurrentTmuxWindow(pi, existing);
    hasNameForSession = true;
  };

  pi.on("session_start", async () => {
    resetSessionState();
    await restoreExistingSessionName();
  });

  pi.on("session_switch", async () => {
    resetSessionState();
    await restoreExistingSessionName();
  });

  pi.on("before_agent_start", (event, ctx) => {
    const firstPrompt = getFirstUserPrompt(ctx.sessionManager.getBranch()) ?? event.prompt;
    void applyName(firstPrompt, ctx);
  });
}
