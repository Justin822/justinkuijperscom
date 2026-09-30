import { NextResponse } from "next/server";
import { getState, getSubmissions } from "@/lib/rankingthestars/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [state, subs] = await Promise.all([getState(), getSubmissions()]);
    return NextResponse.json(
      { votingOpen: state.votingOpen, submitted: subs.map((s) => s.playerId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Kon de status niet ophalen." }, { status: 500 });
  }
}
