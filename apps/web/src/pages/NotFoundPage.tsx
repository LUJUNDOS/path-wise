import { useNavigate } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 404 未找到页面
 * 当用户访问不存在的路由时显示
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
      <SearchX className="h-16 w-16 text-muted-foreground/40" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">页面不存在</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          您访问的页面不存在或已被移除，请检查链接是否正确。
        </p>
      </div>
      <Button onClick={() => navigate('/')} variant="default">
        返回首页
      </Button>
    </div>
  );
}
