// app/api/tts/route.ts
import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

// Создаём клиент один раз (лениво)
let ttsClient: textToSpeech.TextToSpeechClient | null = null;

function getTtsClient() {
  if (ttsClient) return ttsClient;

  const projectId = process.env.GOOGLE_TTS_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_TTS_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_TTS_PRIVATE_KEY || "";

  // ВАЖНО: разворачиваем \n в настоящие переносы строки
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("[/api/tts] Missing GOOGLE_TTS_* env vars", {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    });

    // Отдаём 500 с понятным текстом, чтобы ты видел в Network → Response
    throw new Error(
      "GOOGLE_TTS_PROJECT_ID / GOOGLE_TTS_CLIENT_EMAIL / GOOGLE_TTS_PRIVATE_KEY are not fully configured",
    );
  }

  ttsClient = new textToSpeech.TextToSpeechClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  return ttsClient;
}

type Gender = "female" | "male";

function mapGender(gender: Gender | string | undefined) {
  return gender === "male" ? "MALE" : "FEMALE";
}

function pickVoiceName(languageCode: string, gender: Gender) {
  // Твои голоса от старых разработчиков
  if (languageCode.startsWith("uk")) {
    return gender === "female" ? "uk-UA-Chirp3-HD-Schedar" : "uk-UA-Standard-A";
  }
  // Можно расширить для ru/en и т.п. при необходимости
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const text = (body.text || body.message || body.content || "").toString().trim();
    const languageCode =
      (body.languageCode as string) ||
      (body.langCode as string) ||
      "uk-UA";
    const gender = (body.gender as Gender) || "female";

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 },
      );
    }

    const client = getTtsClient();

    const voiceName = pickVoiceName(languageCode, gender);
    const ssmlGender = mapGender(gender);

    console.log("[/api/tts] Synthesizing speech", {
      languageCode,
      gender,
      ssmlGender,
      voiceName,
      textSample: text.slice(0, 80),
    });

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode,
        ssmlGender,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
      },
    });

    const audioContent = response.audioContent;

    if (!audioContent || !audioContent.length) {
      console.error("[/api/tts] No audioContent in Google response", response);
      return NextResponse.json(
        { error: "Google TTS returned empty audioContent" },
        { status: 500 },
      );
    }

    const base64 = Buffer.from(audioContent).toString("base64");
    console.log("[/api/tts] Synthesized OK, bytes:", audioContent.length);

    return NextResponse.json(
      { audioContent: base64 },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("[/api/tts] ERROR:", err?.message, err);

    return NextResponse.json(
      {
        error: "Google TTS error",
        details: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}
