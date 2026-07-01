import { cn } from '@/lib/utils';
import { MapPin, Building2, ExternalLink, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { AccommodationOption } from '@path-wise/shared';

export interface AccommodationCardProps {
  accommodation: AccommodationOption;
  className?: string;
}

/**
 * 校验 URL 协议仅限于 http/https，防止 XSS via javascript: 等危险协议
 */
function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
    return undefined;
  } catch {
    return undefined;
  }
}

export function AccommodationCard({ accommodation, className }: AccommodationCardProps) {
  const { checkInDate, checkOutDate, nights } = accommodation;
  const checkIn = checkInDate
    ? new Date(checkInDate + 'T00:00:00').toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
      })
    : '';
  const checkOut = checkOutDate
    ? new Date(checkOutDate + 'T00:00:00').toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <Building2 className="h-4 w-4" /> 住宿推荐
      </h4>
      {(['primary', 'backup'] as const).map((tier) => {
        const hotel = accommodation[tier];
        if (!hotel || !hotel.name) return null;
        const label = tier === 'primary' ? '主选' : '备选';

        const safeBookingUrl = sanitizeUrl(hotel.bookingUrl);

        return (
          <Card key={tier} className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">
                    <Badge
                      variant={tier === 'primary' ? 'default' : 'secondary'}
                      className="mr-1.5 text-xs"
                    >
                      {label}
                    </Badge>
                    {hotel.name}
                  </div>
                  {hotel.address && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hotel.address}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(hotel.pricePerNight)}/晚</p>
                  {hotel.totalPrice > 0 && (
                    <p className="text-xs text-muted-foreground">
                      共 {nights} 晚 · {formatCurrency(hotel.totalPrice)}
                    </p>
                  )}
                </div>
              </div>

              {/* Check-in / Check-out dates */}
              {checkIn && checkOut && (
                <p className="text-xs text-muted-foreground">
                  入住：{checkIn} → 退房：{checkOut}（{nights} 晚）
                </p>
              )}

              {/* Amenities */}
              {hotel.amenities && hotel.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {hotel.amenities.map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Reason */}
              {hotel.reason && <p className="text-xs text-muted-foreground">{hotel.reason}</p>}

              {/* ── Action buttons ── */}
              <div className="flex items-center gap-2 flex-wrap">
                {hotel.location && (
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" asChild>
                    <a
                      href={`https://uri.amap.com/marker?position=${hotel.location.lng},${hotel.location.lat}&name=${encodeURIComponent(hotel.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      查看在地图上的位置
                    </a>
                  </Button>
                )}
                {safeBookingUrl && (
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" asChild>
                    <a href={safeBookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      预约/查看价格
                    </a>
                  </Button>
                )}
                {!hotel.location && !safeBookingUrl && (
                  <span className="text-xs text-muted-foreground">暂无预订入口，建议自行搜索</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
