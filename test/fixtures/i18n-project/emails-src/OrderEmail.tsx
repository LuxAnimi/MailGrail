import {
  Mjml,
  MjmlBody,
  MjmlColumn,
  MjmlSection,
  MjmlText,
  MjmlButton,
} from "@faire/mjml-react";

import { t, defineMessages } from "../../../../lib/src/config/index.js";

//------------------------------------------------------------------------------
// A localized template exercising every kind of message node, built for real
// (esbuild + MJML) by test/i18n-build.test.js.
//------------------------------------------------------------------------------
const m = defineMessages("order", {
  subject: "Order {ref} confirmed",
  greeting: "Hi {name},",
  items: "{count, plural, one {You ordered # item.} other {You ordered # items.}}",
  line: "{title} × {qty}",
  total: "Total: {total, number, ::currency/EUR}",
  cta: "Track your order",
  help: "Questions? <link>Contact us</link>.",
});

const params = t.object({
  name: t.string(),
  ref: t.string(),
  count: t.number(),
  total: t.number(),
  url: t.string(),
  lines: t.array(t.object({ title: t.string(), qty: t.number() })),
});

export const OrderEmail = {
  name: "order",
  sender: "shop@example.com",
  params,

  subjectTemplate: (mg: any) => mg.t(m.subject, { ref: "ref" }),

  textTemplate: (mg: any) =>
    mg.t(m.greeting, { name: "name" }) +
    "\n" +
    mg.t(m.items, { count: "count" }) +
    "\n" +
    mg.t(m.total, { total: "total" }),

  htmlTemplate: (mg: any) => (
    <Mjml>
      <MjmlBody>
        <MjmlSection>
          <MjmlColumn>
            <MjmlText>{mg.t(m.greeting, { name: "name" })}</MjmlText>
            <MjmlText>{mg.t(m.items, { count: "count" })}</MjmlText>
            {mg.each("lines", (line: any) => (
              <MjmlText>{line.t(m.line, { title: "title", qty: "qty" })}</MjmlText>
            ))}
            <MjmlText align={mg.dir === "rtl" ? "right" : "left"}>
              {mg.t(m.total, { total: "total" })}
            </MjmlText>
            <MjmlButton href={mg.render("url")}>{mg.t(m.cta)}</MjmlButton>
            <MjmlText>
              {mg.t(m.help, {
                link: (chunks: any) => <a href="mailto:help@example.com">{chunks}</a>,
              })}
            </MjmlText>
          </MjmlColumn>
        </MjmlSection>
      </MjmlBody>
    </Mjml>
  ),
};
