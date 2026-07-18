import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { LoadingState } from '../components/feedback/LoadingState'
import { SessionProvider } from '../session/SessionContext'

const HomePage = lazy(() => import('../pages/HomePage'))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('../pages/ProjectDetailPage'))
const NewSimulationPage = lazy(() => import('../pages/NewSimulationPage'))
const JobsPage = lazy(() => import('../pages/JobsPage'))
const JobDetailPage = lazy(() => import('../pages/JobDetailPage'))
const ResultsIndexPage = lazy(() => import('../pages/ResultsIndexPage'))
const ResultDetailPage = lazy(() => import('../pages/ResultDetailPage'))
const ResourcesPage = lazy(() => import('../pages/ResourcesPage'))
const ModelsPage = lazy(() => import('../pages/ModelsPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppLayout>
          <Suspense fallback={<LoadingState label="Cargando vista…" />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/simulations/new" element={<NewSimulationPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:jobId" element={<JobDetailPage />} />
              <Route path="/results" element={<ResultsIndexPage />} />
              <Route path="/results/:simulationId" element={<ResultDetailPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </SessionProvider>
    </BrowserRouter>
  )
}
