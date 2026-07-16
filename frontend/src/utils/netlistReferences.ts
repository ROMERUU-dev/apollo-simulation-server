/** Extracts filenames referenced via .INCLUDE / .LIB directives in a netlist. */
export function extractReferencedFileNames(netlistContent: string): string[] {
  const pattern = /\.(include|lib)\s+["']?([^\s"']+)["']?/gi
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(netlistContent)) !== null) {
    names.add(match[2])
  }
  return Array.from(names)
}
