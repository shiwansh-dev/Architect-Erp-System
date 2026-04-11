import { NextResponse } from "next/server";

const translationCache = new Map<string, string>();
const TRANSLATION_TIMEOUT_MS = 5000;
const MAX_TEXTS_PER_REQUEST = 40;

const normalizeText = (value: unknown) => String(value || "").trim();
const hasLatinLetters = (value: string) => /[A-Za-z]/.test(value);

const fetchWithTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseGoogleTranslatePayload = (payload: unknown) => {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return "";
  }

  return payload[0]
    .map((entry: unknown) => (Array.isArray(entry) ? String(entry[0] || "") : ""))
    .join("")
    .trim();
};

const translateText = async (text: string, target: string) => {
  const cacheKey = `${target}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetchWithTimeout(url.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (response.ok) {
      const payload = await response.json().catch(() => null);
      const translated = parseGoogleTranslatePayload(payload);
      if (translated && translated !== text) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // Fall through to transliteration.
  }

  if (!hasLatinLetters(text)) {
    return text;
  }

  try {
    const response = await fetchWithTimeout("https://inputtools.google.com/request?itc=hi-t-i0-und&num=1", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({ text }),
    });

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | [string, Array<[string, string[]]>]
        | null;
      const transliterated = String(payload?.[1]?.[0]?.[1]?.[0] || "").trim();
      if (transliterated && transliterated !== text) {
        translationCache.set(cacheKey, transliterated);
        return transliterated;
      }
    }
  } catch {
    // Fall back to source text.
  }

  return text;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    target?: unknown;
    texts?: unknown;
  } | null;
  const target = normalizeText(body?.target) || "hi";
  const inputTexts = Array.isArray(body?.texts) ? (body.texts as unknown[]) : [];
  const texts: string[] = inputTexts.length
    ? Array.from(new Set(inputTexts.map(normalizeText).filter(Boolean))).slice(0, MAX_TEXTS_PER_REQUEST)
    : [];

  if (texts.length === 0) {
    return NextResponse.json({ translations: {} });
  }

  const translatedEntries = await Promise.all(
    texts.map(async (text) => [text, await translateText(text, target)] as const)
  );

  return NextResponse.json({
    translations: Object.fromEntries(translatedEntries),
  });
}
