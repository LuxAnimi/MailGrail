import { WelcomeEmail } from "./WelcomeEmail";
import { OrderConfirmationEmail } from "./OrderConfirmationEmail";
import { TeamInviteEmail } from "./TeamInviteEmail";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "../../src/cli/types";

//------------------------------------------------------------------------------
// #region doc:templates-index
export const templates: TemplateDefinition<any>[] = [
  WelcomeEmail,
  OrderConfirmationEmail,
  TeamInviteEmail,
];
// #endregion doc:templates-index
