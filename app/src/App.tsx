import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { OpenQuizParticipantPage } from '@/routes/openquiz/OpenQuizParticipantPage'
import { OpenQuizPlayPage } from '@/routes/openquiz/OpenQuizPlayPage'
import { OpenQuizScreenPage } from '@/routes/openquiz/OpenQuizScreenPage'
import { OpenQuizAdminPage } from '@/routes/openquiz/OpenQuizAdminPage'
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
        <Route path="/" element={<OpenQuizParticipantPage />} />
        <Route path="/participar" element={<OpenQuizParticipantPage />} />
        <Route path="/quiz/:sessionId/jogar" element={<OpenQuizPlayPage />} />
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
