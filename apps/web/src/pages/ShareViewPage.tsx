import { useParams, useNavigate } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

/**
 * 分享查看页面（阶段二完整实现）
 * 当前为 P0 路由占位，完整实现在阶段二（P1/P2 FE-020）
 *
 * 依据：docs/API接口设计规格书_v1.0.0.md §7.7 GET /share/{shareId}
 * 依据：docs/前端交互设计规格书_v1.0.0.md §3.8 分享与导出交互
 */
export default function ShareViewPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <EmptyState
        icon={<Share2 className="h-12 w-12 text-muted-foreground/50" />}
        title="分享页面"
        description={`分享链接 ${shareId ? `(${shareId})` : ''} 即将推出，阶段二完整实现分享与协作修改功能。`}
        action={
          <Button variant="outline" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  );
}
