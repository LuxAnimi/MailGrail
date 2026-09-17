//------------------------------------------------------------------------------
// Catches a template still written against the pre-0.2.0 subject/text API.
//
// Those two used to receive the params object, so `params.username` read a
// value. They now receive a render context, which has no such property --
// and in plain JavaScript, or behind an `as any`, reading it yields undefined
// and ships the word "undefined" in a real email. TypeScript already rejects
// it; this gives everyone else the same answer, at build time.
//------------------------------------------------------------------------------
export type GuardedPart = "subjectTemplate" | "textTemplate" | "htmlTemplate";

//------------------------------------------------------------------------------
export type GuardWhere = {
  template: string;
  part: GuardedPart;
};

//------------------------------------------------------------------------------
// Keys the runtime itself probes on an unknown object. Throwing for these would
// break `await`, JSON.stringify and console.log rather than the template.
//------------------------------------------------------------------------------
const PASSTHROUGH = new Set(["then", "toJSON", "constructor", "inspect"]);

//------------------------------------------------------------------------------
export function guardContext<C extends object>(ctx: C, where: GuardWhere): C {
  return new Proxy(ctx, {
    get(target, key, receiver) {
      if (typeof key === "symbol" || key in target || PASSTHROUGH.has(key)) {
        return Reflect.get(target, key, receiver);
      }

      throw new Error(
        `${where.template}: ${where.part} read mg.${key}, which the render ` +
          `context does not have.\n` +
          `It receives a context, not the parameters, so read values through ` +
          `it:\n\n` +
          `  mg.render(${JSON.stringify(key)})\n`,
      );
    },
  });
}
