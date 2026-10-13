// Importbestand voor de Android-app HTTP Shortcuts (https://http-shortcuts.rmy.ch).
// Formaat volgens de import/export-code van die app (ImportExportBase, versie 92):
// één categorie "Planner" met twee snelkoppelingen en een tekstvariabele die ook het deelmenu vult.

export const HTTP_SHORTCUTS_VERSION = 92;
export const HTTP_SHORTCUTS_COMPATIBILITY = 90;

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export function httpShortcutsExport(origin: string, token: string) {
  const textVariable = uuid();
  const base = origin.replace(/\/+$/, "");
  const auth = { authentication: "bearer", authToken: token };
  return {
    version: HTTP_SHORTCUTS_VERSION,
    compatibilityVersion: HTTP_SHORTCUTS_COMPATIBILITY,
    categories: [
      {
        id: uuid(),
        name: "Planner",
        shortcuts: [
          {
            id: uuid(),
            executionType: "app",
            name: "Zet in Planner",
            description: "Taak of notitie naar je Inbox",
            method: "POST",
            url: `${base}/api/taken/capture?format=text`,
            ...auth,
            requestBodyType: "custom_text",
            contentType: "text/plain",
            bodyContent: `{{${textVariable}}}`,
            timeout: 15000,
            launcherShortcut: true,
            quickSettingsTileShortcut: true,
            responseHandling: { uiType: "toast", successOutput: "response", failureOutput: "simple" },
          },
          {
            id: uuid(),
            executionType: "app",
            name: "Mijn top 3",
            description: "Je top 3 van vandaag",
            method: "GET",
            url: `${base}/api/taken/capture/today?format=text`,
            ...auth,
            requestBodyType: "custom_text",
            timeout: 15000,
            launcherShortcut: true,
            responseHandling: { uiType: "dialog", successOutput: "response", failureOutput: "simple" },
          },
        ],
      },
    ],
    variables: [
      {
        id: textVariable,
        key: "planner_tekst",
        type: "text",
        title: "Zet in Planner",
        message: "Bijv. Offerte Jansen vrijdag, Appèl, half uur",
        isShareText: true,
        isMultiline: true,
      },
    ],
  };
}
