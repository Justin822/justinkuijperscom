import { NextResponse } from "next/server";
import { getNotes, saveNote } from "@/lib/taken/store";
import { fail, noStore } from "@/lib/taken/server";
import { newNote } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ notes: await getNotes() }, { headers: noStore });
  } catch (error) {
    return fail("notes GET", error, "Kon je notities niet ophalen.");
  }
}

export async function POST(request: Request) {
  try {
    const note = newNote(await request.json().catch(() => ({})));
    await saveNote(note);
    return NextResponse.json({ note });
  } catch (error) {
    return fail("notes POST", error, "Kon de notitie niet opslaan.");
  }
}
