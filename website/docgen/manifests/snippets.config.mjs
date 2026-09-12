//------------------------------------------------------------------------------
// Which files snippets are pulled from, and how their imports are rewritten.
//
// example/ imports mailgrail through deep relative paths ("../../src/cli/types")
// because it lives inside this repo. A reader cannot type that. Each rewrite
// target is checked against the package's real `exports` map, so renaming an
// export entry fails the docs rather than the user.
//------------------------------------------------------------------------------
export default {
  files: [
    "example/emails-src/index.ts",
    "example/emails-src/WelcomeEmail.tsx",
    "example/emails-src/OrderConfirmationEmail.tsx",
    "example/emails-src/TeamInviteEmail.tsx",
    "example/emails-src/components/BaseLayout.tsx",
    "example/emails-src/theme.ts",
    "example/mailgrail.config.ts",
  ],

  importRewrites: {
    "../../src/cli/types": "mailgrail",
    "../../src/dsl/index": "mailgrail",
    "../../src/dsl/schemas": "mailgrail/dsl",
    "../../src/dsl/types": "mailgrail/dsl",
    "../../src/config": "mailgrail",
    "../../src/config/index": "mailgrail",
    "../src/cli/types": "mailgrail",
    "../src/dsl/index": "mailgrail",
    "../src/config": "mailgrail",
    "./src/config": "mailgrail",
  },

  repoUrl: "https://github.com/LuxAnimi/MailGrail/blob/main",
};
