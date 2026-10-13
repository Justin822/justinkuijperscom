import { NextResponse } from "next/server";
import { getNotes, saveNote } from "@/lib/taken/store";
import { fail, noStore } from "@/lib/taken/server";
import { newNote } from "@/lib/taken/validate";
import { makeDelta, sinceParam } from "@/lib/taken/delta";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    // Met ?since= alleen notities die sindsdien veranderden (plus alle id's voor verwijderingen).
    const delta = makeDelta(await getNotes(), sinceParam(request));
    return NextResponse.json({ notes: delta.items, ids: delta.ids, now: delta.now }, { headers: noStore });
  } catch (error) {
    return fail("notes GET", error, "Kon je notities niet ophalen.");
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const note = newNote(await request.json().catch(() => ({})));
    await saveNote(note);
    return NextResponse.json({ note });
  } catch (error) {
    return fail("notes POST", error, "Kon de notitie niet opslaan.");
  }
}
