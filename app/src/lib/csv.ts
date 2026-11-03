// Parser/serializer CSV mínimo (RFC 4180: vírgula, aspas duplas, quebras de
// linha dentro de campo), suficiente para importar/exportar perguntas sem
// depender de uma biblioteca externa.

export function parseCsv(source: string): string[][] {
  // Excel em pt-BR pode usar ';' ao salvar. Aceita também a linha "sep=,"
  // adicionada pela própria exportação da plataforma.
  let text = source.replace(/^\uFEFF/, '')
  const directive = text.match(/^sep\s*=\s*([,;])\s*(?:\r?\n|$)/i)
  // Se o Excel regravou o arquivo com outro separador, priorize o cabeçalho real.
  const withoutDirective = directive ? text.slice(directive[0].length) : text
  const header = withoutDirective.split(/\r?\n/, 1)[0] ?? ''
  const countOutsideQuotes = (line: string, separator: string) => {
    let inside = false
    let count = 0
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inside && line[i + 1] === '"') i++
        else inside = !inside
      } else if (!inside && line[i] === separator) count++
    }
    return count
  }
  const commas = countOutsideQuotes(header, ',')
  const semicolons = countOutsideQuotes(header, ';')
  const delimiter = commas === semicolons
    ? (directive?.[1] ?? ',')
    : (semicolons > commas ? ';' : ',')
  text = withoutDirective

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && char === delimiter) {
      row.push(field); field = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) rows.push([...row, field])
  return rows.filter(r => r.some(v => v.trim()))
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')
}

export function downloadCsv(filename: string, rows: string[][], excelMode = false) {
  const blob = new Blob(['\uFEFF', excelMode ? 'sep=,\r\n' : '', toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
