/**
 * 브라우저 알림 서비스
 * Safari를 포함한 모든 모던 브라우저에서 작동합니다.
 */

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

/**
 * 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다.');
    return { granted: false, denied: false, default: false };
  }

  if (Notification.permission === 'granted') {
    return { granted: true, denied: false, default: false };
  }

  if (Notification.permission === 'denied') {
    return { granted: false, denied: true, default: false };
  }

  // 권한 요청
  const permission = await Notification.requestPermission();
  
  return {
    granted: permission === 'granted',
    denied: permission === 'denied',
    default: permission === 'default',
  };
}

/**
 * 현재 알림 권한 상태 확인
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return { granted: false, denied: false, default: false };
  }

  return {
    granted: Notification.permission === 'granted',
    denied: Notification.permission === 'denied',
    default: Notification.permission === 'default',
  };
}

/**
 * 알림 발송
 */
export function sendNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다.');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('알림 권한이 없습니다.');
    return;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'investment-alert', // 같은 태그의 알림은 덮어씀
      requireInteraction: false,
      ...options,
    });

    // 알림 클릭 시 포커스
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // 5초 후 자동 닫기
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    console.error('알림 발송 실패:', error);
  }
}

/**
 * 투자 적합성 알림 발송
 */
export function sendInvestmentNotification(isSuitable: boolean, details?: string): void {
  if (isSuitable) {
    sendNotification('✅ 투자 시작 적합!', {
      body: `현재 시점이 달러 투자에 적합합니다.${details ? `\n${details}` : ''}`,
      icon: '/favicon.ico',
    });
  } else {
    sendNotification('⚠️ 투자 시작 부적합', {
      body: `현재 시점은 달러 투자에 부적합합니다.${details ? `\n${details}` : ''}`,
      icon: '/favicon.ico',
    });
  }
}

