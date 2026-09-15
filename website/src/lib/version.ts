//------------------------------------------------------------------------------
// The package version, read from the root package.json at site build time.
//
// Deliberately not part of the generated docs data. That JSON is committed and
// byte-checked in CI, so a version copied into it went stale on every
// `npm version` and failed the check until someone regenerated. package.json is
// in every checkout -- including the light Pages job, which otherwise reads
// only committed JSON -- so the site takes the version from the source itself.
//------------------------------------------------------------------------------
import pkg from "../../../package.json";

export const version: string = pkg.version;
