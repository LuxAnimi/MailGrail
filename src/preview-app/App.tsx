import { useCallback, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import { Sidebar } from "@/preview-app/components/Sidebar";
import { Content } from "@/preview-app/components/Content";

//------------------------------------------------------------------------------
import { templates as _templates } from "virtual:mailgrailtemplates";

//------------------------------------------------------------------------------
import { useTemplates } from "./TemplateLoader";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types.ts";
import type { Schema } from "@/dsl/schemas";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export default function App() {
  //----------------------------------------------------------------------------
  const templates = useTemplates();

  //----------------------------------------------------------------------------
  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();

  //----------------------------------------------------------------------------
  // Memos
  const selectedTemplate = useMemo(() => {
    const temp = templates.find((t) => t.name === selectedTemplateId);
    return temp ? { ...temp } : undefined;
  }, [templates, selectedTemplateId]);

  //----------------------------------------------------------------------------
  // Handlers
  const setSelectedTemplate = useCallback(
    (template?: TemplateDefinition<Schema<any>>) => {
      setSelectedTemplateId(template?.name);
    },
    [],
  );

  //----------------------------------------------------------------------------
  // Render
  return (
    <div className="app-root">
      <Sidebar
        templates={templates}
        selectedTemplate={selectedTemplate}
        onTemplateSelected={setSelectedTemplate}
      />
      <Content selectedTemplate={selectedTemplate} />
    </div>
  );
}
