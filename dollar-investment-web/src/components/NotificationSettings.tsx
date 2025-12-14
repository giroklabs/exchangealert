import { useState, useEffect } from 'react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
} from '../utils/notificationService';
import { useTheme } from '../contexts/ThemeContext';

interface NotificationSettingsProps {
  onPermissionChange?: (granted: boolean) => void;
}

export function NotificationSettings({ onPermissionChange }: NotificationSettingsProps) {
  const { theme } = useTheme();
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
      <div className={`border rounded-lg p-4 ${
        theme === 'dark' ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200'
      }`}>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'
        }`}>
          ⚠️ 이 브라우저는 알림을 지원하지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow-md p-4 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>🔔 알림 설정</h3>
      
      <div className="space-y-3">
        {/* 권한 상태 표시 */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>알림 권한:</span>
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
          <div className={`border rounded-lg p-3 ${
            theme === 'dark' ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-red-200' : 'text-red-800'
            }`}>
              알림이 거부되었습니다. 브라우저 설정에서 알림 권한을 허용해주세요.
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'dark' ? 'text-red-300' : 'text-red-600'
            }`}>
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
        <div className={`mt-4 pt-4 border-t ${
          theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
          }`}>
            투자 적합성 상태가 변경되면 자동으로 알림을 받을 수 있습니다.
          </p>
          <p className={`text-xs mt-1 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-400'
          }`}>
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

