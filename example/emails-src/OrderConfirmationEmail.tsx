//------------------------------------------------------------------------------
import type { ReactElement } from "react";
import { MjmlColumn } from "@faire/mjml-react";

//------------------------------------------------------------------------------
import BaseLayout from "./components/BaseLayout";
import Button from "./components/Button";
import Heading from "./components/Heading";
import MainText from "./components/MainText";
import Strong from "./components/Strong";
import Text from "./components/Text";

//------------------------------------------------------------------------------
import type {
  HtmlTemplateContext,
  TemplateDefinition,
  TextTemplateContext,
} from "../../src/cli/types";
import { t } from "../../src/dsl/index";
import { defineMessages } from "../../src/config/index";
import type { Infer } from "../../src/dsl/schemas";
import { colors, fontSize, fontWeight, spacing } from "./theme";

//------------------------------------------------------------------------------
// #region doc:order-schema
const paramsSchema = t.object({
  orderNumber: t.string(),
  items: t.array(                              // array of object
    t.object({
      name: t.string(),
      quantity: t.number(),                    // number — item quantity
      price: t.number(),                       // number — item unit price
    }),
  ),
  couponCode: t.optional(t.string()),          // optional — not required
  total: t.number(),                           // number — order total
});
// #endregion doc:order-schema

//------------------------------------------------------------------------------
// Amounts go through `number, ::currency/USD` rather than a hardcoded "$", so
// each locale writes them its own way: $1,234.50 in English, 1 234,50 $US in
// French.
const messages = defineMessages("order-confirmation", {
  subject: "Your MailGrail order #{orderNumber} is confirmed",
  heading: "Order confirmed.",
  orderNumber: "Order <b>#{orderNumber}</b>",
  amount: "{amount, number, ::currency/USD}",
  cta: "View order",
  text:
    "Order #{orderNumber} confirmed. Total: {total, number, ::currency/USD}. " +
    "View it at https://mailgrail.com/orders",
});

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (mg: TextTemplateContext<Params>): string =>
  mg.t(messages.subject, { orderNumber: "orderNumber" });

//------------------------------------------------------------------------------
const textTemplate = (mg: TextTemplateContext<Params>): string =>
  mg.t(messages.text, { orderNumber: "orderNumber", total: "total" });

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout mg={mg} width={600}>
    <MjmlColumn>
      <Heading>{mg.t(messages.heading)}</Heading>

      <MainText>
        {mg.t(messages.orderNumber, {
          orderNumber: "orderNumber",
          b: (chunks) => <Strong>{chunks}</Strong>,
        })}
      </MainText>

      <Text
        align="left"
        paddingTop={spacing.s6}
        paddingLeft={spacing.s7}
        paddingRight={spacing.s7}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: fontSize.sm,
          }}
        >
          <tbody>
            {mg.each("items", (item, index) => (
              <tr
                key={index}
                style={{ borderBottom: `1px solid ${colors.border.secondary}` }}
              >
                <td style={{ padding: "10px 0", color: colors.content.primary }}>
                  {item.render("name")}
                </td>
                <td
                  style={{
                    padding: "10px 0",
                    color: colors.content.tertiary,
                    textAlign: "center",
                    width: "40px",
                  }}
                >
                  ×{item.render("quantity")}
                </td>
                <td
                  style={{
                    padding: "10px 0",
                    color: colors.content.primary,
                    textAlign: "right",
                  }}
                >
                  {item.t(messages.amount, { amount: "price" })}
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={2}
                style={{
                  paddingTop: "14px",
                  color: colors.content.tertiary,
                  fontSize: fontSize.xs,
                }}
              >
                {mg.render("couponCode")}
              </td>
              <td
                style={{
                  paddingTop: "14px",
                  color: colors.content.primary,
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.md,
                  textAlign: "right",
                }}
              >
                {mg.t(messages.amount, { amount: "total" })}
              </td>
            </tr>
          </tbody>
        </table>
      </Text>

      <Button
        href="https://mailgrail.com/orders"
        target="_blank"
        rel="noreferrer"
      >
        {mg.t(messages.cta)}
      </Button>
    </MjmlColumn>
  </BaseLayout>
);

//------------------------------------------------------------------------------
export const OrderConfirmationEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "order-confirmation",
  sender: "orders@mailgrail.com",
  category: "Orders",
  subjectTemplate,
  htmlTemplate,
  textTemplate,
  params: paramsSchema,
};
