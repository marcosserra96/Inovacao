import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export class ParticipantErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Participant mobile render error', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="relative grid h-[100dvh] min-h-[100dvh] place-items-center overflow-hidden bg-[#020d23] px-6 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(23,77,145,.24),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
        <div className="relative w-full max-w-sm text-center">
          <div className="mx-auto inline-flex rounded-full border border-[#00b6da]/25 bg-[#00b6da]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#5ddcf2]">Rota de Inovação</div>
          <h1 className="mt-5 font-display text-[34px] font-extrabold tracking-[-.045em]">Vamos reconectar</h1>
          <p className="mt-4 text-sm leading-6 text-white/60">A tela encontrou uma falha de sincronização. Toque abaixo para continuar na mesma dinâmica.</p>
          <button onClick={() => window.location.reload()} className="mt-6 w-full rounded-2xl bg-[#a7d52c] px-5 py-4 font-display text-sm font-extrabold text-[#07152f]">Recarregar dinâmica</button>
        </div>
      </main>
    )
  }
}
