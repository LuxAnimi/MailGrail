import { WelcomeEmail } from "./WelcomeEmail";
import { OrderConfirmationEmail } from "./OrderConfirmationEmail";
import { TeamInviteEmail } from "./TeamInviteEmail";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "../../src/cli/types";

//------------------------------------------------------------------------------
export const templates: TemplateDefinition<any>[] = [
  WelcomeEmail,
  OrderConfirmationEmail,
  TeamInviteEmail,
];
