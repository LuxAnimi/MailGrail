import { useCallback, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import { Sidebar } from "@/preview-app/components/Sidebar";
import { Content } from "@/preview-app/components/Content";

//------------------------------------------------------------------------------
import { loadTemplates } from "@/preview-app/TemplateLoader";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types.ts";
import type { Schema } from "@/dsl/schemas";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export default function App() {
  const [templates, setTemplates] = useState<TemplateDefinition<Schema<any>>[]>(
    [],
  );

  //----------------------------------------------------------------------------
  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();

  //----------------------------------------------------------------------------
  // Memos
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.name === selectedTemplateId);
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
  // Effect
  useEffect(() => {
    if (templates.length > 0) return;
    loadTemplates().then((_templates) => {
      setTemplates(_templates);
      if (selectedTemplate === undefined && _templates.length > 0) {
        setSelectedTemplateId(_templates[0].name);
      }
    });
  }, []);

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
