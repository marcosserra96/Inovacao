import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { OpenQuizEntryPage } from '@/routes/openquiz/OpenQuizEntryPage'
import { OpenQuizScreenPage } from '@/routes/openquiz/OpenQuizScreenPage'
import { OpenQuizAdminPage } from '@/routes/openquiz/OpenQuizAdminPage'
import { JoinIndividualPage } from '@/routes/individual/JoinIndividualPage'
import { IndividualPlayPage } from '@/routes/individual/IndividualPlayPage'
import { IndividualResultPage } from '@/routes/individual/IndividualResultPage'
import { RankingPage } from '@/routes/ranking/RankingPage'
import { AdminLoginPage } from '@/routes/admin/AdminLoginPage'
import { AdminQuestionsPage } from '@/routes/admin/AdminQuestionsPage'
import { AdminCategoriesPage } from '@/routes/admin/AdminCategoriesPage'
import { AdminSetsPage } from '@/routes/admin/AdminSetsPage'
import { AdminSettingsPage } from '@/routes/admin/AdminSettingsPage'
import { ProtectedRoute } from '@/components/admin/ProtectedRoute'
import { ConfigWarningBanner } from '@/components/ConfigWarningBanner'
import { NotFoundPage } from '@/routes/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <ConfigWarningBanner />
      <Routes>
        <Route path="/" element={<OpenQuizEntryPage />} />
        <Route path="/participar" element={<OpenQuizEntryPage />} />
        <Route path="/j/:codigo" element={<JoinIndividualPage />} />
        <Route path="/individual/:sessionId/play" element={<IndividualPlayPage />} />
        <Route path="/individual/:sessionId/resultado" element={<IndividualResultPage />} />
        <Route path="/ranking/:sessionId" element={<RankingPage />} />

        <Route path="/telao" element={<OpenQuizScreenPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><OpenQuizAdminPage /></ProtectedRoute>} />
        <Route path="/admin/perguntas" element={<ProtectedRoute requireAdmin><AdminQuestionsPage /></ProtectedRoute>} />
        <Route path="/admin/categorias" element={<ProtectedRoute requireAdmin><AdminCategoriesPage /></ProtectedRoute>} />
        <Route path="/admin/conjuntos" element={<ProtectedRoute requireAdmin><AdminSetsPage /></ProtectedRoute>} />
        <Route path="/admin/configuracoes" element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
