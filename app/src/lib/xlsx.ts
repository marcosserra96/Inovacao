/** XLSX simples para a planilha de perguntas. Sem dependências e sem upload externo.
 * Exporta ZIP/OOXML padrão; importa XLSX do Excel (shared strings, inline strings,
 * células booleanas/números, ZIP armazenado ou deflate). */
const enc = new TextEncoder()
const dec = new TextDecoder()
const xmlEsc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
const u16 = (a:Uint8Array,p:number) => a[p] | (a[p+1]<<8)
const u32 = (a:Uint8Array,p:number) => (a[p] | a[p+1]<<8 | a[p+2]<<16 | a[p+3]<<24)>>>0
const put16 = (a:Uint8Array,p:number,v:number) => {a[p]=v&255;a[p+1]=(v>>>8)&255}
const put32 = (a:Uint8Array,p:number,v:number) => {put16(a,p,v);put16(a,p+2,v>>>16)}
const concat = (parts:Uint8Array[]) => {const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}
const crcTable = Array.from({length:256},(_,index)=>{let c=index;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0})
const crc32 = (data:Uint8Array) => {let crc=0xffffffff;for(const v of data) crc=crcTable[(crc^v)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}

function makeZip(files:Record<string,string>):Uint8Array {
  const local:Uint8Array[]=[]
  const central:Uint8Array[]=[]
  let offset=0
  for(const [filename,content] of Object.entries(files)){
    const name=enc.encode(filename),body=enc.encode(content),crc=crc32(body)
    const head=new Uint8Array(30+name.length)
    put32(head,0,0x04034b50);put16(head,4,20);put16(head,8,0);put32(head,14,crc)
    put32(head,18,body.length);put32(head,22,body.length);put16(head,26,name.length)
    head.set(name,30)
    local.push(head,body)
    const entry=new Uint8Array(46+name.length)
    put32(entry,0,0x02014b50);put16(entry,4,20);put16(entry,6,20)
    put32(entry,16,crc);put32(entry,20,body.length);put32(entry,24,body.length)
    put16(entry,28,name.length);put32(entry,42,offset);entry.set(name,46)
    central.push(entry);offset+=head.length+body.length
  }
  const directory=concat(central)
  const end=new Uint8Array(22)
  put32(end,0,0x06054b50);put16(end,8,central.length);put16(end,10,central.length)
  put32(end,12,directory.length);put32(end,16,offset)
  return concat([...local,directory,end])
}
function columnName(index:number):string {
  let result=''
  for(let n=index+1;n>0;n=Math.floor((n-1)/26)) result=String.fromCharCode(65+(n-1)%26)+result
  return result
}
export function downloadQuestionsXlsx(rows:string[][], filename='perguntas_quiz.xlsx') {
  const cells=rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((value,c)=>{
    const ref=columnName(c)+(r+1),content=xmlEsc(value??'')
    return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+content+'</t></is></c>'
  }).join('')+'</row>').join('')
  const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">'+
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    '<sheetData>'+cells+'</sheetData><autoFilter ref="A1:M'+Math.max(1,rows.length)+'"/></worksheet>'
  const files={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
      '<Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?>'+
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
      '<sheets><sheet name="Perguntas" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet,
  }
  const bytes=makeZip(files)
  const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a');link.href=url;link.download=filename;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function unzip(data:Uint8Array):Promise<Map<string,Uint8Array>> {
  let eocd=-1
  for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){
    if(u32(data,i)===0x06054b50){eocd=i;break}
  }
  if(eocd<0)throw Error('XLSX inválido: estrutura ZIP não encontrada.')
  const count=u16(data,eocd+10),offset=u32(data,eocd+16)
  if(count>5000)throw Error('Planilha com quantidade excessiva de arquivos.')
  const files=new Map<string,Uint8Array>()
  let pos=offset
  for(let i=0;i<count;i++){
    if(u32(data,pos)!==0x02014b50)throw Error('Estrutura XLSX corrompida.')
    const method=u16(data,pos+10),size=u32(data,pos+20),nameLength=u16(data,pos+28)
    const extra=u16(data,pos+30),comment=u16(data,pos+32),localOffset=u32(data,pos+42)
    if(size>30_000_000)throw Error('Arquivo XLSX contém uma parte muito grande.')
    const filename=dec.decode(data.slice(pos+46,pos+46+nameLength))
    if(u32(data,localOffset)!==0x04034b50)throw Error('Entrada ZIP inválida.')
    const localStart=localOffset+30+u16(data,localOffset+26)+u16(data,localOffset+28)
    const compressed=data.slice(localStart,localStart+size)
    if(filename.startsWith('xl/') && (filename.endsWith('.xml') || filename.endsWith('.rels'))){
      if(method===0)files.set(filename,compressed)
      else if(method===8){
        if(typeof DecompressionStream==='undefined')throw Error('Este navegador não consegue descompactar XLSX.')
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        files.set(filename,new Uint8Array(await new Response(stream).arrayBuffer()))
      }else throw Error('Método de compressão do XLSX não suportado.')
    }
    pos+=46+nameLength+extra+comment
  }
  return files
}
const parseXml=(value:Uint8Array)=> {
  const doc=new DOMParser().parseFromString(dec.decode(value),'application/xml')
  if(doc.getElementsByTagName('parsererror').length)throw Error('XML interno do XLSX inválido.')
  return doc
}
const localTag=(element:Element,name:string):Element|undefined=>
  Array.from(element.getElementsByTagName('*')).find(e=>e.localName===name)
const allTags=(element:Element,name:string):Element[]=>
  Array.from(element.getElementsByTagName('*')).filter(e=>e.localName===name)
const indexFromRef=(ref:string):number=>{
  let index=0
  for(const char of (ref.match(/^[A-Z]+/i)?.[0]??''))index=index*26+(char.toUpperCase().charCodeAt(0)-64)
  return index-1
}
export async function parseQuestionsXlsx(file:File):Promise<string[][]> {
  if(file.size>15_000_000)throw Error('XLSX muito grande (máximo 15 MB).')
  const files=await unzip(new Uint8Array(await file.arrayBuffer()))
  const get=(path:string)=>{const part=files.get(path);if(!part)throw Error('Arquivo XLSX sem '+path);return parseXml(part)}
  const workbook=get('xl/workbook.xml')
  const firstSheet=allTags(workbook.documentElement,'sheet')[0]
  if(!firstSheet)throw Error('XLSX não contém abas.')
  const relId=firstSheet.getAttribute('r:id') ??
    firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')
  const rels=files.get('xl/_rels/workbook.xml.rels')
  const rel=rels ? allTags(parseXml(rels).documentElement,'Relationship').find(r=>r.getAttribute('Id')===relId) : undefined
  const target=rel?.getAttribute('Target')??'worksheets/sheet1.xml'
  const path=target.startsWith('/')?target.slice(1):('xl/'+target.replace(/^\.\//,'')).replace(/\/[^/]+\/\.\.\//g,'/')
  const sheet=get(path)
  const shared=files.get('xl/sharedStrings.xml')
  const strings=shared ? allTags(parseXml(shared).documentElement,'si').map(si=>allTags(si,'t').map(t=>t.textContent??'').join('')) : []
  const output:string[][]=[]
  for(const row of allTags(sheet.documentElement,'row')){
    const values:string[]=[]
    let cursor=0
    for(const cell of allTags(row,'c')){
      const cellRef=cell.getAttribute('r')
      const idx=cellRef?indexFromRef(cellRef):cursor
      if(idx<0||idx>1000)continue
      const type=cell.getAttribute('t')
      const raw=localTag(cell,'v')?.textContent??''
      let value=type==='s'?(strings[Number(raw)]??''):type==='inlineStr'?
        allTags(cell,'t').map(t=>t.textContent??'').join(''):raw
      if(type==='b')value=raw==='1'?'true':'false'
      values[idx]=value
      cursor=idx+1
    }
    output.push(Array.from({length:values.length},(_,i)=>values[i]??''))
  }
  if(!output.length)throw Error('A primeira aba do XLSX está vazia.')
  return output
}
