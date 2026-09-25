// An image in an email needs an absolute URL: the email is read far from
// wherever it was built. These are served by the project's website.
const logoBase = "https://luxanimi.github.io/MailGrail/logo/email";

export const metadata = {
  contact_email: "example@mailgrail.com",
  // Drawn for the header's dark band and the white body, respectively.
  logo_dark_url: `${logoBase}/mailgrail-dark.png`,
  logo_light_url: `${logoBase}/mailgrail-light.png`,
};
