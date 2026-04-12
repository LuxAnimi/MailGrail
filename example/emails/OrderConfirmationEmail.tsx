//------------------------------------------------------------------------------
import type { ReactElement } from "react";
import { MjmlColumn } from "@faire/mjml-react";

//------------------------------------------------------------------------------
import BaseLayout from "./components/BaseLayout";
import Button from "./components/Button";
import Heading from "./components/Heading";
import MainText from "./components/MainText";
import Text from "./components/Text";

//------------------------------------------------------------------------------
import type { HtmlTemplateContext, TemplateDefinition } from "../../src/cli/types";
import { t } from "../../src/dsl/index";
import type { Infer } from "../../src/dsl/schemas";
import { colors, fontSize, fontWeight, spacing } from "./theme";

//------------------------------------------------------------------------------
const paramsSchema = t.object({
  orderNumber: t.string(),
  items: t.array(                              // array of object — line items
    t.object({
      name: t.string(),
      quantity: t.number(),                    // number — item quantity
      price: t.number(),                       // number — item unit price
    }),
  ),
  couponCode: t.optional(t.string()),          // optional — not required
  total: t.number(),                           // number — order total
});

//------------------------------------------------------------------------------
type Params = Infer<typeof paramsSchema>;

//------------------------------------------------------------------------------
const subjectTemplate = (params: Params): string =>
  `Your mailgrail order #${params.orderNumber} is confirmed`;

//------------------------------------------------------------------------------
const textTemplate = (params: Params): string =>
  `Order #${params.orderNumber} confirmed. Total: $${params.total}. View it at https://mailgrail.com/orders`;

//------------------------------------------------------------------------------
const htmlTemplate = (mg: HtmlTemplateContext<Params>): ReactElement => (
  <BaseLayout width={600}>
    <MjmlColumn>
      <Heading>Order confirmed.</Heading>

      <MainText>
        Order{" "}
        <strong style={{ color: colors.content.secondary }}>
          #{mg.render("orderNumber")}
        </strong>
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
                style={{ borderBottom: `1px solid ${colors.content.quaternary}` }}
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
                  ${item.render("price")}
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
                ${mg.render("total")}
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
        View Order
      </Button>
    </MjmlColumn>
  </BaseLayout>
);

//------------------------------------------------------------------------------
export const OrderConfirmationEmail: TemplateDefinition<typeof paramsSchema> = {
  name: "order-confirmation",
  sender: "orders@mailgrail.com",
  subjectTemplate,
  htmlTemplate,
  textTemplate,
  params: paramsSchema,
};
