// Generowanie zdjęć przez Gemini API (REST, bez SDK): zdjęcie referencyjne + opis sceny -> nowe zdjęcie.

export type AspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3";

export interface GeminiImageRequest {
  apiKey: string;
  model: string;
  prompt: string;
  references: { data: Buffer; mimeType: string }[];
  aspectRatio: AspectRatio;
  signal?: AbortSignal;
}

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export async function generateGeminiImage(req: GeminiImageRequest): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
  const body = {
    contents: [
      {
        parts: [
          ...req.references.map((r) => ({ inline_data: { mime_type: r.mimeType, data: r.data.toString("base64") } })),
          { text: req.prompt },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: req.aspectRatio },
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": req.apiKey },
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (err) {
    throw new ImageGenerationError(`Brak połączenia z Gemini: ${(err as Error).message}`, true);
  }

  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new ImageGenerationError(`Gemini HTTP ${res.status}: ${json.error?.message ?? "nieznany błąd"}`, retryable);
  }
  if (json.promptFeedback?.blockReason) {
    throw new ImageGenerationError(`Gemini zablokował prośbę (${json.promptFeedback.blockReason})`, false);
  }

  const candidate = json.candidates?.[0];
  // Modele z "myśleniem" zwracają też szkice (thought: true) – bierzemy ostatni finalny obraz.
  const image = candidate?.content?.parts?.filter((p) => p.inlineData && !p.thought).at(-1)?.inlineData;
  if (!image) {
    const reason = candidate?.finishReason ?? "brak obrazu w odpowiedzi";
    throw new ImageGenerationError(`Gemini nie zwrócił zdjęcia (${reason})`, reason !== "IMAGE_SAFETY" && reason !== "SAFETY");
  }
  return Buffer.from(image.data, "base64");
}
