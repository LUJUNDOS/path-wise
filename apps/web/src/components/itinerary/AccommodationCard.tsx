import { cn } from '@/lib/utils';
import { MapPin, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import type { AccommodationCardProps } from './DayPlanCard';

export function AccommodationCard({ accommodation, className }: AccommodationCardProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <Building2 className="h-4 w-4" /> 住宿推荐
      </h4>
      {(['primary', 'backup'] as const).map((tier) => {
        const hotel = accommodation[tier];
        if (!hotel || !hotel.name) return null;
        const label = tier === 'primary' ? '主选' : '备选';
        return (
          <Card key={tier} className="border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">
                    <Badge variant={tier === 'primary' ? 'default' : 'secondary'} className="mr-1.5 text-xs">
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
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(hotel.pricePerNight)}/晚</p>
                  {hotel.totalPrice > 0 && (
                    <p className="text-xs text-muted-foreground">
                      共 {formatCurrency(hotel.totalPrice)}
                    </p>
                  )}
                </div>
              </div>

              {hotel.amenities && hotel.amenities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {hotel.amenities.map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}

              {hotel.reason && (
                <p className="mt-2 text-xs text-muted-foreground">{hotel.reason}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
