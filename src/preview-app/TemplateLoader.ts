import { useSyncExternalStore } from "react";
import { templates as initialTemplates } from "virtual:mailgrailtemplates";

//------------------------------------------------------------------------------
let current = initialTemplates;
const listeners = new Set<() => void>();

//------------------------------------------------------------------------------
export function getTemplates() {
  return current;
}

//------------------------------------------------------------------------------
export function setTemplates(next: typeof current) {
  current = next;
  for (const l of listeners) l();
}

//------------------------------------------------------------------------------
export function useTemplates() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

//------------------------------------------------------------------------------
if (import.meta.hot) {
  import.meta.hot.accept("virtual:mailgrailtemplates", (mod) => {
    if (mod?.templates) setTemplates(mod.templates);
  });
}
