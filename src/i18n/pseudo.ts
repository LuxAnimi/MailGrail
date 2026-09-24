//------------------------------------------------------------------------------
// Pseudo-localization, for the preview only.
//
// Every translated literal is rewritten as accented, lengthened text. What is
// left in plain ASCII was never passed through mg.t -- a hardcoded string --
// and the extra length shows where a layout breaks once German or Finnish
// text, often a third longer than English, is dropped into it.
//------------------------------------------------------------------------------
const ACCENTED: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í",
  j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ó", p: "þ", q: "ǫ", r: "ŕ",
  s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í",
  J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ó", P: "Þ", Q: "Ǫ", R: "Ŕ",
  S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** The tag the preview offers the pseudo-locale under. */
export const PSEUDO_LOCALE = "en-XA";

//------------------------------------------------------------------------------
export function pseudoLocalize(text: string): string {
  if (text.trim() === "") return text;

  const accented = text.replace(/[A-Za-z]/g, (ch) => ACCENTED[ch] ?? ch);

  // Lengthen by about a third, inside the text's own surrounding whitespace so
  // the spacing between it and a neighbouring value is kept.
  const [, lead, body, trail] = accented.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  const letters = body!.replace(/\s/g, "").length;
  const padding = "·".repeat(Math.ceil(letters / 3));

  return `${lead}⟦${body}${padding}⟧${trail}`;
}
