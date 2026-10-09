import { NextResponse } from "next/server";
import { deleteNote, getNote, saveNote } from "@/lib/taken/store";
import { fail } from "@/lib/taken/server";
import { cleanNote } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const note = await getNote(params.id);
    if (!note) return NextResponse.json({ error: "Deze notitie bestaat niet meer." }, { status: 404 });
    const next = { ...note, ...cleanNote(await request.json().catch(() => ({}))), updatedAt: Date.now() };
    await saveNote(next);
    return NextResponse.json({ note: next });
  } catch (error) {
    return fail("note PATCH", error, "Kon de notitie niet opslaan.");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    await deleteNote(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail("note DELETE", error, "Kon de notitie niet verwijderen.");
  }
}
