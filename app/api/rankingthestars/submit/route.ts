import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { PLAYERS, QUESTIONS, STORY_MAX, STORY_MIN } from "@/lib/rankingthestars/config";
import { isValidTop } from "@/lib/rankingthestars/results";
import { getState, getSubmission, saveSubmission } from "@/lib/rankingthestars/store";

export const dynamic = "force-dynamic";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { playerId, token, rankings, stories } = body || {};
  const ids = PLAYERS.map((p) => p.id);

  if (typeof playerId !== "string" || !ids.includes(playerId)) {
    return NextResponse.json({ error: "Onbekende speler." }, { status: 400 });
  }
  if (typeof token !== "string" || token.length < 16) {
    return NextResponse.json({ error: "Ongeldige sessie, herlaad de pagina." }, { status: 400 });
  }

  const cleanRankings: Record<string, string[]> = {};
  const cleanStories: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const order = rankings?.[q.id];
    if (!isValidTop(order, ids)) {
      return NextResponse.json({ error: "Niet bij alle vragen is een top 3 gekozen." }, { status: 400 });
    }
    cleanRankings[q.id] = order;
    const story = typeof stories?.[q.id] === "string" ? stories[q.id].trim() : "";
    if (story.length < STORY_MIN) {
      return NextResponse.json({ error: "Vul bij elke vraag het verhaal in." }, { status: 400 });
    }
    cleanStories[q.id] = story.slice(0, STORY_MAX);
  }

  try {
    const state = await getState();
    if (!state.votingOpen) {
      return NextResponse.json({ error: "De stembus is gesloten." }, { status: 403 });
    }

    const tokenHash = sha256(token);
    const existing = await getSubmission(playerId);
    if (existing && existing.tokenHash !== tokenHash) {
      return NextResponse.json(
        {
          error:
            "Voor deze naam is al gestemd vanaf een ander apparaat. Vraag de spelleider om je stem te resetten.",
        },
        { status: 403 }
      );
    }

    await saveSubmission({
      playerId,
      rankings: cleanRankings,
      stories: cleanStories,
      tokenHash,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Opslaan mislukt, probeer het nog eens." }, { status: 500 });
  }
}
