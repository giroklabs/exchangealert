import SwiftUI

// MARK: - Notification Management Popup
struct NotificationManagementPopup: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @Binding var isPresented: Bool
    @State private var notifications: [NotificationHistory] = []
    @State private var isLoading = true
    
    var body: some View {
        ZStack {
            // 배경 오버레이
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }
            
            // 팝업 컨테이너
            VStack(spacing: 0) {
                // 헤더
                NotificationPopupHeader(isPresented: $isPresented)
                
                // 콘텐츠
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
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
            )
            .frame(maxWidth: .infinity, maxHeight: 600)
            .padding(.horizontal, 20)
        }
        .onAppear {
            loadNotificationHistory()
        }
    }
    
    private func loadNotificationHistory() {
        isLoading = true
        // 실제 알림 히스토리 로드 (UserDefaults에서)
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

// MARK: - Popup Header
struct NotificationPopupHeader: View {
    @Binding var isPresented: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("알림 메시지 관리")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                
                Text("최근 알림 내역을 확인하고 관리할 수 있습니다")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                isPresented = false
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 16)
    }
}

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
                .font(.system(size: 50))
                .foregroundColor(.secondary.opacity(0.6))
            
            VStack(spacing: 8) {
                Text("알림 내역이 없습니다")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("환율 변동 알림을 설정하면\n여기에 알림 내역이 표시됩니다")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            GradientButton(
                title: "알림 설정하기",
                icon: "bell.fill",
                action: {
                    isPresented = false
                    // 알림 설정으로 이동하는 로직 (현재는 팝업 닫기)
                }
            )
            .padding(.horizontal, 40)
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
                LazyVStack(spacing: 16) {
                    ForEach(notifications) { notification in
                        NotificationItemView(
                            notification: notification,
                            isSelected: selectedNotifications.contains(notification.id),
                            onSelect: toggleSelection
                        )
                    }
                }
                .padding(.horizontal, 20)
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
                        .font(.caption)
                        .foregroundColor(AppTheme.primary)
                }
            }
            
            Spacer()
            
            if selectedCount > 0 {
                Button(action: onClearSelected) {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                            .font(.caption)
                        Text("선택 삭제 (\(selectedCount))")
                            .font(.caption)
                    }
                    .foregroundColor(.red)
                }
            }
            
            Button(action: onClearAll) {
                HStack(spacing: 4) {
                    Image(systemName: "trash.fill")
                        .font(.caption)
                    Text("전체 삭제")
                        .font(.caption)
                }
                .foregroundColor(.red)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(.systemGray6))
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
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(notification.type.color)
                    
                    Text("•")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(notification.currency)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Text(timeAgo)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Text(notification.message)
                    .font(.system(size: 14, weight: .regular))
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
                    // 백그라운드 앱 새로고침 상태 확인 및 안내
                    let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
                    
                    switch backgroundRefreshStatus {
                    case .available:
                        print("✅ 백그라운드 앱 새로고침 사용 가능")
                        isPresented = false
                    case .denied:
                        print("❌ 백그라운드 앱 새로고침 거부됨")
                        // 사용자에게 설정 안내
                        showBackgroundRefreshAlert()
                    case .restricted:
                        print("⚠️ 백그라운드 앱 새로고침 제한됨")
                        showBackgroundRefreshAlert()
                    @unknown default:
                        print("❓ 알 수 없는 상태")
                        showBackgroundRefreshAlert()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "gearshape.fill")
                        Text("알림 설정")
                    }
                    .font(.body)
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(AppTheme.primary.opacity(0.1))
                    )
                }
                
                Button(action: {
                    NotificationManager.sendTestNotification()
                    // 테스트 알림 발송 후 히스토리 새로고침
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        onRefreshNotifications()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "bell.badge.fill")
                        Text("테스트 알림")
                    }
                    .font(.body)
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
