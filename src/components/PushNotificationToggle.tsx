import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PushNotificationToggleProps {
  variant?: 'button' | 'switch';
}

const PushNotificationToggle = ({ variant = 'switch' }: PushNotificationToggleProps) => {
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    loading, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 opacity-50">
              <BellOff className="h-4 w-4" />
              <span className="text-sm">Not supported</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Push notifications are not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (permission === 'denied') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-destructive">
              <BellOff className="h-4 w-4" />
              <span className="text-sm">Blocked</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications are blocked. Please enable them in your browser settings.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant={isSubscribed ? 'secondary' : 'outline'}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <>
            <Bell className="h-4 w-4 mr-2" />
            Notifications On
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4 mr-2" />
            Enable Notifications
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Label htmlFor="push-notifications" className="cursor-pointer">
          Push Notifications
        </Label>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch
          id="push-notifications"
          checked={isSubscribed}
          onCheckedChange={handleToggle}
        />
      )}
    </div>
  );
};

export default PushNotificationToggle;
