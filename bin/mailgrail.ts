#!/usr/bin/env node
import { run } from "../src/cli/index.js";

run().catch((err) => {
  // Most failures here are actionable messages meant for the user (a missing
  // templating engine, a bad config, an MJML error). Printing the stack around
  // them buries the message, so keep it for unexpected values or MAILGRAIL_DEBUG.
  if (err instanceof Error && !process.env.MAILGRAIL_DEBUG) {
    console.error(`\nmailgrail: ${err.message}\n`);
  } else {
    console.error(err);
  }

  process.exit(1);
});
