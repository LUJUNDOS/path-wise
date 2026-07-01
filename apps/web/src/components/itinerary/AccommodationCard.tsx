import { cn } from '@/lib/utils';
import { MapPin, Building2, ExternalLink, Navigation, Star, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { AccommodationOption, HotelOption } from '@path-wise/shared';

export interface AccommodationCardProps {
  accommodation: AccommodationOption;
  /** 城市名称，用于标题展示（如 "长沙 · 入住 3 晚"） */
  cityName?: string;
  className?: string;
}

// ---- Helpers ----

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

/** 渲染星级评分（如 ★ 4.5） */
function StarRating({ rating }: { rating: number }) {
  if (rating <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-medium">
      <Star className="h-3 w-3 fill-current" />
      {rating.toFixed(1)}
    </span>
  );
}

/** 渲染单个酒店方案卡片 */
function HotelOptionCard({
  hotel,
  tier,
  checkIn,
  checkOut,
  nights,
}: {
  hotel: HotelOption;
  tier: 'primary' | 'backup';
  checkIn: string;
  checkOut: string;
  nights: number;
}) {
  const label = tier === 'primary' ? '主选' : '备选';
  const safeBookingUrl = sanitizeUrl(hotel.bookingUrl);

  return (
    <Card
      className={cn(
        'border',
        tier === 'primary'
          ? 'border-blue-200 dark:border-blue-800/50'
          : 'border-dashed border-muted-foreground/30',
      )}
    >
      <CardContent className="pt-4 space-y-3">
        {/* ── Header row: name + tier badge + rating ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant={tier === 'primary' ? 'default' : 'secondary'}
                className="text-xs shrink-0"
              >
                {label}
              </Badge>
              <span className="text-sm font-medium truncate">{hotel.name}</span>
              {hotel.rating && <StarRating rating={hotel.rating} />}
            </div>
            {hotel.address && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{hotel.address}</span>
              </p>
            )}
          </div>
          {/* Price */}
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(hotel.pricePerNight)}
              <span className="text-xs font-normal text-muted-foreground">/晚</span>
            </p>
            {hotel.totalPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                {nights} 晚 · {formatCurrency(hotel.totalPrice)}
              </p>
            )}
          </div>
        </div>

        {/* ── Room type ── */}
        {hotel.roomType && <p className="text-xs text-muted-foreground">房型：{hotel.roomType}</p>}

        {/* ── Check-in / Check-out dates ── */}
        {checkIn && checkOut && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">入住</span> {checkIn}
            <span className="mx-1.5">→</span>
            <span className="font-medium text-foreground/70">退房</span> {checkOut}
            <span className="text-muted-foreground/60">（{nights} 晚）</span>
          </p>
        )}

        {/* ── Distance to attractions ── */}
        {hotel.distanceToAttractions && Object.keys(hotel.distanceToAttractions).length > 0 && (
          <div className="space-y-0.5">
            {Object.entries(hotel.distanceToAttractions).map(([attraction, distance]) => (
              <p key={attraction} className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                距{attraction}：{distance}
              </p>
            ))}
          </div>
        )}

        {/* ── Amenities ── */}
        {hotel.amenities && hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hotel.amenities.map((a) => (
              <Badge key={a} variant="outline" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        )}

        {/* ── Reason ── */}
        {hotel.reason && (
          <p className="text-xs text-muted-foreground leading-relaxed">{hotel.reason}</p>
        )}

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {hotel.location && hotel.location.lat && hotel.location.lng ? (
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
          ) : null}
          {safeBookingUrl ? (
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" asChild>
              <a href={safeBookingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                预约/查看价格
              </a>
            </Button>
          ) : null}
          {!hotel.location && !safeBookingUrl && (
            <span className="text-xs text-muted-foreground">暂无预订入口，建议自行搜索</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- AccommodationCard (main) ----

export function AccommodationCard({ accommodation, cityName, className }: AccommodationCardProps) {
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

  // Build section header: "住宿推荐（长沙 · 入住 3 晚）" or "住宿推荐（入住 3 晚）"
  const headerLabel = cityName
    ? `住宿推荐（${cityName} · 入住 ${nights} 晚）`
    : `住宿推荐（入住 ${nights} 晚）`;

  // Determine which tiers have valid hotels
  const hasPrimary = accommodation.primary && accommodation.primary.name;
  const hasBackup = accommodation.backup && accommodation.backup.name;

  // If neither tier has a hotel, show empty state
  if (!hasPrimary && !hasBackup) {
    return (
      <div className={cn('space-y-3', className)}>
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Building2 className="h-4 w-4" /> 住宿推荐
        </h4>
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground text-center">暂无住宿推荐信息</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Section header ── */}
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <Building2 className="h-4 w-4" />
        {headerLabel}
      </h4>

      {/* ── Hotel cards ── */}
      {hasPrimary && (
        <HotelOptionCard
          hotel={accommodation.primary}
          tier="primary"
          checkIn={checkIn}
          checkOut={checkOut}
          nights={nights}
        />
      )}

      {hasBackup && (
        <HotelOptionCard
          hotel={accommodation.backup}
          tier="backup"
          checkIn={checkIn}
          checkOut={checkOut}
          nights={nights}
        />
      )}

      {/* ── Disclaimer ── */}
      <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 px-3 py-2">
        <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
          <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
          酒店价格实时变动，以上价格仅供参考。建议通过携程/飞猪/美团等平台预订，以获得最优惠价格。
        </p>
      </div>
    </div>
  );
}
