import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { NotificationSettings } from "./NotificationSettings";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Preferences {
  sound_enabled: boolean;
  vibration_enabled: boolean;
}

// Notification sound - base64 encoded short beep
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJunsJV8UlJqhpeloZF5YVxug5ObnZGCd3OFjpCMf3N2e4GGhIB5dHN1eXt6eHZ0c3R2d3h3dnV0dHV2d3d2dXR0dHV1dXR0c3NzdHR0c3NzdHNzc3NzdHR0dHRzdHR1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRzc3N0dHR1dXZ2d3d4eHl5enp7e3t7e3t7e3p6enl5eXh3d3Z2dXV0dHNzc3NycnJycnJycnNzc3R0dXV2dnd3eHl5enp7e3x8fHx8fHx8e3t7enp5eXh4d3Z2dXV0dHNzc3NycnJycnJyc3Nzc3R0dXV2d3d4eXp6e3t8fHx9fX19fX19fHx8e3t6eXl4eHd2dnV0dHNzc3JycnJycnJyc3NzdHR1dXZ3d3h5enp7fHx9fX5+fn5+fn5+fX19fHx7e3p5eXh3d3Z1dXR0c3NycnJxcXFxcnJyc3N0dHV2dnd4eXl6e3x8fX1+fn9/f39/f39/fn5+fX18fHt6enl4eHd2dXV0c3NycnJxcXFxcXJycnNzdHR1dnd4eXl6e3x9fX5+f4CAgICAgIB/f39+fn19fHx7enp5eHd3dnV1dHNzcnJxcXBwcHBxcXJyc3N0dXZ2d3h5ent7fH1+fn+AgIGBgYGBgYGAgIB/f35+fXx8e3p6eXh3dnV1dHNzcnJxcXBwcHBwcXFycnN0dHV2d3h5ent8fH1+f4CAgYGBgoKCgoGBgYCAf39+fX18e3t6eXh4d3Z1dHRzc3JxcXBwb29vb3BwcXFyc3N0dXZ3eHl6e3x9fn5/gICBgoKCgoKCgoKBgYCAf39+fXx8e3p5eHh3dnV0dHNycnFxcG9vb29vb3BwcXJyc3R1dnd4eXp7fH1+f4CAgYGCgoODg4ODgoKBgYCAf35+fXx7enp5eHd2dXR0c3JycXFwb29vbm5vb3BwcXJzdHV2d3h5ent8fX5/gICBgoKDg4ODg4OCgoGBgIB/fn59fHt6enl4d3Z1dHRzcnJxcHBvb25ubm5vb3BxcXJzdHV2d3h5ent8fX6AgIGBgoKDg4SDg4OCgoGBgIB/fn59fHt6eXh3d3Z1dHNzcnJxcHBvbm5ubm5ub3BwcXJzdHV2d3l5ent8fX5/gIGBgoKDg4SEhISDg4KCgYCAf35+fXx7enl4d3Z1dHRzcnJxcHBvbm5tbW1ubm9wcHFyc3R1dnd4eXp7fH1+f4CBgoKDg4SEhISEg4OCgoGAf39+fXx7enl4d3Z1dHRzcnFxcG9ubm1tbW1tb29wcHFyc3R1dnd5eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9/fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxtbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/f359fHt6eXh3dnV0dHNycXFwb25tbW1sbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9+fn18e3p5eHd2dXR0c3JxcXBvbm1tbGxsbG1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgYGAf35+fXx7enl4d3Z1dHNzcnFwcG9ubW1sbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGBgoODhISEhISDg4KBgYB/fn59fHt6eXh3dnV0c3NycXBwb25tbWxsbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoGBgH9+fn18e3p5eHd2dXRzc3JxcHBvbm1tbGxsbG1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4KCgYGAf35+fXx7enl4d3Z1dHNzcnFwcG9ubW1sbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGBgoODhISEhISDg4KCgYB/fn59fHt6eXh3dnV0dHNycXBwb25tbWxsbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9/fn18e3p5eHd2dXR0c3JxcXBvbm1tbGxsbG1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgoGAf39+fXx7enl4d3Z1dHRzcnFxcG9ubW1sbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/f359fHt6eXh3dnV0dHNycXFwb25tbW1sbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9+fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxsbW1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgoGAf35+fXx7enl4d3Z1dHRzcnFxcG9ubW1tbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/f359fHt6eXh3dnV0dHNycXFwb25tbW1sbG1tbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9+fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxsbW1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4KCgYGAf35+fXx7enl4d3Z1dHRzcnFxcG9ubW1tbGxtbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGBgoODhISEhISDg4KCgYB/fn59fHt6eXh3dnV0dHNycXFwb25ubW1sbG1tbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4ODhISEhIODgoKBgH9/fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxsbW1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgoGAf35+fXx7enl4d3Z1dHNzcnFxcG9ubW1tbGxtbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/fn59fHt6eXh3dnV0dHNycXFwb25tbW1sbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYKCg4OEhISEhIODgoKBgH9+fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxsbW1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgoGAf35+fXx7enl4d3Z1dHRzcnFxcG9ubW1tbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/fn59fHt6eXh3dnV0dHNycXFwb25tbW1sbGxtbm9vcHFyc3R1dnd4eXp7fH1+f4CAgYGCg4OEhISEhIODgoKBgH9+fn18e3p5eHd2dXR0c3JxcXBvbm1tbWxsbG1ub29wcXJzdHV2d3h5ent8fX5/gICBgoKDg4SEhISEg4OCgoGAf35+fXx7enl4d3Z1dHRzcnFxcG9ubW1tbGxsbW5vb3BxcnN0dXZ3eHl6e3x9fn+AgIGCgoODhISEhISDg4KCgYB/fn59fHt6eXh3dnV0";

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {
    // Silently fail if audio not supported
  }
};

const triggerVibration = () => {
  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
};

const BASE_TITLE = document.title.replace(/^\(\d+\)\s*/, '');

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const preferencesRef = useRef<Preferences>({ sound_enabled: true, vibration_enabled: true });

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notification_preferences")
      .select("sound_enabled, vibration_enabled")
      .eq("user_id", user.id)
      .single();

    if (data) {
      preferencesRef.current = {
        sound_enabled: data.sound_enabled,
        vibration_enabled: data.vibration_enabled,
      };
    }
  }, []);

  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    
    if (preferencesRef.current.sound_enabled) {
      playNotificationSound();
    }
    if (preferencesRef.current.vibration_enabled) {
      triggerVibration();
    }
    
    // Show browser notification if supported and permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(notification.title, {
            body: notification.message,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: notification.id,
          });
        });
      }
    }
    
    toast.info(notification.title, {
      description: notification.message,
      duration: 5000,
    });
  }, []);

  // Update browser tab title with unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [unreadCount]);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
    
    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          handleNewNotification(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewNotification, fetchPreferences]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) {
      setNotifications(data);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  const clearAllNotifications = async () => {
    const notificationIds = notifications.map(n => n.id);
    if (notificationIds.length === 0) return;

    // Mark all as read first since we can't delete
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", notificationIds);
    
    setNotifications([]);
    toast.success("All notifications cleared");
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "bg-green-100 border-green-300 text-green-800";
      case "error": return "bg-red-100 border-red-300 text-red-800";
      case "warning": return "bg-yellow-100 border-yellow-300 text-yellow-800";
      default: return "bg-blue-100 border-blue-300 text-blue-800";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1 items-center">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={clearAllNotifications}
                title="Clear all notifications"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <NotificationSettings />
          </div>
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.is_read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <Badge className={`${getTypeColor(notification.type)} shrink-0`}>
                      {notification.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), "MMM dd, HH:mm")}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};