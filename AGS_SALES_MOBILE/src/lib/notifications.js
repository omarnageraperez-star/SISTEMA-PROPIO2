import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Request notification permissions on mobile app start.
 */
export async function requestNotificationPermissions() {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      const result = await LocalNotifications.requestPermissions();
      if (result.display !== 'granted') {
        console.warn('Notification permission denied by user');
        return;
      }
    }
    // Crear canal de notificaciones predeterminado (requerido para Android 8.0+)
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'Alertas del Sistema',
      description: 'Notificaciones y alertas en tiempo real de AGS SALES',
      importance: 5, // Importancia alta (muestra banners y sonido)
      visibility: 1, // Visible en pantalla de bloqueo
      playSound: true,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#f59e0b',
    });
    // Crear canal específico para domicilios
    await LocalNotifications.createChannel({
      id: 'delivery',
      name: 'Notificaciones de Domicilios',
      description: 'Alertas de nuevos pedidos de domicilio asignados',
      importance: 5, // Importancia máxima
      visibility: 1, // Visible en pantalla de bloqueo
      playSound: true,
      sound: 'delivery_sound', // Sonido personalizado
      vibration: true,
      lights: true,
      lightColor: '#3b82f6',
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
    // Android 12+ requires SCHEDULE_EXACT_ALARM permission for exact times.
    // We use a 1-second delay with allowWhileIdle as a robust alternative.
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id,
          channelId: 'default',
          schedule: {
            at: new Date(Date.now() + 1000), // 1 second delay
            allowWhileIdle: true,            // works even in Doze mode
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#f59e0b',
          actionTypeId: '',
          extra: null
        }
      ]
    });
    // Also trigger haptic feedback
    triggerHaptic('success');
  } catch (e) {
    console.warn("Failed to schedule local notification (trying immediate display):", e);
    // Fallback: try without schedule (immediate display)
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            channelId: 'default',
            sound: 'default',
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } catch (e2) {
      console.warn("Fallback notification also failed:", e2);
    }
  }
}

/**
 * Send a delivery notification with custom sound for new delivery orders.
 */
export async function sendDeliveryNotification({ title, body, id = Math.floor(Math.random() * 100000) }) {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id,
          channelId: 'delivery',
          schedule: {
            at: new Date(Date.now() + 1000),
            allowWhileIdle: true,
          },
          sound: 'delivery_sound',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#3b82f6',
          actionTypeId: '',
          extra: null
        }
      ]
    });
    // Trigger strong haptic feedback for delivery notifications
    triggerHaptic('heavy');
    // Also play custom sound
    playDeliverySound();
  } catch (e) {
    console.warn("Failed to schedule delivery notification:", e);
    // Fallback to default notification
    await sendNativeNotification({ title, body, id });
  }
}

/**
 * Play a custom delivery notification sound using the Web Audio API.
 */
export const playDeliverySound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // First beep - attention grabber
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);
    
    // Second beep - confirmation
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1100, ctx.currentTime);
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
      
      gain2.gain.setValueAtTime(0.4, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.start();
      osc2.stop(ctx.currentTime + 0.2);
    }, 250);
    
    // Third beep - urgency
    setTimeout(() => {
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      
      osc3.type = 'square';
      osc3.frequency.setValueAtTime(1320, ctx.currentTime);
      osc3.frequency.setValueAtTime(1760, ctx.currentTime + 0.15);
      
      gain3.gain.setValueAtTime(0.4, ctx.currentTime);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      
      osc3.start();
      osc3.stop(ctx.currentTime + 0.25);
    }, 500);
  } catch (e) {
    console.error('Audio play error:', e);
  }
};

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

  const totalUrgent = expired.length + critical.length + warning.length;

  if (totalUrgent > 0) {
    let body = '';
    if (expired.length > 0 && critical.length > 0) {
      body = `⚠️ ${expired.length} producto(s) vencidos y ${critical.length} por vencer esta semana.`;
    } else if (expired.length > 0) {
      body = `🚨 Tienes ${expired.length} producto(s) vencidos en tu inventario.`;
    } else if (critical.length > 0) {
      body = `⏰ Tienes ${critical.length} producto(s) que vencen en los próximos 7 días.`;
    } else {
      body = `⚠️ Tienes ${warning.length} producto(s) que vencen este mes.`;
    }

    await sendNativeNotification({
      title: 'AGS SALES: Alerta de Vencimiento',
      body,
      id: 99901
    });
    triggerHaptic('warning');
  }
}

