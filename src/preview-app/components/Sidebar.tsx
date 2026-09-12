import { useCallback, useMemo } from "react";

//------------------------------------------------------------------------------
import config from "virtual:mailgrailconfig";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types";
import type { Schema } from "@/dsl/schemas";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const Sidebar = ({
  templates,
  selectedTemplate,
  onTemplateSelected,
}: {
  templates: TemplateDefinition<Schema<any>>[];
  selectedTemplate?: TemplateDefinition<Schema<any>>;
  onTemplateSelected: (template?: TemplateDefinition<Schema<any>>) => void;
}) => {
  //----------------------------------------------------------------------------
  // Render
  return (
    <div className="sidebar">
      <div className="header">
        {!config.hideAppLogo && (
          <img src="/preview-app/assets/mailgrail_main-transparent.png" />
        )}
        {!config.hideAppName && <h1 className="title">MailGrail</h1>}
        {!config.hideAppDescription && (
          <p className="subtitle">
            Fast email template iteration, <br />
            even faster integration
          </p>
        )}
      </div>
      <nav>
        <header>Templates:</header>
        {templates.map((template) => (
          <SideBarTemplate
            key={template.name}
            template={template}
            selectedTemplate={selectedTemplate}
            onClick={onTemplateSelected}
          />
        ))}
      </nav>
    </div>
  );
};

//------------------------------------------------------------------------------
const SideBarTemplate = ({
  template,
  selectedTemplate,
  onClick,
}: {
  template: TemplateDefinition<Schema<any>>;
  selectedTemplate?: TemplateDefinition<Schema<any>>;
  onClick: (template?: TemplateDefinition<Schema<any>>) => void;
}) => {
  //--------------------------------------------------------------------------
  // Memos
  const isSelected = useMemo(
    () => selectedTemplate && template.name === selectedTemplate.name,
    [template, selectedTemplate],
  );

  //--------------------------------------------------------------------------
  // Handlers
  const clickHandler = useCallback(() => {
    onClick(template);
  }, [template, onClick]);

  //--------------------------------------------------------------------------
  // Render
  return (
    <button
      type="button"
      key={template.name}
      onClick={clickHandler}
      className={isSelected ? "active button" : "button"}
    >
      {template.name}
    </button>
  );
};
