import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

/**
 * 历史攻略页面（阶段二完整实现）
 * 当前为 P0 路由占位，完整实现在阶段二（个人中心）
 *
 * 依据：docs/前端交互设计规格书_v1.0.0.md §2.1 站点地图 §6 个人中心
 * 引用：HomePage.tsx L121 navigate('/history')
 */
export default function HistoryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <EmptyState
        icon={<Clock className="h-12 w-12 text-muted-foreground/50" />}
        title="我的攻略"
        description="历史攻略列表即将推出，阶段二将实现完整个人中心功能。"
        action={
          <Button variant="outline" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  );
}
