import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { JoinIndividualPage } from '@/routes/individual/JoinIndividualPage'
import { IndividualPlayPage } from '@/routes/individual/IndividualPlayPage'
import { IndividualResultPage } from '@/routes/individual/IndividualResultPage'
import { RankingPage } from '@/routes/ranking/RankingPage'
import { DuelJoinPage } from '@/routes/duel/DuelJoinPage'
import { DuelPlayerPage } from '@/routes/duel/DuelPlayerPage'
import { ScreenPage } from '@/routes/screen/ScreenPage'
import { ScreenVisualPreviewPage } from '@/routes/screen/ScreenVisualPreviewPage'
import { ScreenLiveVisualPage } from '@/routes/screen/ScreenLiveVisualPage'
import { PresenterNewMatchPage } from '@/routes/presenter/PresenterNewMatchPage'
import { PresenterPage } from '@/routes/presenter/PresenterPage'
import { PresenterFlowPreviewPage } from '@/routes/presenter/PresenterFlowPreviewPage'
import { LiveQuizPlayerPage } from '@/routes/livequiz/LiveQuizPlayerPage'
import { ParticipantVisualPreviewPage } from '@/routes/livequiz/ParticipantVisualPreviewPage'
import { ParticipantJoinVisualPage } from '@/routes/livequiz/ParticipantJoinVisualPage'
import { ParticipantLiveVisualPage } from '@/routes/livequiz/ParticipantLiveVisualPage'
import { LiveQuizScreenPage } from '@/routes/livequiz/LiveQuizScreenPage'
import { LiveQuizPresenterPage } from '@/routes/livequiz/LiveQuizPresenterPage'
import { LiveQuizSemifinalsPresenterPage } from '@/routes/livequiz/LiveQuizSemifinalsPresenterPage'
import { LiveQuizSemifinalsScreenPage } from '@/routes/livequiz/LiveQuizSemifinalsScreenPage'
import { AdminLoginPage } from '@/routes/admin/AdminLoginPage'
import { AdminDashboardPage } from '@/routes/admin/AdminDashboardPage'
import { AdminGameControlPage } from '@/routes/admin/AdminGameControlPage'
import { AdminLiveQuizConfigPage } from '@/routes/admin/AdminLiveQuizConfigPage'
import { AdminMaintenancePage } from '@/routes/admin/AdminMaintenancePage'
import { AdminQuestionsPage } from '@/routes/admin/AdminQuestionsPage'
import { AdminCategoriesPage } from '@/routes/admin/AdminCategoriesPage'
import { AdminSetsPage } from '@/routes/admin/AdminSetsPage'
import { AdminSessionsPage } from '@/routes/admin/AdminSessionsPage'
import { AdminResultsPage } from '@/routes/admin/AdminResultsPage'
import { AdminSettingsPage } from '@/routes/admin/AdminSettingsPage'
import { AdminUsersPage } from '@/routes/admin/AdminUsersPage'
import { NotFoundPage } from '@/routes/NotFoundPage'
import { ProtectedRoute } from '@/components/admin/ProtectedRoute'
import { ConfigWarningBanner } from '@/components/ConfigWarningBanner'

function App() {
  return (
    <BrowserRouter>
      <ConfigWarningBanner />
      <Routes>
        {/* A experiência nova é a página inicial oficial */}
        <Route path="/" element={<PresenterFlowPreviewPage />} />

        {/* Nova experiência visual / funcional — sem login */}
        <Route path="/telao-visual" element={<ScreenVisualPreviewPage />} />
        <Route path="/telao-dinamica/:sessionId" element={<ScreenLiveVisualPage />} />
        <Route path="/participante-visual" element={<ParticipantVisualPreviewPage />} />
        <Route path="/participar/:codigo" element={<ParticipantJoinVisualPage />} />
        <Route path="/participante/:sessionId/:participantId" element={<ParticipantLiveVisualPage />} />
        <Route path="/apresentador-visual" element={<PresenterFlowPreviewPage />} />

        {/* QRs antigos também entram pela nova experiência mobile */}
        <Route path="/quiz/entrar/:codigo" element={<ParticipantJoinVisualPage />} />
        <Route path="/quiz/:sessionId/jogar/:participantId" element={<LiveQuizPlayerPage />} />
        <Route path="/telao-quiz/:sessionId" element={<LiveQuizScreenPage />} />
        <Route path="/apresentador-quiz/:sessionId" element={<ProtectedRoute><LiveQuizPresenterPage /></ProtectedRoute>} />
        <Route path="/telao-semifinais/:sessionId" element={<LiveQuizSemifinalsScreenPage />} />
        <Route path="/apresentador-semifinais/:sessionId" element={<ProtectedRoute><LiveQuizSemifinalsPresenterPage /></ProtectedRoute>} />

        {/* Desafio individual */}
        <Route path="/j/:codigo" element={<JoinIndividualPage />} />
        <Route path="/individual/:sessionId/play" element={<IndividualPlayPage />} />
        <Route path="/individual/:sessionId/resultado" element={<IndividualResultPage />} />
        <Route path="/ranking/:sessionId" element={<RankingPage />} />

        {/* Duelo legado */}
        <Route path="/duelo/entrar/:codigo" element={<DuelJoinPage />} />
        <Route path="/duelo/:matchId/jogar/:playerId" element={<DuelPlayerPage />} />
        <Route path="/telao/:matchId" element={<ScreenPage />} />
        <Route path="/apresentador/nova" element={<ProtectedRoute><PresenterNewMatchPage /></ProtectedRoute>} />
        <Route path="/apresentador/:matchId" element={<ProtectedRoute><PresenterPage /></ProtectedRoute>} />

        {/* Administrativo — continua protegido */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/jogo" element={<ProtectedRoute><AdminGameControlPage /></ProtectedRoute>} />
        <Route path="/admin/jogo/perguntas" element={<ProtectedRoute requireAdmin><AdminLiveQuizConfigPage /></ProtectedRoute>} />
        <Route path="/admin/manutencao" element={<ProtectedRoute requireAdmin><AdminMaintenancePage /></ProtectedRoute>} />
        <Route path="/admin/perguntas" element={<ProtectedRoute requireAdmin><AdminQuestionsPage /></ProtectedRoute>} />
        <Route path="/admin/categorias" element={<ProtectedRoute requireAdmin><AdminCategoriesPage /></ProtectedRoute>} />
        <Route path="/admin/conjuntos" element={<ProtectedRoute requireAdmin><AdminSetsPage /></ProtectedRoute>} />
        <Route path="/admin/sessoes" element={<ProtectedRoute><AdminSessionsPage /></ProtectedRoute>} />
        <Route path="/admin/resultados/:sessionId" element={<ProtectedRoute><AdminResultsPage /></ProtectedRoute>} />
        <Route path="/admin/configuracoes" element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/usuarios" element={<ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
