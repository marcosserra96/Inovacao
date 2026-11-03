import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { DEFAULT_QUIZ_THEME, normalizeQuizTheme, themeFromRow, themeStyle, type QuizVisualTheme } from '@/lib/quizVisualTheme'

type ThemeRow = QuizVisualTheme & { isSystem?: boolean }

async function logoFromFile(file: File): Promise<string> {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Use PNG, JPG ou WebP.')
  if (file.size > 5_000_000) throw Error('Imagem acima de 5 MB.')
  const image = new Image()
  const source = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
      image.src = source
    })
    const scale = Math.min(1, 800 / image.naturalWidth, 280 / image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height)
    const encoded = canvas.toDataURL('image/webp',0.82)
    if (encoded.length > 330000) throw Error('Imagem ainda muito grande. Escolha uma imagem menor.')
    return encoded
  } finally { URL.revokeObjectURL(source) }
}

export function PresenterVisualThemes() {
  const notify = useToast()
  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [selected, setSelected] = useState('')
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState<QuizVisualTheme>(DEFAULT_QUIZ_THEME)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{data, error}, {data: defaults}] = await Promise.all([
      supabase.from('quiz_visual_themes' as never).select('*').order('created_at'),
      supabase.from('live_quiz_defaults').select('visual_theme_id').eq('id',true).maybeSingle(),
    ])
    if (error) { notify('Não foi possível carregar os temas: '+error.message,'error'); setLoading(false); return }
    const items = ((data ?? []) as unknown as Record<string,unknown>[]).map(row => ({
      ...themeFromRow(row),
      isSystem: Boolean(row.is_system),
    }))
    setThemes(items)
    setActiveId(defaults?.visual_theme_id ?? '')
    setSelected(old => old && items.some(t => t.id===old) ? old : (defaults?.visual_theme_id ?? items[0]?.id ?? ''))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const match = themes.find(t => t.id===selected)
    if (match) setDraft(match)
  }, [selected, themes])

  const change = (data: Partial<QuizVisualTheme>) => setDraft(d => ({...d,...data}))
  const duplicate = () => {
    setSelected('')
    setDraft({...draft,id:'',name:draft.name+' — cópia'})
  }

  const save = async () => {
    if (!draft.name.trim() || !draft.title.trim()) { notify('Informe o nome do tema e o título do evento.','error'); return }
    setBusy(true)
    const {data,error} = await supabase.rpc('presenter_save_visual_theme' as never, {
      p_theme_id: draft.id || null,
      p_data: {name:draft.name,title:draft.title,subtitle:draft.subtitle,primaryColor:draft.primaryColor,
        secondaryColor:draft.secondaryColor,backgroundColor:draft.backgroundColor,
        surfaceColor:draft.surfaceColor,logoPrimary:draft.logoPrimary,logoSecondary:draft.logoSecondary},
    } as never)
    setBusy(false)
    if(error || !data) { notify(error?.message ?? 'Erro ao salvar tema.','error'); return }
    const saved = normalizeQuizTheme(data)
    await load()
    setSelected(saved.id)
    setDraft(saved)
    notify('Tema salvo. Para utilizá-lo, clique em Aplicar tema.')
  }

  const activate = async () => {
    if (!selected || selected!==draft.id) { notify('Salve ou selecione um tema antes de aplicar.','error'); return }
    setBusy(true)
    const {error} = await supabase.rpc('presenter_select_visual_theme' as never,{p_theme_id:selected} as never)
    setBusy(false)
    if (error) { notify(error.message,'error'); return }
    setActiveId(selected)
    notify('Tema aplicado à próxima dinâmica.')
  }

  const remove = async () => {
    if (!selected || selected===activeId || themes.find(t=>t.id===selected)?.isSystem) return
    if (!window.confirm('Excluir este tema salvo?')) return
    setBusy(true)
    const {error} = await supabase.rpc('presenter_delete_visual_theme' as never,{p_theme_id:selected} as never)
    setBusy(false)
    if(error) { notify(error.message,'error'); return }
    setSelected(activeId)
    await load()
    notify('Tema excluído.')
  }

  const upload = async (file:File|undefined,field:'logoPrimary'|'logoSecondary') => {
    if(!file) return
    try { change({[field]:await logoFromFile(file)}) }
    catch(e) { notify(e instanceof Error ? e.message : 'Imagem inválida.','error') }
  }
  if(loading) return <div className="p-8 text-white/60">Carregando temas salvos…</div>
  return <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)] sm:p-6">
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
        <div className="mb-2 text-sm font-bold">Temas salvos</div>
        <select value={selected} onChange={e=>setSelected(e.target.value)} className="h-11 w-full rounded-xl border border-white/15 bg-[#071936] px-3 text-sm text-white">
          <option value="" disabled>Unsaved theme</option>
          {themes.map(t=><option key={t.id} value={t.id}>{t.name}{t.id===activeId?' · Em uso':''}{t.isSystem?' · Padrão':''}</option>)}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={duplicate} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold">+ Novo a partir deste</button>
          <button type="button" disabled={busy || !selected || selected===activeId || themes.find(t=>t.id===selected)?.isSystem} onClick={()=>void remove()} className="rounded-lg border border-red-400/25 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-40">Excluir</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do tema" value={draft.name} onChange={v=>change({name:v})} />
        <Field label="Título do evento" value={draft.title} onChange={v=>change({title:v})} />
        <div className="sm:col-span-2"><Field label="Subtítulo (opcional)" value={draft.subtitle} onChange={v=>change({subtitle:v})}/></div>
        {([
          ['primaryColor','Cor principal'],
          ['secondaryColor','Cor secundária'],
          ['backgroundColor','Fundo'],
          ['surfaceColor','Superfície dos painéis'],
        ] as const).map(([key,label])=><label key={key} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3 text-xs font-semibold text-white/75">{label}<span className="flex items-center gap-2"><span className="font-mono text-white/45">{draft[key]}</span><input aria-label={label} type="color" value={draft[key]} onChange={e=>change({[key]:e.target.value})} className="h-8 w-10 cursor-pointer"/></span></label>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['logoPrimary','logoSecondary'] as const).map((key,i)=><div key={key} className="rounded-xl border border-white/10 p-3">
          <div className="text-xs font-bold">{i===0?'Logo principal':'Logo secundária'}</div>
          <div className="mt-3 flex h-14 items-center justify-center rounded-lg bg-white/5">{draft[key]?<img src={draft[key]!} alt="" className="max-h-12 max-w-full object-contain"/>:<span className="text-xs text-white/35">Sem logo</span>}</div>
          <div className="mt-3 flex gap-2"><label className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-xs">Enviar imagem<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void upload(e.target.files?.[0],key)}/></label><button type="button" onClick={()=>change({[key]:null})} className="text-xs text-white/55">Ocultar</button></div>
        </div>)}
      </div>
      {themes.find(t=>t.id===draft.id)?.isSystem&&<p className="text-xs text-white/45">O tema padrão é protegido. Clique em “Novo a partir deste” para personalizar.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>void save()} disabled={busy || themes.find(t=>t.id===draft.id)?.isSystem} className="rounded-xl bg-[#a7d52c] px-5 py-3 text-sm font-extrabold text-[#061428] disabled:opacity-40">{busy?'Salvando…':'Salvar tema'}</button>
        <button type="button" onClick={()=>void activate()} disabled={busy || !selected || selected!==draft.id} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold disabled:opacity-40">Aplicar tema</button>
      </div>
    </div>
    <div className="space-y-3"><h3 className="text-sm font-bold">Prévia do tema</h3>
      <div style={themeStyle(draft)} className="overflow-hidden rounded-[24px] border border-white/15 bg-[var(--quiz-bg)] p-5 text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-4"><div className="min-w-0"><div className="break-words text-xl font-extrabold text-[var(--quiz-primary)]">{draft.title}</div><div className="mt-1 text-xs text-white/55">{draft.subtitle}</div></div><div className="flex shrink-0 gap-2">{[draft.logoPrimary,draft.logoSecondary].filter(Boolean).map((logo,i)=><img key={i} src={logo!} alt="" className="h-8 max-w-14 object-contain"/>)}</div></div>
        <div className="mt-5 rounded-2xl bg-[var(--quiz-surface)] p-5"><div className="text-xs font-semibold text-[var(--quiz-secondary)]">QUIZ AO VIVO</div><div className="mt-3 text-xl font-bold">Qual alternativa você escolheria?</div><div className="mt-5 space-y-2"><div className="rounded-xl border border-[var(--quiz-primary)] bg-white/5 p-3 text-sm"><span className="mr-2 font-bold text-[var(--quiz-primary)]">A</span> Primeira alternativa</div><div className="rounded-xl border border-white/15 p-3 text-sm"><span className="mr-2 font-bold text-[var(--quiz-secondary)]">B</span> Segunda alternativa</div></div></div>
      </div>
      <p className="text-xs leading-relaxed text-white/45">O tema escolhido é copiado para cada nova dinâmica. Temas antigos não mudam ao editar este cadastro.</p>
    </div>
  </div>
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/65">{label}</span><input maxLength={150} value={value} onChange={e=>onChange(e.target.value)} className="h-11 w-full rounded-xl border border-white/15 bg-[#020d23] px-3 text-sm outline-none focus:border-[#a7d52c]" /></label>
}
