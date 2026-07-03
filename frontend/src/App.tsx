import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Documentation from './pages/Documentation';
import VideoLibrary from './pages/VideoLibrary';
import CrawlJobs from './pages/CrawlJobs';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path='/' element={<Layout />}>
        <Route index element={<Navigate to='/dashboard' replace />} />
        <Route path='dashboard' element={<Dashboard />} />
        <Route path='projects' element={<Projects />} />
        <Route path='projects/:id' element={<ProjectDetail />} />
        <Route path='documentation' element={<Documentation />} />
        <Route path='videos' element={<VideoLibrary />} />
        <Route path='jobs' element={<CrawlJobs />} />
        <Route path='analytics' element={<Analytics />} />
        <Route path='settings' element={<Settings />} />
      </Route>
    </Routes>
  );
}
