import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from "react-native";

export interface AppAlert {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

let nextId = 0;
let queue: AppAlert[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const subscribeAlerts = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getAlertSnapshot = () => queue;
export function closeAlert(id: number) {
  queue = queue.filter((item) => item.id !== id);
  notify();
}

// React Native Web's Alert is empty. Keep the native API while supplying an
// accessible in-app dialog on web, including confirmation-button callbacks.
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== "web") {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    queue = [...queue, { id: ++nextId, title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }], options }];
    notify();
  },
};
