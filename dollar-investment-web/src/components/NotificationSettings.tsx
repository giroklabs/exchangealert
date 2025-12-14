import { useState, useEffect } from 'react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
} from '../utils/notificationService';

interface NotificationSettingsProps {
  onPermissionChange?: (granted: boolean) => void;
}

export function NotificationSettings({ onPermissionChange }: NotificationSettingsProps) {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // 권한 상태 모니터링
    const checkPermission = () => {
      const currentPermission = getNotificationPermission();
      setPermission(currentPermission);
      onPermissionChange?.(currentPermission.granted);
    };

    // 주기적으로 권한 상태 확인 (사용자가 브라우저 설정에서 변경할 수 있음)
    const interval = setInterval(checkPermission, 1000);

    return () => clearInterval(interval);
  }, [onPermissionChange]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      onPermissionChange?.(result.granted);

      if (result.granted) {
        // 테스트 알림 발송
        sendNotification('알림이 활성화되었습니다!', {
          body: '투자 적합성 상태가 변경되면 알림을 받을 수 있습니다.',
        });
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNotification = () => {
    if (permission.granted) {
      sendNotification('테스트 알림', {
        body: '알림이 정상적으로 작동합니다!',
      });
    }
  };

  if (!('Notification' in window)) {
    return (
      <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          ⚠️ 이 브라우저는 알림을 지원하지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">🔔 알림 설정</h3>
      
      <div className="space-y-3">
        {/* 권한 상태 표시 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">알림 권한:</span>
          <span
            className={`text-sm font-medium ${
              permission.granted
                ? 'text-green-400'
                : permission.denied
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            {permission.granted
              ? '✅ 허용됨'
              : permission.denied
              ? '❌ 거부됨'
              : '⚠️ 요청 필요'}
          </span>
        </div>

        {/* 권한 요청 버튼 */}
        {!permission.granted && !permission.denied && (
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequesting ? '요청 중...' : '🔔 알림 권한 요청'}
          </button>
        )}

        {/* 거부된 경우 안내 */}
        {permission.denied && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-3">
            <p className="text-xs text-red-200">
              알림이 거부되었습니다. 브라우저 설정에서 알림 권한을 허용해주세요.
            </p>
            <p className="text-xs text-red-300 mt-1">
              Safari: 환경설정 → 웹사이트 → 알림
            </p>
          </div>
        )}

        {/* 테스트 알림 버튼 */}
        {permission.granted && (
          <button
            onClick={handleTestNotification}
            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            🔔 테스트 알림 보내기
          </button>
        )}

        {/* 알림 설명 */}
        <div className="mt-4 pt-4 border-t border-gray-600">
          <p className="text-xs text-gray-300">
            투자 적합성 상태가 변경되면 자동으로 알림을 받을 수 있습니다.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            • 투자 적합 상태로 변경될 때 알림
            <br />
            • 투자 부적합 상태로 변경될 때 알림
            <br />
            • 페이지를 닫아도 백그라운드에서 작동 (Service Worker 필요)
          </p>
        </div>
      </div>
    </div>
  );
}

