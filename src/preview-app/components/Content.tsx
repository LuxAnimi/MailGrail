import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// `renderToMjml` is a one-line wrapper around this, and importing it here
// would pull @faire/mjml-react into the preview app's own bundle -- which has
// to stay free of anything React-versioned, since the app now renders with the
// project's React rather than one of its own.
import { renderToStaticMarkup } from "react-dom/server";
import mjml2html from "mjml-browser";
import { DeviceDesktopIcon, DeviceMobileIcon, NoteIcon, type Icon } from "@primer/octicons-react";
import config from "virtual:mailgrailconfig";

//------------------------------------------------------------------------------
import { PreviewMode } from "@/preview-app/enums";

//------------------------------------------------------------------------------
import {
  makeTemplatePreviewContext,
  makeTextPreviewContext,
} from "@/cli/rendering/schema-previewing";
import { guardContext } from "@/cli/rendering/context-guard";
import type { PreviewI18n } from "@/cli/rendering/schema-previewing";
import { applyLocaleToMjml } from "@/i18n/mjml";
import type { PreviewLocales } from "@/preview-app/i18n";
import { makePlaceholderData } from "@/cli/rendering/schema-placeholder";
import { ParamsForm } from "@/preview-app/components/ParamsForm";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types";
import type { Schema } from "@/dsl/schemas";
import type { PreviewDeviceType, ResolvedPreviewDevice } from "@/config/types";

//------------------------------------------------------------------------------
// Octicons has no tablet; a phone on its side reads as one.
const DeviceTabletIcon: Icon = (props) => (
  <span className="device-icon--tablet">
    <DeviceMobileIcon {...props} />
  </span>
);

const DEVICE_ICONS: Record<PreviewDeviceType, Icon> = {
  desktop: DeviceDesktopIcon,
  tablet: DeviceTabletIcon,
  mobile: DeviceMobileIcon,
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const Content = ({
  selectedTemplate,
  locales,
}: {
  selectedTemplate?: TemplateDefinition<Schema<any>>;
  locales: PreviewLocales | null;
}) => {
  //----------------------------------------------------------------------------
  // State
  const [mode] = useState<PreviewMode>(PreviewMode.html);
  const [localeChoice, setLocaleChoice] = useState<string>();
  const [paramsCollapsed, setParamsCollapsed] = useState(true);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [paramOverrides, setParamOverrides] = useState<
    { templateName: string; params: any } | undefined
  >(undefined);

  //----------------------------------------------------------------------------
  // Memos
  const devices = config.previewDevices;
  const device = devices[deviceIndex] ?? devices[0]!;

  const params = useMemo(() => {
    if (!selectedTemplate) return undefined;
    if (paramOverrides?.templateName === selectedTemplate.name) {
      return paramOverrides.params;
    }
    return makePlaceholderData(selectedTemplate.params);
  }, [selectedTemplate, paramOverrides]);

  // A locale dropped from the config falls back to the default.
  const i18n = useMemo<PreviewI18n | undefined>(() => {
    if (!locales) return undefined;
    const known = locales.options.some((o) => o.value === localeChoice);
    return locales.resolve(known && localeChoice ? localeChoice : locales.defaultLocale);
  }, [locales, localeChoice]);

  //----------------------------------------------------------------------------
  // Handlers
  const updateParams = useCallback(
    (newParams: any) => {
      if (!selectedTemplate) return;
      setParamOverrides({ templateName: selectedTemplate.name, params: newParams });
    },
    [selectedTemplate],
  );

  //----------------------------------------------------------------------------
  // Memos
  const preview = useMemo(() => {
    if (!selectedTemplate || params === undefined) return;
    switch (mode) {
      case PreviewMode.html:
        return (
          <TemplatePreviewHTML
            template={selectedTemplate}
            params={params}
            device={device}
            i18n={i18n}
          />
        );
      case PreviewMode.text:
        return (
          <TemplatePreviewText template={selectedTemplate} params={params} i18n={i18n} />
        );
    }
  }, [mode, selectedTemplate, params, device, i18n]);

  //----------------------------------------------------------------------------
  // Render
  return (
    <div className="content">
      {(!selectedTemplate || params === undefined) && (
        <div className="content-splash">
          <img src="/preview-app/assets/mailgrail_main-transparent.png" className="splash-logo" />
          <p className="splash-hint">Select a template to preview</p>
        </div>
      )}
      {selectedTemplate && params !== undefined && (
        <>
          <div className="content-main">
            <div className="header">
              <div className="header-top">
                <div>
                  <h2 className="title">{selectedTemplate.name}</h2>
                  <div className="meta">
                    <div className="meta-row">
                      <span className="meta-label">subject</span>
                      <span className="meta-value">
                        <TemplatePreviewSubject
                          template={selectedTemplate}
                          params={params}
                          i18n={i18n}
                        />
                      </span>
                    </div>

                    {selectedTemplate.sender && (
                      <div className="meta-row">
                        <span className="meta-label">from</span>
                        <span className="meta-value">{selectedTemplate.sender}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="header-controls">
                  {locales && (
                    <select
                      className="locale-picker"
                      title="Locale"
                      value={localeChoice ?? locales.defaultLocale}
                      onChange={(e) => setLocaleChoice(e.target.value)}
                    >
                      {locales.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {devices.length > 1 && (
                    <div className="viewport-picker">
                      {devices.map((d, i) => {
                        const DeviceIcon = DEVICE_ICONS[d.type];
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`viewport-btn${d === device ? " active" : ""}`}
                            onClick={() => setDeviceIndex(i)}
                          >
                            <DeviceIcon size={14} />
                            {d.label}
                            {d.width !== null && (
                              <span className="viewport-width">{d.width}px</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`populate-btn${paramsCollapsed ? "" : " active"}`}
                    onClick={() => setParamsCollapsed((c) => !c)}
                    title={paramsCollapsed ? "Show parameters" : "Hide parameters"}
                  >
                    <NoteIcon size={14} />
                    Populate
                  </button>
                </div>
              </div>
              {locales && <TranslationNotices locales={locales} />}
            </div>
            {preview}
          </div>

          <div className={`params-panel${paramsCollapsed ? " params-panel--collapsed" : ""}`}>
            <div className="params-panel-inner">
              <div className="params-panel-header">Parameters</div>
              <ParamsForm
                schema={selectedTemplate.params}
                value={params}
                onChange={updateParams}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

//------------------------------------------------------------------------------
// The subject and text bodies take the same kind of context as the HTML, in a
// string-composing form. A template still written against the old params API
// throws here; show that message in the pane rather than blanking the preview,
// since it is exactly what the build will say.
//------------------------------------------------------------------------------
function renderTextPart(
  template: TemplateDefinition<Schema<any>>,
  part: "subjectTemplate" | "textTemplate",
  params: any,
  i18n: PreviewI18n | undefined,
): string {
  try {
    return template[part](
      guardContext(makeTextPreviewContext(params, i18n), {
        template: template.name,
        part,
      }),
    );
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewSubject = ({
  template,
  params,
  i18n,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
  i18n: PreviewI18n | undefined;
}) =>
  useMemo(
    () => renderTextPart(template, "subjectTemplate", params, i18n),
    [template, params, i18n],
  );

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewText = ({
  template,
  params,
  i18n,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
  i18n: PreviewI18n | undefined;
}) => {
  //----------------------------------------------------------------------------
  // Memos
  const textRender = useMemo(
    () => renderTextPart(template, "textTemplate", params, i18n),
    [template, params, i18n],
  );

  //----------------------------------------------------------------------------
  // Render
  //
  // pre-wrap because this is the plain-text part: its newlines are the layout,
  // and HTML would otherwise collapse them.
  return (
    <div className="templatePreview" style={{ whiteSpace: "pre-wrap" }}>
      {textRender}
    </div>
  );
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewHTML = ({
  template,
  params,
  device,
  i18n,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
  device: ResolvedPreviewDevice;
  i18n: PreviewI18n | undefined;
}) => {
  //----------------------------------------------------------------------------
  // State
  const [html, setHtml] = useState<string>();

  //----------------------------------------------------------------------------
  // `lang` and `dir` go on the document as the build puts them, so an RTL
  // locale previews right to left.
  //
  // A template that throws -- a message missing an argument, say -- shows the
  // error in the pane rather than the last good render.
  const prepared = useMemo((): { mjml: string } | { error: string } => {
    try {
      const doc = template.htmlTemplate(makeTemplatePreviewContext(params, i18n));
      const mjml = renderToStaticMarkup(doc);
      return { mjml: i18n ? applyLocaleToMjml(mjml, i18n).mjml : mjml };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [template, params, i18n]);

  // Renders are async, so a slow one can finish after a newer one; only the
  // latest is applied.
  useEffect(() => {
    if ("error" in prepared) return;
    let cancelled = false;
    mjml2html(prepared.mjml).then((result) => {
      if (!cancelled) setHtml(result.html);
    });
    return () => {
      cancelled = true;
    };
  }, [prepared]);

  const markup =
    "error" in prepared
      ? `<pre style="white-space: pre-wrap; font-family: monospace">${escapeHtml(prepared.error)}</pre>`
      : html;

  //----------------------------------------------------------------------------
  // The render is written into the frame's existing document rather than
  // passed as `srcDoc`. A new `srcDoc` is a navigation: the frame blanked to
  // white while the new page loaded, images were fetched again and the scroll
  // jumped back to the top -- on every keystroke in the params form.
  //
  // Until the frame has loaded, its contentDocument is the browser's transient
  // initial one -- possibly without even an <html> -- and is about to be
  // replaced. So only the loaded srcdoc document is written to, and `onLoad`
  // does the first write.
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const writeMarkup = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || doc.URL !== "about:srcdoc" || !doc.documentElement) return;
    if (markup !== undefined) writeDocument(doc, markup);
  }, [markup]);

  useEffect(writeMarkup, [writeMarkup]);

  //----------------------------------------------------------------------------
  // allow-same-origin is what lets this page write into the frame. Scripts in
  // the email still cannot run: allow-scripts stays off.
  return (
    <div className={`templatePreview${device.width !== null ? " templatePreview--viewport" : ""}`}>
      <iframe
        ref={iframeRef}
        title="Email preview"
        srcDoc={BLANK_DOCUMENT}
        sandbox="allow-same-origin"
        onLoad={writeMarkup}
        style={device.width !== null ? { width: device.width } : undefined}
      />
    </div>
  );
};

//------------------------------------------------------------------------------
// With a doctype, so the frame is in standards mode like the compiled email.
// A document's mode is fixed when it loads, so writing a doctype later would
// not change it.
const BLANK_DOCUMENT = "<!doctype html><html><head></head><body></body></html>";

//------------------------------------------------------------------------------
// Replaces a live document's contents in place, `<html lang dir>` included, so
// a right-to-left locale still previews right to left. Parsing with DOMParser
// first keeps the `<html>` attributes, which setting innerHTML alone would
// drop.
function writeDocument(doc: Document, markup: string) {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const source = parsed.documentElement;
  const target = doc.documentElement;

  for (const name of target.getAttributeNames()) {
    if (!source.hasAttribute(name)) target.removeAttribute(name);
  }
  for (const name of source.getAttributeNames()) {
    target.setAttribute(name, source.getAttribute(name)!);
  }

  // Restored explicitly: while the old body is swapped out, the page is
  // briefly empty and the browser can clamp the scroll to zero.
  const scroller = doc.scrollingElement;
  const top = scroller?.scrollTop ?? 0;
  const left = scroller?.scrollLeft ?? 0;

  target.innerHTML = source.innerHTML;

  if (scroller) {
    scroller.scrollTop = top;
    scroller.scrollLeft = left;
  }
}

//------------------------------------------------------------------------------
const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );

//------------------------------------------------------------------------------
// What the build would say about the catalogs, said here too. Errors mean a
// translation is not used at all; warnings are gaps the build lets through --
// unless strictLocales is on, which the label says.
//------------------------------------------------------------------------------
const TranslationNotices = ({ locales }: { locales: PreviewLocales }) => {
  const { errors, warnings, strict } = locales;
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <details className={`translation-notices${errors.length > 0 ? " has-errors" : ""}`}>
      <summary>
        {errors.length > 0 &&
          `${errors.length} translation error${errors.length === 1 ? "" : "s"}`}
        {errors.length > 0 && warnings.length > 0 && " · "}
        {warnings.length > 0 &&
          `${warnings.length} translation warning${warnings.length === 1 ? "" : "s"}` +
            (strict ? " (errors with strictLocales)" : "")}
      </summary>
      <ul>
        {[...errors, ...warnings].map((problem, i) => (
          <li key={i}>{problem}</li>
        ))}
      </ul>
    </details>
  );
};
