/** Extrae variables {{asi}} del contenido de una plantilla. */
export function extractTemplateVars(content: string): string[] {
  const found = new Set<string>();
  for (const m of content.matchAll(/\{\{\s*([\w .-]{1,40}?)\s*\}\}/g)) {
    found.add(m[1]!.trim());
  }
  return [...found];
}
