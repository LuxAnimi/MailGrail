import { useCallback, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import config, { project } from "virtual:mailgrailconfig";

//------------------------------------------------------------------------------
import type { TemplateDefinition } from "@/cli/types";
import type { Schema } from "@/dsl/schemas";

//------------------------------------------------------------------------------
const DOCS_URL =
  "https://luxanimi.github.io/MailGrail/docs/getting-started/introduction/";

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
  // State
  const [collapsed, setCollapsed] = useState(loadCollapsedCategories);

  //----------------------------------------------------------------------------
  // Memos
  // Templates without a category stay at the top level; the rest are grouped
  // in the order their category first appears.
  const [uncategorized, categories] = useMemo(() => {
    const loose: TemplateDefinition<Schema<any>>[] = [];
    const grouped = new Map<string, TemplateDefinition<Schema<any>>[]>();
    for (const template of templates) {
      if (!template.category) {
        loose.push(template);
        continue;
      }
      const group = grouped.get(template.category);
      if (group) group.push(template);
      else grouped.set(template.category, [template]);
    }
    return [loose, [...grouped]] as const;
  }, [templates]);

  //----------------------------------------------------------------------------
  // Handlers
  const toggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(category)) next.add(category);
      saveCollapsedCategories(next);
      return next;
    });
  }, []);

  //----------------------------------------------------------------------------
  // Render
  return (
    <div className="sidebar">
      <div className="header">
        {!config.hideAppLogo && (
          <img src="/preview-app/assets/mailgrail_main-transparent.png" />
        )}
        {/* The project's own name, so it is obvious which preview this is.
            The logo stays MailGrail's -- a package.json has no logo. */}
        {!config.hideAppName && (
          <h1 className="title">{project.name ?? "MailGrail"}</h1>
        )}
        {!config.hideAppDescription && (
          <p className="subtitle">
            {project.description ?? (
              <>
                Fast email template iteration, <br />
                even faster integration
              </>
            )}
          </p>
        )}
      </div>
      <nav>
        <header>Templates:</header>
        {uncategorized.map((template) => (
          <SideBarTemplate
            key={template.name}
            template={template}
            selectedTemplate={selectedTemplate}
            onClick={onTemplateSelected}
          />
        ))}
        {categories.map(([category, categoryTemplates]) => (
          <SideBarCategory
            key={category}
            category={category}
            templates={categoryTemplates}
            collapsed={collapsed.has(category)}
            onToggle={toggleCategory}
            selectedTemplate={selectedTemplate}
            onTemplateSelected={onTemplateSelected}
          />
        ))}
      </nav>
      <footer className="footer">
        <a href={DOCS_URL} target="_blank" rel="noreferrer">
          Documentation ↗
        </a>
      </footer>
    </div>
  );
};

//------------------------------------------------------------------------------
const SideBarCategory = ({
  category,
  templates,
  collapsed,
  onToggle,
  selectedTemplate,
  onTemplateSelected,
}: {
  category: string;
  templates: TemplateDefinition<Schema<any>>[];
  collapsed: boolean;
  onToggle: (category: string) => void;
  selectedTemplate?: TemplateDefinition<Schema<any>>;
  onTemplateSelected: (template?: TemplateDefinition<Schema<any>>) => void;
}) => {
  //--------------------------------------------------------------------------
  // Memos
  // A collapsed group hides the selection, so its header carries it instead.
  const containsSelected = useMemo(
    () =>
      !!selectedTemplate &&
      templates.some((t) => t.name === selectedTemplate.name),
    [templates, selectedTemplate],
  );

  //--------------------------------------------------------------------------
  // Handlers
  const toggleHandler = useCallback(() => {
    onToggle(category);
  }, [category, onToggle]);

  //--------------------------------------------------------------------------
  // Render
  return (
    <div className={collapsed ? "category collapsed" : "category"}>
      <button
        type="button"
        className={
          collapsed && containsSelected
            ? "category-header has-active"
            : "category-header"
        }
        aria-expanded={!collapsed}
        onClick={toggleHandler}
      >
        <span className="category-chevron" aria-hidden="true">
          ▸
        </span>
        <span className="category-name">{category}</span>
        <span className="category-count">{templates.length}</span>
      </button>
      {!collapsed && (
        <div className="category-templates">
          {templates.map((template) => (
            <SideBarTemplate
              key={template.name}
              template={template}
              selectedTemplate={selectedTemplate}
              onClick={onTemplateSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
};

//------------------------------------------------------------------------------
// Collapsed categories survive a reload. Storage can be unavailable (private
// windows, blocked site data), in which case every group simply starts open.
const COLLAPSED_STORAGE_KEY = "mailgrail:collapsed-categories";

function loadCollapsedCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((c): c is string => typeof c === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function saveCollapsedCategories(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Not persisted; the in-memory state still applies.
  }
}

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
