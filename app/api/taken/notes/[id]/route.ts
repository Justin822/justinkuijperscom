import { NextResponse } from "next/server";
import { deleteNote, getNote, saveNote } from "@/lib/taken/store";
import { fail } from "@/lib/taken/server";
import { cleanNote } from "@/lib/taken/validate";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
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

export async function DELETE(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    await deleteNote(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail("note DELETE", error, "Kon de notitie niet verwijderen.");
  }
}
