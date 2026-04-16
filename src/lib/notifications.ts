export class NotificationManager {
  private static instance: NotificationManager;
  private hasPermission: boolean = false;

  private constructor() {
    this.checkPermission();
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  private checkPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return;
    }
    this.hasPermission = Notification.permission === "granted";
  }

  public async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) return false;

    if (Notification.permission === "granted") {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === "granted";
      return this.hasPermission;
    }

    return false;
  }

  public notify(title: string, options?: NotificationOptions) {
    if (!this.hasPermission) return;

    // Use a default icon if none provided
    const notificationOptions: NotificationOptions = {
      icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png', // WhatsApp/Messaging style icon
      badge: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
      silent: false,
      ...options,
    };

    try {
      const n = new Notification(title, notificationOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.error("Failed to show notification:", err);
    }
  }
}

export const notificationManager = NotificationManager.getInstance();
