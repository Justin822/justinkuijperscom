import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { PLAYERS, QUESTIONS } from "@/lib/rankingthestars/config";
import { teamCode } from "@/lib/rankingthestars/access";
import { computeResults, makeDemoBallots } from "@/lib/rankingthestars/results";
import {
  deleteSubmission,
  getState,
  getSubmissions,
  setState,
  storageKind,
} from "@/lib/rankingthestars/store";

export const dynamic = "force-dynamic";

const adminPin =
  process.env.RTS_ADMIN_PIN || (process.env.NODE_ENV !== "production" ? "1234" : "");

function pinMatches(pin: unknown) {
  if (!adminPin || typeof pin !== "string") return false;
  const a = createHash("sha256").update(pin).digest();
  const b = createHash("sha256").update(adminPin).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!adminPin) {
    return NextResponse.json(
      { error: "Er is nog geen pincode ingesteld (RTS_ADMIN_PIN)." },
      { status: 503 }
    );
  }
  if (!pinMatches(body?.pin)) {
    return NextResponse.json({ error: "Verkeerde pincode." }, { status: 401 });
  }

  try {
    switch (body.action) {
      case "overview": {
        const [state, subs] = await Promise.all([getState(), getSubmissions()]);
        return NextResponse.json({
          votingOpen: state.votingOpen,
          storage: storageKind,
          teamCode: teamCode(),
          persistent: storageKind === "redis" || !process.env.VERCEL,
          submissions: subs.map((s) => ({
            playerId: s.playerId,
            updatedAt: s.updatedAt,
            stories: Object.keys(s.stories).length,
          })),
        });
      }
      case "open":
      case "close": {
        await setState({ ...(await getState()), votingOpen: body.action === "open" });
        return NextResponse.json({ ok: true });
      }
      case "reset": {
        if (!PLAYERS.some((p) => p.id === body.playerId)) {
          return NextResponse.json({ error: "Onbekende speler." }, { status: 400 });
        }
        await deleteSubmission(body.playerId);
        return NextResponse.json({ ok: true });
      }
      case "results": {
        const ballots = body.demo ? makeDemoBallots(PLAYERS, QUESTIONS) : await getSubmissions();
        return NextResponse.json({ demo: !!body.demo, ...computeResults(PLAYERS, QUESTIONS, ballots) });
      }
      default:
        return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Er ging iets mis met de opslag." }, { status: 500 });
  }
}
