/** Tekst om in te zoeken: kleine letters, zonder accenten ("Appèl" vindt "appel"). */
export const searchable = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
