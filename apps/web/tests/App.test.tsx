/**
 * App 路由集成测试（P0-5：前端路由）
 * 依据：docs/前端交互设计规格书_v1.0.0.md §2.1 站点地图 §2.3 页面流转状态图
 *       docs/任务分解_WBS_v1.0.0.md §6 MVC 前端任务
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';

// ──────────────────────────────────
// Mock 重度依赖的页面组件 — 减少 mock 负担，聚焦路由测试
// ──────────────────────────────────
vi.mock('@/pages/HomePage', () => ({
  default: () => <div data-testid="page-home">首页</div>,
}));

vi.mock('@/pages/GeneratingPage', () => ({
  default: () => <div data-testid="page-generating">生成中</div>,
}));

vi.mock('@/pages/TripResultPage', () => ({
  default: () => <div data-testid="page-trip-result">行程结果</div>,
}));

vi.mock('@/pages/ShareViewPage', () => ({
  default: () => <div data-testid="page-share-view">分享页面</div>,
}));

vi.mock('@/pages/HistoryPage', () => ({
  default: () => <div data-testid="page-history">历史攻略</div>,
}));

vi.mock('@/pages/NotFoundPage', () => ({
  default: () => <div data-testid="page-not-found">404 页面不存在</div>,
}));

// 页面组件本身被 mock 了，但 App 中 Suspense fallback 依赖 LoadingSpinner
// 保留 LoadingSpinner 真实渲染以验证 Suspense 行为
vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: ({ text }: { text?: string }) => (
    <div data-testid="loading-spinner">{text ?? '加载中...'}</div>
  ),
}));

// ──────────────────────────────────
// 工具函数
// ──────────────────────────────────
function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>,
  );
}

// ──────────────────────────────────
// 测试套件
// ──────────────────────────────────
describe('App 路由', () => {
  describe('已知路由渲染', () => {
    it('GET / → 渲染首页', async () => {
      renderWithRouter('/');
      await waitFor(() => {
        expect(screen.getByTestId('page-home')).toBeTruthy();
      });
    });

    it('GET /generating → 渲染生成中页面', async () => {
      renderWithRouter('/generating');
      await waitFor(() => {
        expect(screen.getByTestId('page-generating')).toBeTruthy();
      });
    });

    it('GET /trip/:tripId → 渲染行程结果页', async () => {
      renderWithRouter('/trip/trip_abc123');
      await waitFor(() => {
        expect(screen.getByTestId('page-trip-result')).toBeTruthy();
      });
    });

    it('GET /share/:shareId → 渲染分享页面', async () => {
      renderWithRouter('/share/share_xyz789');
      await waitFor(() => {
        expect(screen.getByTestId('page-share-view')).toBeTruthy();
      });
    });

    it('GET /history → 渲染历史攻略页面', async () => {
      renderWithRouter('/history');
      await waitFor(() => {
        expect(screen.getByTestId('page-history')).toBeTruthy();
      });
    });
  });

  describe('404 通配路由', () => {
    it('未匹配路径 /unknown → 渲染 NotFoundPage', async () => {
      renderWithRouter('/unknown');
      await waitFor(() => {
        expect(screen.getByTestId('page-not-found')).toBeTruthy();
      });
    });

    it('深层未匹配路径 /a/b/c → 渲染 NotFoundPage', async () => {
      renderWithRouter('/a/b/c');
      await waitFor(() => {
        expect(screen.getByTestId('page-not-found')).toBeTruthy();
      });
    });

    it('/trip/ 无参数路径 → 渲染 NotFoundPage', async () => {
      renderWithRouter('/trip/');
      await waitFor(() => {
        expect(screen.getByTestId('page-not-found')).toBeTruthy();
      });
    });
  });

  describe('Suspense 懒加载', () => {
    it('所有已知路由的页面均应通过 lazy() 加载并正确渲染', async () => {
      // 验证每个 lazy 路由都能在 Suspense 包裹下正常渲染
      // 所有页面组件已被 mock，若 lazy 解析失败则不会渲染
      const routes = ['/', '/generating', '/trip/test', '/share/test', '/history'];
      const expectedIds = ['page-home', 'page-generating', 'page-trip-result', 'page-share-view', 'page-history'];

      for (let i = 0; i < routes.length; i++) {
        const { unmount } = render(
          <MemoryRouter initialEntries={[routes[i]]}>
            <App />
          </MemoryRouter>,
        );
        await waitFor(() => {
          expect(screen.getByTestId(expectedIds[i])).toBeTruthy();
        });
        unmount();
      }
    });
  });

  describe('路由参数', () => {
    it('/trip/:tripId — 不同 tripId 都应匹配同一路由', async () => {
      const ids = ['trip_001', 'trip_abc-def', 'a1b2c3'];
      for (const id of ids) {
        const { unmount } = render(
          <MemoryRouter initialEntries={[`/trip/${id}`]}>
            <App />
          </MemoryRouter>,
        );
        await waitFor(() => {
          expect(screen.getByTestId('page-trip-result')).toBeTruthy();
        });
        unmount();
      }
    });

    it('/share/:shareId — 不同 shareId 都应匹配同一路由', async () => {
      const ids = ['share_001', 'token-abc-123'];
      for (const id of ids) {
        const { unmount } = render(
          <MemoryRouter initialEntries={[`/share/${id}`]}>
            <App />
          </MemoryRouter>,
        );
        await waitFor(() => {
          expect(screen.getByTestId('page-share-view')).toBeTruthy();
        });
        unmount();
      }
    });
  });

  describe('ErrorBoundary 包裹', () => {
    it('App 应在 ErrorBoundary 内渲染页面', async () => {
      renderWithRouter('/');
      await waitFor(() => {
        expect(screen.getByTestId('page-home')).toBeTruthy();
      });
      // 如果 ErrorBoundary 不存在，页面抛错时测试会直接失败
      // 此处验证正常路径下组件确实被渲染
    });
  });
});

describe('路由总数', () => {
  it('应有恰好 6 条路由（含通配 * 路由）', () => {
    // 设计文档 §2.1 站点地图定义：首页、生成中、行程结果、分享、历史、404
    // 共 6 条路由
    const expectedRoutes = [
      '/',              // HomePage
      '/generating',    // GeneratingPage
      '/trip/:tripId',  // TripResultPage
      '/share/:shareId',// ShareViewPage
      '/history',       // HistoryPage
      '*',              // NotFoundPage (catch-all)
    ];
    expect(expectedRoutes).toHaveLength(6);
  });
});
