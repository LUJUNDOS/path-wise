import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage'));
const GeneratingPage = lazy(() => import('@/pages/GeneratingPage'));
const TripResultPage = lazy(() => import('@/pages/TripResultPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ShareViewPage = lazy(() => import('@/pages/ShareViewPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LoadingSpinner size="lg" text="加载中..." />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/generating" element={<GeneratingPage />} />
          <Route path="/trip/:tripId" element={<TripResultPage />} />
          <Route path="/share/:shareId" element={<ShareViewPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
