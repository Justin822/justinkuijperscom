import { NextResponse } from "next/server";
import { deleteNote, mutateNote } from "@/lib/taken/store";
import { fail } from "@/lib/taken/server";
import { bodyHash } from "@/lib/taken/notes";
import { cleanNote } from "@/lib/taken/validate";
import { requireAccess } from "@/lib/taken/session";
import type { Note } from "@/lib/taken/types";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

/**
 * Notitie bijwerken. Stuurt de browser bij een nieuwe tekst `base` mee (vingerafdruk van de tekst waarop hij
 * verder typte) en is de tekst intussen elders gewijzigd, dan volgt 409 met de nieuwe versie: geen stille
 * overschrijving. Vastpinnen of een gebied kiezen telt niet als wijziging van de tekst.
 */
export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const patch = cleanNote(body);
    const base = typeof body?.base === "string" ? body.base : null;
    let conflict: Note | null = null;
    const result = await mutateNote(params.id, (current) => {
      conflict = null;
      if (!current) return null;
      if (patch.body !== undefined && base !== null && bodyHash(current.body) !== base && current.body !== patch.body) {
        conflict = current;
        return null;
      }
      return { ...current, ...patch, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    });
    if (conflict) {
      return NextResponse.json({ error: "Deze notitie is intussen op een ander apparaat gewijzigd.", note: conflict }, { status: 409 });
    }
    if (!result.value) return NextResponse.json({ error: "Deze notitie bestaat niet meer." }, { status: 404 });
    return NextResponse.json({ note: result.value });
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
