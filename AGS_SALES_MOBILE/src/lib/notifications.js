import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Request notification permissions on mobile app start.
 */
export async function requestNotificationPermissions() {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    // Crear canal de notificaciones predeterminado (requerido para Android 8.0+)
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'Alertas del Sistema',
      description: 'Notificaciones y alertas en tiempo real de AGS SALES',
      importance: 5, // Importancia alta (muestra banners y sonido)
      visibility: 1, // Visible en pantalla de bloqueo
      playSound: true,
      vibration: true
    });
  } catch (e) {
    console.warn("Could not request notification permissions:", e);
  }
}

/**
 * Send a native system notification to the Android status bar.
 */
export async function sendNativeNotification({ title, body, id = Math.floor(Math.random() * 100000) }) {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id,
          channelId: 'default',
          schedule: { at: new Date(Date.now() + 100) },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: null
        }
      ]
    });
    // Also trigger haptic feedback
    triggerHaptic('success');
  } catch (e) {
    console.warn("Failed to schedule local notification:", e);
  }
}

/**
 * Trigger physical haptic feedback / vibration on the smartphone.
 * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} type 
 */
export async function triggerHaptic(type = 'light') {
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch (e) {
    // Fail silently on browsers / non-supported hardware
  }
}

/**
 * Play a custom swoosh/push sound using the Web Audio API.
 */
export const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Swoosh (noise/sweep)
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    
    // Second pop
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1200, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.4);
      
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.45);
    }, 150);
  } catch (e) {
    console.error('Audio play error:', e);
  }
};

/**
 * Analyze products and send/schedule native notifications for expiring or expired items.
 */
export async function checkAndNotifyExpiringProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expired = [];
  const critical = []; // <= 7 days
  const warning = [];  // <= 30 days

  products.forEach(p => {
    if (!p.expiration_date) return;
    const exp = new Date(p.expiration_date + 'T00:00:00');
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      expired.push({ ...p, diffDays });
    } else if (diffDays <= 7) {
      critical.push({ ...p, diffDays });
    } else if (diffDays <= 30) {
      warning.push({ ...p, diffDays });
    }
  });

  const totalUrgent = expired.length + critical.length;

  if (totalUrgent > 0) {
    let body = '';
    if (expired.length > 0 && critical.length > 0) {
      body = `⚠️ ${expired.length} producto(s) vencidos y ${critical.length} por vencer esta semana.`;
    } else if (expired.length > 0) {
      body = `🚨 Tienes ${expired.length} producto(s) vencidos en tu inventario.`;
    } else {
      body = `⏰ Tienes ${critical.length} producto(s) que vencen en los próximos 7 días.`;
    }

    await sendNativeNotification({
      title: 'AGS SALES: Alerta de Vencimiento',
      body,
      id: 99901
    });
    triggerHaptic('warning');
  }
}

