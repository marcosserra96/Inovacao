import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Database } from '@/types/database.types'

type EventSettings = Database['public']['Tables']['event_settings']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

export function AdminSettingsPage() {
  const notify = useToast()
  const { setTheme } = useTheme()
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [configs, setConfigs] = useState<ScoringConfig[]>([])
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null)

  async function load() {
    const [{ data: s, error: sErr }, { data: c, error: cErr }] = await Promise.all([
      supabase.from('event_settings').select('*').single(),
      supabase.from('scoring_configs').select('*').order('created_at'),
    ])
    if (sErr) notify(sErr.message, 'error')
    if (cErr) notify(cErr.message, 'error')
    setSettings(s)
    setConfigs(c ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSaveSettings() {
    if (!settings) return
    setSavingSettings(true)
    const { error } = await supabase
      .from('event_settings')
      .update({
        event_name: settings.event_name,
        dynamic_name: settings.dynamic_name,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        accent_color: settings.accent_color,
        logo_url: settings.logo_url,
        background_url: settings.background_url,
        welcome_message: settings.welcome_message,
        result_message: settings.result_message,
      })
      .eq('id', true)
    setSavingSettings(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    setTheme({
      eventName: settings.event_name,
      dynamicName: settings.dynamic_name,
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      accentColor: settings.accent_color,
      logoUrl: settings.logo_url,
      backgroundUrl: settings.background_url,
      welcomeMessage: settings.welcome_message,
      resultMessage: settings.result_message,
    })
    notify('Identidade visual atualizada.')
  }

  async function handleSaveConfig(config: ScoringConfig) {
    setSavingConfigId(config.id)
    const { error } = await supabase
      .from('scoring_configs')
      .update({
        name: config.name,
        speed_bonus_max: config.speed_bonus_max,
        enable_streak_bonus: config.enable_streak_bonus,
        streak_bonus: config.streak_bonus,
        streak_bonus_cap: config.streak_bonus_cap,
        enable_penalty: config.enable_penalty,
        penalty_wrong: config.penalty_wrong,
      })
      .eq('id', config.id)
    setSavingConfigId(null)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Fórmula de pontuação atualizada.')
  }

  function updateConfigField<K extends keyof ScoringConfig>(id: string, key: K, value: ScoringConfig[K]) {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
  }

  async function handleCreateConfig() {
    const { data, error } = await supabase.from('scoring_configs').insert({ name: 'Nova configuração' }).select('*').single()
    if (error || !data) {
      notify(error?.message ?? 'Erro ao criar configuração', 'error')
      return
    }
    setConfigs((prev) => [...prev, data])
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Configurações</h1>
      <p className="text-ink-muted mb-6">Identidade visual do evento e fórmula de pontuação.</p>

      {settings && (
        <Card className="mb-6">
          <h2 className="font-display text-lg font-bold mb-4">Identidade visual</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Nome do evento" htmlFor="eventName">
              <Input
                id="eventName"
                value={settings.event_name}
                onChange={(e) => setSettings({ ...settings, event_name: e.target.value })}
              />
            </Field>
            <Field label="Nome da dinâmica" htmlFor="dynamicName">
              <Input
                id="dynamicName"
                value={settings.dynamic_name}
                onChange={(e) => setSettings({ ...settings, dynamic_name: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Field label="Cor primária" htmlFor="primaryColor">
              <Input
                id="primaryColor"
                type="color"
                className="h-11"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
              />
            </Field>
            <Field label="Cor secundária" htmlFor="secondaryColor">
              <Input
                id="secondaryColor"
                type="color"
                className="h-11"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
              />
            </Field>
            <Field label="Cor de destaque" htmlFor="accentColor">
              <Input
                id="accentColor"
                type="color"
                className="h-11"
                value={settings.accent_color}
                onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="URL do logotipo" htmlFor="logoUrl">
              <Input
                id="logoUrl"
                value={settings.logo_url ?? ''}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value || null })}
                placeholder="https://…"
              />
            </Field>
            <Field label="URL da imagem de fundo" htmlFor="backgroundUrl">
              <Input
                id="backgroundUrl"
                value={settings.background_url ?? ''}
                onChange={(e) => setSettings({ ...settings, background_url: e.target.value || null })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Mensagem de boas-vindas" htmlFor="welcomeMessage">
              <Textarea
                id="welcomeMessage"
                rows={2}
                value={settings.welcome_message}
                onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
              />
            </Field>
            <Field label="Mensagem de resultado" htmlFor="resultMessage">
              <Textarea
                id="resultMessage"
                rows={2}
                value={settings.result_message}
                onChange={(e) => setSettings({ ...settings, result_message: e.target.value })}
              />
            </Field>
          </div>
          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? 'Salvando…' : 'Salvar identidade visual'}
          </Button>
        </Card>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold">Fórmulas de pontuação</h2>
        <Button variant="ghost" size="md" onClick={handleCreateConfig}>
          + Nova configuração
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {configs.map((config) => (
          <Card key={config.id}>
            <div className="flex items-center justify-between mb-4">
              <Input
                className="max-w-xs font-medium"
                value={config.name}
                onChange={(e) => updateConfigField(config.id, 'name', e.target.value)}
              />
              {config.is_default && <span className="text-xs font-medium text-primary">Padrão</span>}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Bônus máximo de velocidade (pontos)" htmlFor={`speed-${config.id}`}>
                <Input
                  id={`speed-${config.id}`}
                  type="number"
                  min={0}
                  value={config.speed_bonus_max}
                  onChange={(e) => updateConfigField(config.id, 'speed_bonus_max', Number(e.target.value))}
                />
              </Field>
              <div className="flex items-end pb-2.5">
                <Switch
                  checked={config.enable_streak_bonus}
                  onChange={(v) => updateConfigField(config.id, 'enable_streak_bonus', v)}
                  label="Bônus por sequência de acertos"
                />
              </div>
            </div>
            {config.enable_streak_bonus && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Pontos por acerto consecutivo" htmlFor={`streak-${config.id}`}>
                  <Input
                    id={`streak-${config.id}`}
                    type="number"
                    min={0}
                    value={config.streak_bonus}
                    onChange={(e) => updateConfigField(config.id, 'streak_bonus', Number(e.target.value))}
                  />
                </Field>
                <Field label="Limite máximo da sequência" htmlFor={`streakcap-${config.id}`}>
                  <Input
                    id={`streakcap-${config.id}`}
                    type="number"
                    min={0}
                    value={config.streak_bonus_cap}
                    onChange={(e) => updateConfigField(config.id, 'streak_bonus_cap', Number(e.target.value))}
                  />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-end pb-2.5">
                <Switch
                  checked={config.enable_penalty}
                  onChange={(v) => updateConfigField(config.id, 'enable_penalty', v)}
                  label="Penalidade por resposta errada"
                />
              </div>
              {config.enable_penalty && (
                <Field label="Pontos perdidos por erro" htmlFor={`penalty-${config.id}`}>
                  <Input
                    id={`penalty-${config.id}`}
                    type="number"
                    min={0}
                    value={config.penalty_wrong}
                    onChange={(e) => updateConfigField(config.id, 'penalty_wrong', Number(e.target.value))}
                  />
                </Field>
              )}
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Critérios de desempate (fixos): pontuação → nº de acertos → tempo total → horário de conclusão.
            </p>
            <Button size="md" onClick={() => handleSaveConfig(config)} disabled={savingConfigId === config.id}>
              {savingConfigId === config.id ? 'Salvando…' : 'Salvar'}
            </Button>
          </Card>
        ))}
      </div>
    </AdminShell>
  )
}
