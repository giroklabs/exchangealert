import SwiftUI

// MARK: - Notification Management Popup
struct NotificationManagementPopup: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @Binding var isPresented: Bool
    @State private var notifications: [NotificationHistory] = []
    @State private var showingClearAlert = false

    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                SheetHeader(title: "알림 센터", onClose: { isPresented = false }) {
                    if !notifications.isEmpty {
                        Button("전체 삭제") { showingClearAlert = true }
                            .font(AppTheme.bodyFont)
                            .foregroundColor(.secondary)
                    }
                }

                if notifications.isEmpty {
                    NotificationEmptyView()
                } else {
                    NotificationListView(notifications: $notifications)
                }

                NotificationPopupFooter(onRefreshNotifications: loadNotificationHistory)
            }
        }
        .onAppear(perform: loadNotificationHistory)
        .alert("알림 내역 전체 삭제", isPresented: $showingClearAlert) {
            Button("취소", role: .cancel) { }
            Button("삭제", role: .destructive) {
                withAnimation { notifications.removeAll() }
                NotificationHistory.saveToUserDefaults(notifications)
            }
        } message: {
            Text("되돌릴 수 없습니다.")
        }
    }

    private func loadNotificationHistory() {
        notifications = NotificationHistory.loadFromUserDefaults()
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

// MARK: - Empty View
struct NotificationEmptyView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "bell.slash")
                .font(.system(size: 36))
                .foregroundColor(.secondary.opacity(0.5))
            Text("받은 알림이 없습니다")
                .font(AppTheme.headlineFont)
            Text("목표 환율 알림을 켜면 여기에 기록됩니다")
                .font(AppTheme.subheadlineFont)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(32)
    }
}

// MARK: - Notification List View (밀어서 삭제)
struct NotificationListView: View {
    @Binding var notifications: [NotificationHistory]

    var body: some View {
        List {
            ForEach(notifications) { notification in
                NotificationItemView(notification: notification)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20))
            }
            .onDelete { offsets in
                notifications.remove(atOffsets: offsets)
                NotificationHistory.saveToUserDefaults(notifications)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
}

// MARK: - Notification Item View
struct NotificationItemView: View {
    let notification: NotificationHistory

    private var timeAgo: String {
        // 기기 언어가 영어여도 "in 0s" 대신 한국어로 표시하고, 1분 이내는 "방금 전"으로 보여준다.
        if abs(notification.date.timeIntervalSinceNow) < 60 { return "방금 전" }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: notification.date, relativeTo: Date())
    }

    private var currencyLabel: String {
        notification.currency == "SYSTEM" ? "테스트" : notification.currency
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(currencyLabel)
                    .font(AppTheme.captionFont.weight(.semibold))
                    .foregroundColor(AppTheme.accentText)
                Spacer()
                Text(timeAgo)
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
            }
            Text(notification.message)
                .font(AppTheme.bodyFont)
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Popup Footer
struct NotificationPopupFooter: View {
    let onRefreshNotifications: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: 12) {
                Button(action: openAppSettings) {
                    Text("알림 권한 설정")
                        .font(AppTheme.subheadlineFont.weight(.semibold))
                        .foregroundColor(.primary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                }

                Button(action: {
                    NotificationManager.shared.sendTestNotification()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        onRefreshNotifications()
                    }
                }) {
                    Text("테스트 알림")
                        .font(AppTheme.subheadlineFont.weight(.semibold))
                        .foregroundColor(AppTheme.onPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(AppTheme.primary)
                        .cornerRadius(12)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
    }

    private func openAppSettings() {
        if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsURL)
        }
    }
}

#Preview {
    NotificationManagementPopup(isPresented: .constant(true))
        .environmentObject(ExchangeRateManager())
}
