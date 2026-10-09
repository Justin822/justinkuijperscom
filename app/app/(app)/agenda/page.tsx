import { redirect } from "next/navigation";

// De agenda heet nu Week (en de dag zit in Vandaag).
export default function AgendaRedirect() {
  redirect("/app/week");
}
