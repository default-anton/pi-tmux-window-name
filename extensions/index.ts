import { completeSimple, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@mariozechner/pi-coding-agent";

const WINDOW_WORD_MIN = 3;
const WINDOW_WORD_MAX = 4;
const SESSION_WORD_MIN = 8;
const SESSION_WORD_MAX = 12;
const SESSION_CHAR_MAX = 96;
const WINDOW_NAME_ENTRY_TYPE = "pi-tmux-window-name/window";

const WINDOW_AND_SESSION_PROMPT = `You generate names for coding sessions.

Return exactly two lines:
WINDOW: <3-4 words>
SESSION: <8-12 words>

Rules:
- Keep both names specific to the user's task.
- Use plain letters and numbers only.
- Use spaces between words. No punctuation.
- No quotes, markdown, emojis, labels beyond WINDOW:/SESSION:, or explanations.
- The session name should be descriptive enough for quickly scanning a session list.

Examples:
WINDOW: Fix OAuth Callback Logic
SESSION: Implement OAuth Callback Validation And Retry Flow In Auth Service`;

type GeneratedNames = {
  windowName: string;
  sessionName: string;
};

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

function compactWindowName(value: string, minWords = WINDOW_WORD_MIN): string | undefined {
  const words = normalizeWords(value).slice(0, WINDOW_WORD_MAX).map(toTitle);
  if (words.length < minWords) return undefined;

  const name = words.join(" ").trim();
  return name || undefined;
}

function compactSessionName(value: string, minWords = SESSION_WORD_MIN): string | undefined {
  const words = normalizeWords(value).slice(0, SESSION_WORD_MAX).map(toTitle);
  if (words.length < minWords) return undefined;

  while (words.length > minWords && words.join(" ").length > SESSION_CHAR_MAX) {
    words.pop();
  }

  const name = words.join(" ").trim();
  if (!name) return undefined;
  if (name.length <= SESSION_CHAR_MAX) return name;
  return name.slice(0, SESSION_CHAR_MAX).trim() || undefined;
}

function cleanGeneratedValue(value: string): string {
  return value.replace(/^[\s"'`]+|[\s"'`]+$/g, "").trim();
}

function parseGeneratedNames(value: string): { window?: string; session?: string } {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let windowName: string | undefined;
  let sessionName: string | undefined;

  for (const line of lines) {
    if (!windowName && /^window\s*:/i.test(line)) {
      windowName = cleanGeneratedValue(line.replace(/^window\s*:/i, ""));
      continue;
    }

    if (!sessionName && /^session\s*:/i.test(line)) {
      sessionName = cleanGeneratedValue(line.replace(/^session\s*:/i, ""));
    }
  }

  return { window: windowName, session: sessionName };
}

function getStoredWindowName(entries: SessionEntry[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== "custom") continue;
    if (entry.customType !== WINDOW_NAME_ENTRY_TYPE) continue;
    if (!entry.data || typeof entry.data !== "object") continue;

    const candidate = (entry.data as Record<string, unknown>).windowName;
    if (typeof candidate !== "string") continue;

    const normalized = compactWindowName(candidate, 1);
    if (normalized) return normalized;
  }

  return undefined;
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

async function generateNames(prompt: string, ctx: ExtensionContext): Promise<GeneratedNames | undefined> {
  const seed = prompt.trim();
  if (!seed || !ctx.model) {
    return undefined;
  }

  const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
  if (!apiKey) {
    return undefined;
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
      systemPrompt: WINDOW_AND_SESSION_PROMPT,
      messages: [message],
    },
    {
      apiKey,
      reasoning: "low",
      maxTokens: 96,
      signal: controller.signal,
    },
  ).finally(() => {
    clearTimeout(timeoutId);
  });

  const generated = response.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");

  const parsed = parseGeneratedNames(generated);
  const windowName = compactWindowName(parsed.window ?? "");
  const sessionName = compactSessionName(parsed.session ?? "");

  if (!windowName || !sessionName) {
    return undefined;
  }

  return { windowName, sessionName };
}

export default function tmuxWindowNameExtension(pi: ExtensionAPI) {
  let hasNameForSession = false;
  let hasAttemptedNameForSession = false;
  let renameInFlight: Promise<void> | null = null;
  let sessionEpoch = 0;

  const resetSessionState = () => {
    sessionEpoch += 1;
    hasNameForSession = false;
    hasAttemptedNameForSession = false;
    renameInFlight = null;
  };

  const applyName = async (seedPrompt: string | undefined, ctx: ExtensionContext): Promise<void> => {
    if (hasNameForSession || hasAttemptedNameForSession || renameInFlight) return;

    const existing = pi.getSessionName();
    if (existing) {
      const restoredWindow = getStoredWindowName(ctx.sessionManager.getBranch()) ?? compactWindowName(existing, 1) ?? existing;
      await renameCurrentTmuxWindow(pi, restoredWindow);
      hasNameForSession = true;
      return;
    }

    const prompt = seedPrompt?.trim();
    if (!prompt) return;

    hasAttemptedNameForSession = true;
    const currentEpoch = sessionEpoch;
    const work = (async () => {
      let names: GeneratedNames | undefined;
      try {
        names = await generateNames(prompt, ctx);
      } catch {
        return;
      }

      if (currentEpoch !== sessionEpoch || !names) return;

      pi.setSessionName(names.sessionName);
      pi.appendEntry(WINDOW_NAME_ENTRY_TYPE, { windowName: names.windowName });
      await renameCurrentTmuxWindow(pi, names.windowName);
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

  const restoreExistingSessionName = async (ctx: ExtensionContext) => {
    const existing = pi.getSessionName();
    if (!existing) return;

    const storedWindow = getStoredWindowName(ctx.sessionManager.getBranch());
    const windowName = storedWindow ?? compactWindowName(existing, 1) ?? existing;
    await renameCurrentTmuxWindow(pi, windowName);
    hasNameForSession = true;
  };

  pi.on("session_start", async (_event, ctx) => {
    resetSessionState();
    await restoreExistingSessionName(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    resetSessionState();
    await restoreExistingSessionName(ctx);
  });

  pi.on("before_agent_start", (event, ctx) => {
    const firstPrompt = getFirstUserPrompt(ctx.sessionManager.getBranch()) ?? event.prompt;
    void applyName(firstPrompt, ctx);
  });
}
