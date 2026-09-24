import { useCallback, useEffect, useMemo, useState } from "react";
// `renderToMjml` is a one-line wrapper around this, and importing it here
// would pull @faire/mjml-react into the preview app's own bundle -- which has
// to stay free of anything React-versioned, since the app now renders with the
// project's React rather than one of its own.
import { renderToStaticMarkup } from "react-dom/server";
import mjml2html from "mjml-browser";
import { DeviceDesktopIcon, DeviceMobileIcon, NoteIcon, type Icon } from "@primer/octicons-react";

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

//------------------------------------------------------------------------------
type ViewportPreset = {
  id: string;
  label: string;
  width: number | null;
  icon: Icon;
};

const VIEWPORTS: ViewportPreset[] = [
  { id: "desktop", label: "Desktop", width: null, icon: DeviceDesktopIcon },
  { id: "mobile", label: "Mobile", width: 375, icon: DeviceMobileIcon },
];

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
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [viewport, setViewport] = useState<ViewportPreset>(VIEWPORTS[0]);
  const [paramOverrides, setParamOverrides] = useState<
    { templateName: string; params: any } | undefined
  >(undefined);

  //----------------------------------------------------------------------------
  // Memos
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
            viewport={viewport}
            i18n={i18n}
          />
        );
      case PreviewMode.text:
        return (
          <TemplatePreviewText template={selectedTemplate} params={params} i18n={i18n} />
        );
    }
  }, [mode, selectedTemplate, params, viewport, i18n]);

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
                  <div className="viewport-picker">
                    {VIEWPORTS.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        className={`viewport-btn${viewport.id === vp.id ? " active" : ""}`}
                        onClick={() => setViewport(vp)}
                      >
                        <vp.icon size={14} />
                        {vp.label}
                        {vp.width !== null && (
                          <span className="viewport-width">{vp.width}px</span>
                        )}
                      </button>
                    ))}
                  </div>
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
  viewport,
  i18n,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
  viewport: ViewportPreset;
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

  useEffect(() => {
    if ("error" in prepared) return;
    mjml2html(prepared.mjml).then((result) => {
      setHtml(result.html);
    });
  }, [prepared]);

  const srcDoc =
    "error" in prepared
      ? `<pre style="white-space: pre-wrap; font-family: monospace">${escapeHtml(prepared.error)}</pre>`
      : html;

  //----------------------------------------------------------------------------
  return (
    <div className={`templatePreview${viewport.width !== null ? " templatePreview--viewport" : ""}`}>
      <iframe
        title="Email preview"
        srcDoc={srcDoc}
        sandbox=""
        style={viewport.width !== null ? { width: viewport.width } : undefined}
      />
    </div>
  );
};

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
