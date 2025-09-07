import {cn} from "@/lib/utils.ts";
import {AlertTriangle, CheckCircle, Info, Terminal, X} from "lucide-react";
import {animate, AnimatePresence, motion, useMotionValue, type AnimationPlaybackControlsWithThen} from "motion/react";
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";

type NotificationType = "info" | "success" | "warning" | "error";

interface Notification {
  id: string | number;
  type: NotificationType;
  message: string;
  duration?: number; // undefined for auto, 0 for permanent
}

interface NotificationContextType {
  addNotification: (notification: Omit<Notification, "id"> & {id?: string | number}) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string | number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, "id"> & {id?: string | number}) => {
    const id = notification.id ?? Date.now();
    const newNotification = {...notification, id};

    setNotifications((prev) => {
      const existingIndex = prev.findIndex((n) => n.id === id);
      if (existingIndex > -1) {
        const newNotifications = [...prev];
        newNotifications[existingIndex] = newNotification;
        return newNotifications;
      }
      return [newNotification, ...prev.slice(0, 4)];
    });
  }, []);

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
  info: {bg: "bg-blue-100/50", text: "text-blue-800", progress: "bg-blue-300"},
  success: {bg: "bg-green-100/50", text: "text-green-800", progress: "bg-green-300"},
  warning: {bg: "bg-yellow-100/50", text: "text-yellow-800", progress: "bg-yellow-300"},
  error: {bg: "bg-red-100/50", text: "text-red-800", progress: "bg-red-300"},
};

const Icons: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: Terminal,
};

const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: (id: string | number) => void;
}> = ({notification, onRemove}) => {
  const {duration, message, id, type} = notification;
  const showProgressBar = duration !== 0;
  const animationDuration = (duration ?? Math.min(Math.max(3_000, message.length * 100), 10_000)) / 1000;

  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 2. 创建一个 Motion Value 来驱动进度条的宽度
  const width = useMotionValue("100%");

  // 使用 useRef 来持有动画控制器实例
  const controlsRef = useRef<AnimationPlaybackControlsWithThen>(null);

  // 3. 【关键修复】这个 useEffect 只在组件挂载时运行一次，负责创建动画
  useEffect(() => {
    if (!showProgressBar) return;

    // 创建动画，并将其控制器存储在 ref 中
    controlsRef.current = animate(width, "0%", {
      duration: animationDuration,
      ease: "linear",
      onComplete: () => {
        onRemove(id);
      },
    });

    // 组件卸载时，确保停止动画，防止内存泄漏
    return () => {
      controlsRef.current?.cancel();
    };
    // 依赖项数组为空，确保此 effect 只运行一次
  }, [showProgressBar]);

  // 4. 这个 useEffect 负责根据状态变化来控制【已存在】的动画
  useEffect(() => {
    // 从 ref 中获取控制器
    const controls = controlsRef.current;
    if (!controls) return;

    // 现在 pause 和 play 会在同一个动画实例上工作
    if (isPaused) {
      controls.pause();
    } else {
      const t = controls.time;
      controls.play();
      controls.time = t;
    }

    // 调整速度
    controls.speed = isHovered ? 0.25 : 1;
  }, [isPaused, isHovered]);

  const Icon = Icons[type];
  const styles = typeStyles[type];

  return (
    <motion.div
      layout
      initial={{opacity: 0, y: 50, scale: 0.3}}
      animate={{opacity: 1, y: 0, scale: 1}}
      exit={{opacity: 0, scale: 0.5, transition: {duration: 0.2}}}
      className={cn("backdrop-blur-xs backdrop-contrast-120 relative flex w-full cursor-pointer items-start overflow-hidden rounded-lg p-3 shadow-lg", styles.bg, styles.text)}
      onTapStart={() => showProgressBar && setIsPaused((p) => !p)}
      onHoverStart={() => showProgressBar && setIsHovered(true)}
      onHoverEnd={() => showProgressBar && setIsHovered(false)}
    >
      <Icon className="pointer-events-none mr-3 mt-0.5 h-5 w-5 flex-shrink-0" />
      <p className="pointer-events-none flex-grow break-all text-sm">{message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="ml-2 flex-shrink-0 rounded-full p-1 hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
      {showProgressBar && (
        <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-black/10">
          <motion.div style={{width}} className={cn("h-full", styles.progress)} />
        </div>
      )}
    </motion.div>
  );
};

const NotificationPanel: React.FC<{
  notifications: Notification[];
  onRemove: (id: string | number) => void;
}> = ({notifications, onRemove}) => {
  return (
    <div className="absolute bottom-2 right-2 z-50 w-80 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};
