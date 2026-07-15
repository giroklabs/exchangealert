import SwiftUI

// MARK: - Notification Management Popup
struct NotificationManagementPopup: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @Binding var isPresented: Bool
    @State private var notifications: [NotificationHistory] = []
    @State private var isLoading = true
    
    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 커스텀 헤더
                HStack {
                    AppTitleView(title: "알림 센터", baseSize: 26)
                    
                    Spacer()
                    
                    Button("닫기") {
                        isPresented = false
                    }
                    .foregroundColor(AppTheme.primary)
                    .font(AppTheme.bodyFont)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                
                TopSeparator()
                
                if isLoading {
                    NotificationLoadingView()
                } else if notifications.isEmpty {
                    NotificationEmptyView(isPresented: $isPresented)
                } else {
                    NotificationListView(notifications: $notifications)
                }
                
                // 푸터
                NotificationPopupFooter(
                    isPresented: $isPresented,
                    onRefreshNotifications: loadNotificationHistory
                )
            }
        }
        .onAppear {
            loadNotificationHistory()
        }
    }
    
    private func loadNotificationHistory() {
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let loadedNotifications = NotificationHistory.loadFromUserDefaults()
            notifications = loadedNotifications
            isLoading = false
        }
    }
}

// MARK: - Notification History Model
struct NotificationHistory: Codable, Identifiable {
    var id = UUID()
    let date: Date
    let currency: String
    let message: String
    let type: NotificationType
    
    enum NotificationType: String, Codable, CaseIterable {
        case alert = "alert"
        case reminder = "reminder"
        case update = "update"
        
        var displayName: String {
            switch self {
            case .alert: return "알림"
            case .reminder: return "리마인더"
            case .update: return "업데이트"
            }
        }
        
        var icon: String {
            switch self {
            case .alert: return "bell.fill"
            case .reminder: return "clock.fill"
            case .update: return "arrow.clockwise"
            }
        }
        
        var color: Color {
            switch self {
            case .alert: return .red
            case .reminder: return .orange
            case .update: return .blue
            }
        }
    }
    
    static func loadFromUserDefaults() -> [NotificationHistory] {
        guard let data = UserDefaults.standard.data(forKey: "NotificationHistory"),
              let notifications = try? JSONDecoder().decode([NotificationHistory].self, from: data) else {
            return []
        }
        return notifications.sorted { $0.date > $1.date }
    }
    
    static func saveToUserDefaults(_ notifications: [NotificationHistory]) {
        if let data = try? JSONEncoder().encode(notifications) {
            UserDefaults.standard.set(data, forKey: "NotificationHistory")
        }
    }
}

// Popup Header는 더 이상 사용하지 않음 (표준 헤더로 대체)

// MARK: - Loading View
struct NotificationLoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.primary))
            
            Text("알림 내역을 불러오는 중...")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Empty View
struct NotificationEmptyView: View {
    @Binding var isPresented: Bool
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "bell.slash.fill")
                .font(.system(size: 60))
                .foregroundColor(.secondary.opacity(0.4))
            
            VStack(spacing: 12) {
                Text("알림 내역이 없습니다")
                    .font(AppTheme.titleFont)
                    .foregroundColor(.primary)
                
                Text("환율 변동 알림을 설정하면\n여기에 알림 내역이 표시됩니다")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - Notification List View
struct NotificationListView: View {
    @Binding var notifications: [NotificationHistory]
    @State private var selectedNotifications: Set<UUID> = []
    @State private var showingClearAlert = false
    
    var body: some View {
        VStack(spacing: 0) {
            // 액션 바
            NotificationActionBar(
                selectedCount: selectedNotifications.count,
                totalCount: notifications.count,
                onSelectAll: selectAllNotifications,
                onClearSelected: clearSelectedNotifications,
                onClearAll: { showingClearAlert = true }
            )
            
            // 알림 리스트
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(notifications) { notification in
                        NotificationItemView(
                            notification: notification,
                            isSelected: selectedNotifications.contains(notification.id),
                            onSelect: toggleSelection
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        }
        .alert("모든 알림 삭제", isPresented: $showingClearAlert) {
            Button("취소", role: .cancel) { }
            Button("삭제", role: .destructive) {
                clearAllNotifications()
            }
        } message: {
            Text("모든 알림 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")
        }
    }
    
    private func selectAllNotifications() {
        if selectedNotifications.count == notifications.count {
            selectedNotifications.removeAll()
        } else {
            selectedNotifications = Set(notifications.map { $0.id })
        }
    }
    
    private func toggleSelection(_ id: UUID) {
        if selectedNotifications.contains(id) {
            selectedNotifications.remove(id)
        } else {
            selectedNotifications.insert(id)
        }
    }
    
    private func clearSelectedNotifications() {
        withAnimation(.easeInOut(duration: 0.3)) {
            notifications.removeAll { selectedNotifications.contains($0.id) }
        }
        NotificationHistory.saveToUserDefaults(notifications)
        selectedNotifications.removeAll()
    }
    
    private func clearAllNotifications() {
        withAnimation(.easeInOut(duration: 0.3)) {
            notifications.removeAll()
        }
        NotificationHistory.saveToUserDefaults(notifications)
        selectedNotifications.removeAll()
    }
}

// MARK: - Action Bar
struct NotificationActionBar: View {
    let selectedCount: Int
    let totalCount: Int
    let onSelectAll: () -> Void
    let onClearSelected: () -> Void
    let onClearAll: () -> Void
    
    var body: some View {
        HStack {
            Button(action: onSelectAll) {
                HStack(spacing: 8) {
                    Image(systemName: selectedCount == totalCount ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(AppTheme.primary)
                    
                    Text(selectedCount == totalCount ? "전체 해제" : "전체 선택")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.primary)
                }
            }
            
            Spacer()
            
            if selectedCount > 0 {
                Button(action: onClearSelected) {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                        Text("선택 삭제 (\(selectedCount))")
                    }
                    .font(AppTheme.captionFont)
                    .foregroundColor(.red)
                }
            }
            
            Button(action: onClearAll) {
                HStack(spacing: 4) {
                    Image(systemName: "trash.fill")
                    Text("전체 삭제")
                }
                .font(AppTheme.captionFont)
                .foregroundColor(.red)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemBackground).opacity(0.5))
    }
}

// MARK: - Notification Item View
struct NotificationItemView: View {
    let notification: NotificationHistory
    let isSelected: Bool
    let onSelect: (UUID) -> Void
    
    private var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: notification.date, relativeTo: Date())
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // 선택 체크박스
            Button(action: {
                onSelect(notification.id)
            }) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(isSelected ? AppTheme.primary : .secondary)
            }
            
            // 알림 타입 아이콘
            ZStack {
                Circle()
                    .fill(notification.type.color.opacity(0.1))
                    .frame(width: 40, height: 40)
                
                Image(systemName: notification.type.icon)
                    .font(.title3)
                    .foregroundColor(notification.type.color)
            }
            
            // 알림 내용
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(notification.type.displayName)
                        .font(AppTheme.captionFont)
                        .fontWeight(.medium)
                        .foregroundColor(notification.type.color)
                    
                    Text("•")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    
                    Text(notification.currency)
                        .font(AppTheme.captionFont)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Text(timeAgo)
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                }
                
                Text(notification.message)
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.primary)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isSelected ? AppTheme.primary.opacity(0.05) : Color(.systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? AppTheme.primary.opacity(0.3) : Color.clear, lineWidth: 1)
                )
        )
    }
}

// MARK: - Popup Footer
struct NotificationPopupFooter: View {
    @Binding var isPresented: Bool
    let onRefreshNotifications: () -> Void
    
    var body: some View {
        VStack(spacing: 12) {
            Divider()
            
            HStack(spacing: 16) {
                Button(action: {
                    // iOS 설정 앱으로 바로 이동
                    openAppSettings()
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "gearshape.fill")
                        Text("알림 설정")
                    }
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(AppTheme.primary.opacity(0.1))
                    )
                }
                
                Button(action: {
                    // 백그라운드 fetch 강제 실행 (메뉴 활성화를 위해)
                    triggerBackgroundFetch()
                    
                    NotificationManager.shared.sendTestNotification()
                    // 테스트 알림 발송 후 히스토리 새로고침
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        onRefreshNotifications()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "bell.badge.fill")
                        Text("테스트 알림")
                    }
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(AppTheme.primaryGradient)
                    .cornerRadius(12)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
    }
    
    private func triggerBackgroundFetch() {
        // iOS 버전별 백그라운드 fetch 설정
        if #available(iOS 13.0, *) {
            // iOS 13+에서는 BackgroundTasks 프레임워크 사용
            print("🔄 iOS 13+ BackgroundTasks 프레임워크 사용")
        } else {
            // iOS 12 이하에서만 setMinimumBackgroundFetchInterval 사용
            UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
            print("🔄 iOS 12 이하 백그라운드 fetch 간격을 최소로 설정")
        }
        
        // 백그라운드 앱 새로고침 상태 확인
        let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
        print("📱 현재 백그라운드 앱 새로고침 상태: \(backgroundRefreshStatus.rawValue)")
        
        switch backgroundRefreshStatus {
        case .available:
            print("✅ 백그라운드 앱 새로고침 사용 가능 - iOS가 자동으로 백그라운드에서 실행할 예정")
        case .denied:
            print("❌ 백그라운드 앱 새로고침 거부됨 - 설정에서 활성화 필요")
        case .restricted:
            print("⚠️ 백그라운드 앱 새로고침 제한됨")
        @unknown default:
            print("❓ 알 수 없는 백그라운드 새로고침 상태")
        }
    }
    
    private func openAppSettings() {
        if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsURL)
            print("📱 iOS 설정 앱으로 이동")
        }
    }
    
    private func showBackgroundRefreshAlert() {
        let alert = UIAlertController(
            title: "백그라운드 앱 새로고침 설정",
            message: "환율 알림을 받으려면 백그라운드 앱 새로고침을 활성화해야 합니다.\n\n설정 > 일반 > 백그라운드 앱 새로고침 > 환율알라미를 켜주세요.",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "설정으로 이동", style: .default) { _ in
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsURL)
            }
        })
        
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(alert, animated: true)
        }
    }
}

#Preview {
    NotificationManagementPopup(isPresented: .constant(true))
        .environmentObject(ExchangeRateManager())
}
