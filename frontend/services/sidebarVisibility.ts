const openSidebars = new Set<symbol>();
const listeners = new Set<() => void>();

export function subscribeSidebarVisibility(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSidebarVisible() {
  return openSidebars.size > 0;
}

export function setSidebarVisible(id: symbol, visible: boolean) {
  const before = getSidebarVisible();
  if (visible) openSidebars.add(id);
  else openSidebars.delete(id);
  if (before !== getSidebarVisible()) listeners.forEach((listener) => listener());
}
