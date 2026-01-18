import { useMemo, useState } from "react";
import { renderToMjml } from "@faire/mjml-react/utils/renderToMjml";
import mjml2html from "mjml-browser";

//------------------------------------------------------------------------------
import { PreviewMode } from "@/preview-app/enums";

//------------------------------------------------------------------------------
import { makeTemplatePreviewContext } from "@/cli/rendering/schema-previewing";
import { makePlaceholderData } from "@/cli/rendering/schema-placeholder";

//------------------------------------------------------------------------------
import type { PreviewTemplateContext, TemplateDefinition } from "@/cli/types";
import type { Schema } from "@/dsl/schemas";

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

  //----------------------------------------------------------------------------
  // Memos
  const preview = useMemo(() => {
    if (!selectedTemplate) return;
    switch (mode) {
      case PreviewMode.html:
        return <TemplatePreviewHTML template={selectedTemplate} />;
      case PreviewMode.text:
        return <TemplatePreviewText template={selectedTemplate} />;
    }
  }, [mode, selectedTemplate]);

  //----------------------------------------------------------------------------
  // Render
  return (
    <div className="content">
      {selectedTemplate && (
        <>
          <div className="header">
            <h2 className="title">{selectedTemplate.name}</h2>
            <div className="meta">
              <div className="meta-row">
                <span className="meta-label">subject</span>
                <span className="meta-value">
                  <TemplatePreviewSubject template={selectedTemplate} />
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
          {preview}
        </>
      )}
    </div>
  );
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewSubject = ({
  template,
}: {
  template: TemplateDefinition<Schema<any>>;
}) => {
  //----------------------------------------------------------------------------
  // Memos
  const subjectRender = useMemo(() => {
    return template.subjectTemplate({});
  }, [template]);

  //----------------------------------------------------------------------------
  // Render
  return subjectRender;
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewText = ({
  template,
}: {
  template: TemplateDefinition<Schema<any>>;
}) => {
  //----------------------------------------------------------------------------
  // Memos
  const textRender = useMemo(() => {
    return template.textTemplate({});
  }, [template]);

  //----------------------------------------------------------------------------
  // Render
  return <div className="templatePreview">{textRender}</div>;
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
const TemplatePreviewHTML = ({
  template,
}: {
  template: TemplateDefinition<Schema<any>>;
}) => {
  //----------------------------------------------------------------------------
  // Render
  const htmlRender = useMemo(() => {
    const placeholder = makePlaceholderData(template.params);
    const ctx: PreviewTemplateContext<any> =
      makeTemplatePreviewContext(placeholder);
    const doc = template.htmlTemplate(ctx);

    return (
      <iframe
        title="Email preview"
        srcDoc={mjml2html(renderToMjml(doc)).html}
        sandbox=""
      />
    );
  }, [template]);

  //----------------------------------------------------------------------------
  return <div className="templatePreview">{htmlRender}</div>;
};
