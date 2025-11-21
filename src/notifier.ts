export class NotificationManager {
  container: HTMLElement;
  constructor() {
    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.bottom = "20px";
    this.container.style.right = "20px";
    this.container.style.zIndex = "1000";
    document.body.appendChild(this.container);
  }

  containers: { [key: string]: [HTMLElement, number] } = {};

  show(message: string, duration = 2000) {
    const notificationId = `notification-${Date.now()}`;
    const notification = document.createElement("div");
    notification.id = notificationId;
    notification.innerText = message;
    notification.style.background = "rgba(0, 0, 0, 0.7)";
    notification.style.color = "white";
    notification.style.padding = "10px 20px";
    notification.style.marginTop = "10px";
    notification.style.borderRadius = "5px";
    notification.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    notification.style.opacity = "0";
    notification.style.transform = "translateY(10px)";
    notification.style.minWidth = "200px";
    notification.style.maxHeight = "0px";
    notification.style.transition = "all 0.3s ease";

    this.container.appendChild(notification);

    // Fade in
    setTimeout(() => {
      requestAnimationFrame(() => {
        notification.style.opacity = "1";
        notification.style.transform = "translateY(0)";
        notification.style.maxHeight = "calc(1.2em + 20px)";
      });
    }, 10);

    // Fade out and remove after duration
    let timeout = setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(10px)";
      notification.addEventListener("transitionend", () => {
        notification.remove();
      });
    }, duration);

    this.containers[notificationId] = [notification, timeout];

    return notificationId;
  }

  dismiss(notificationId: string) {
    const entry = this.containers[notificationId];
    if (entry) {
      const [notification, timeout] = entry;
      clearTimeout(timeout);
      notification.style.opacity = "0";
      notification.style.transform = "translateX(10px)";
      notification.addEventListener("transitionend", () => {
        notification.remove();
      });
      delete this.containers[notificationId];
    }
  }

  update(notificationId: string, newMessage: string, duration = 2000) {
    const entry = this.containers[notificationId];
    if (entry) {
      const [notification, timeout] = entry;
      clearTimeout(timeout);
      notification.innerText = newMessage;

      // Set new timeout
      let newTimeout = setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transform = "translateX(10px)";
        notification.addEventListener("transitionend", () => {
          notification.remove();
        });
      }, duration);

      this.containers[notificationId] = [notification, newTimeout];
    }
  }
}

const notifier = new NotificationManager();
export default notifier;
