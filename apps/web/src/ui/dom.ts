type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attributes ?? {})) node.setAttribute(name, value);
  if (options.style) Object.assign(node.style, options.style);
  for (const child of children) if (child) node.append(child);
  return node;
}

export function showToast(host: HTMLElement, message: string, tone: "info" | "error" = "info"): void {
  const toast = element("div", { className: `toast toast--${tone}`, text: message });
  host.append(toast);
  window.setTimeout(() => toast.classList.add("toast--leaving"), 3200);
  window.setTimeout(() => toast.remove(), 3700);
}
