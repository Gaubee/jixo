import {cn} from "@/lib/utils.ts";
import {AlertTriangle, CheckCircle, Info, Terminal, X} from "lucide-react";
import React, {createContext, useCallback, useContext, useState} from "react";

type NotificationType = "info" | "success" | "warning" | "error";

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  addNotification: (type: NotificationType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const newNotification: Notification = {
      id: Date.now(),
      type,
      message,
    };
    setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]); // Keep max 5 notifications
  }, []);

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{addNotification}}>
      {children}
      <NotificationPanel notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

const typeStyles = {
  info: "bg-blue-100/50 text-blue-800",
  success: "bg-green-100/50 text-green-800",
  warning: "bg-yellow-100/50 text-yellow-800",
  error: "bg-red-100/50 text-red-800",
};

const Icons: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: Terminal,
};

const NotificationPanel: React.FC<{notifications: Notification[]; onRemove: (id: number) => void}> = ({notifications, onRemove}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="absolute bottom-2 right-2 z-50 w-80 space-y-2">
      {notifications.map((notification) => {
        const Icon = Icons[notification.type];
        return (
          <div
            key={notification.id}
            className={cn("animate-in slide-in-from-bottom-4 backdrop-blur-xs backdrop-contrast-120 flex items-start rounded-lg p-3 shadow-lg", typeStyles[notification.type])}
          >
            <Icon className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0" />
            <p className="flex-grow break-all text-sm">{notification.message}</p>
            <button onClick={() => onRemove(notification.id)} className="ml-2 flex-shrink-0 rounded-full p-1 hover:bg-black/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
