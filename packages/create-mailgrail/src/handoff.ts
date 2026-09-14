import qrcode from "qrcode-terminal";

//------------------------------------------------------------------------------
// Where the installer hands the user off to finish setting up.
//
// This is deliberately the short /setup alias rather than the docs URL it
// forwards to. Every published copy of this package hard-codes whatever it
// prints here, forever -- those URLs live on in people's scrollback -- so the
// docs page behind the alias has to stay free to move. website/astro.config.mjs
// owns the redirect, and website/scripts/check-handoff.mjs fails the site build
// if this constant and that redirect ever disagree.
//------------------------------------------------------------------------------
export const HANDOFF_URL = "https://luxanimi.github.io/MailGrail/setup";

// The QR for HANDOFF_URL measures 31 columns, and the gutter adds three more.
// A code that wraps is not a code at all, so leave headroom rather than sitting
// on the exact width, and print nothing when it will not fit.
const MIN_QR_COLUMNS = 45;

const ESC = String.fromCharCode(27);
const BACKSLASH = String.fromCharCode(92);

//------------------------------------------------------------------------------
function supportsAnsi(): boolean {
  return Boolean(process.stdout.isTTY) && process.env["TERM"] !== "dumb";
}

//------------------------------------------------------------------------------
// OSC 8 makes the URL clickable where it is understood. Terminals that do not
// understand it ignore the escape and show the same text, and a non-TTY (a pipe,
// a CI log) gets the bare URL -- so the link text is identical either way.
function hyperlink(url: string): string {
  if (!supportsAnsi()) return url;
  const open = `${ESC}]8;;${url}${ESC}${BACKSLASH}`;
  const close = `${ESC}]8;;${ESC}${BACKSLASH}`;
  return `${open}${url}${close}`;
}

//------------------------------------------------------------------------------
function renderQr(url: string): string | null {
  if (!supportsAnsi()) return null;
  if ((process.stdout.columns ?? 0) < MIN_QR_COLUMNS) return null;

  let out: string | null = null;
  // `small` uses half-block glyphs to halve the row count. It does not change
  // the column count, which is what MIN_QR_COLUMNS is guarding.
  qrcode.generate(url, { small: true }, (code: string) => {
    out = code;
  });

  return out;
}

//------------------------------------------------------------------------------
// Printed after the "Next steps" note and before the outro.
//
// The wizard deliberately stops here rather than wiring the build itself: both
// answers are legitimate, the choice depends on things the scaffolder cannot see
// (is this Dockerized? does a `build` script even exist? does the repo already
// commit generated artifacts?), and the wrong one is expensive to unpick from a
// repository's history later. So surface the decision and hand off.
//------------------------------------------------------------------------------
export function printHandoff(log: (line: string) => void = console.log): void {
  // Keep clack's left gutter going, so this reads as part of the same flow
  // rather than as stray output after it.
  const gutter = supportsAnsi()
    ? `${ESC}[90m│${ESC}[0m  `
    : "   ";

  log(gutter);
  log(`${gutter}One decision left: commit the compiled output, or generate it`);
  log(`${gutter}in CI? Both work — they differ in how review and deploy behave.`);
  log(gutter);
  log(`${gutter}${hyperlink(HANDOFF_URL)}`);
  log(gutter);

  const qr = renderQr(HANDOFF_URL);
  if (qr) {
    for (const line of qr.split("\n")) {
      if (line.trim() !== "") log(`${gutter}${line}`);
    }
  }
}
