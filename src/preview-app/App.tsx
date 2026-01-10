import { useCallback, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import { Sidebar } from "@/preview-app/components/Sidebar";
import { Content } from "@/preview-app/components/Content";

//------------------------------------------------------------------------------
import { loadTemplates } from "@/preview-app/TemplateLoader";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types.ts";
import type { Schema } from "@/dsl/types";

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
    loadTemplates().then((templates) => {
      setTemplates(templates);
    });
  }, []);

  //----------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(selectedTemplateId);
    }
  }, [selectedTemplateId, templates]);

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
