import { useCallback, useEffect, useMemo, useState } from "react";
import { renderToMjml } from "@faire/mjml-react/utils/renderToMjml";
import mjml2html from "mjml-browser";

//------------------------------------------------------------------------------
import { PreviewMode } from "@/preview-app/enums";

//------------------------------------------------------------------------------
import { makeTemplatePreviewContext } from "@/cli/rendering/schema-previewing";
import { makePlaceholderData } from "@/cli/rendering/schema-placeholder";
import { ParamsForm } from "@/preview-app/components/ParamsForm";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types";
import type { Schema } from "@/dsl/schemas";

//------------------------------------------------------------------------------
type ViewportPreset = { id: string; label: string; width: number | null };

const VIEWPORTS: ViewportPreset[] = [
  { id: "desktop", label: "Desktop", width: null },
  { id: "mobile", label: "Mobile", width: 375 },
];

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const Content = ({
  selectedTemplate,
}: {
  selectedTemplate?: TemplateDefinition<Schema<any>>;
}) => {
  //----------------------------------------------------------------------------
  // State
  const [mode] = useState<PreviewMode>(PreviewMode.html);
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
          />
        );
      case PreviewMode.text:
        return <TemplatePreviewText template={selectedTemplate} params={params} />;
    }
  }, [mode, selectedTemplate, params, viewport]);

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

                <div className="viewport-picker">
                  {VIEWPORTS.map((vp) => (
                    <button
                      key={vp.id}
                      type="button"
                      className={`viewport-btn${viewport.id === vp.id ? " active" : ""}`}
                      onClick={() => setViewport(vp)}
                    >
                      {vp.label}
                      {vp.width !== null && (
                        <span className="viewport-width">{vp.width}px</span>
                      )}
                    </button>
                  ))}
                  <div className="viewport-picker-separator" />
                  <button
                    type="button"
                    className={`viewport-btn${paramsCollapsed ? "" : " active"}`}
                    onClick={() => setParamsCollapsed((c) => !c)}
                    title={paramsCollapsed ? "Show parameters" : "Hide parameters"}
                  >
                    Params
                  </button>
                </div>
              </div>
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
//------------------------------------------------------------------------------
const TemplatePreviewSubject = ({
  template,
  params,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
}) => useMemo(() => template.subjectTemplate(params), [template, params]);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewText = ({
  template,
  params,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
}) => {
  //----------------------------------------------------------------------------
  // Memos
  const textRender = useMemo(
    () => template.textTemplate(params),
    [template, params],
  );

  //----------------------------------------------------------------------------
  // Render
  return <div className="templatePreview">{textRender}</div>;
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewHTML = ({
  template,
  params,
  viewport,
}: {
  template: TemplateDefinition<Schema<any>>;
  params: any;
  viewport: ViewportPreset;
}) => {
  //----------------------------------------------------------------------------
  // State
  const [html, setHtml] = useState<string>();

  //----------------------------------------------------------------------------
  useEffect(() => {
    const doc = template.htmlTemplate(makeTemplatePreviewContext(params));
    mjml2html(renderToMjml(doc)).then((result) => {
      setHtml(result.html);
    });
  }, [template, params]);

  //----------------------------------------------------------------------------
  return (
    <div className={`templatePreview${viewport.width !== null ? " templatePreview--viewport" : ""}`}>
      <iframe
        title="Email preview"
        srcDoc={html}
        sandbox=""
        style={viewport.width !== null ? { width: viewport.width } : undefined}
      />
    </div>
  );
};
