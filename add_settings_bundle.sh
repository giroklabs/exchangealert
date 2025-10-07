#!/bin/bash

echo "🔧 Settings.bundle을 Xcode 프로젝트에 추가하는 스크립트"

# Xcode 프로젝트 파일 경로
PROJECT_FILE="exchange_alert/exchange_alert.xcodeproj/project.pbxproj"

# Settings.bundle이 이미 등록되어 있는지 확인
if grep -q "Settings.bundle" "$PROJECT_FILE"; then
    echo "✅ Settings.bundle이 이미 프로젝트에 등록되어 있습니다."
else
    echo "⚠️ Settings.bundle이 프로젝트에 등록되지 않았습니다."
    echo ""
    echo "📋 수동 추가 방법:"
    echo "1. Xcode에서 프로젝트 열기"
    echo "2. exchange_alert 폴더에서 우클릭"
    echo "3. 'Add Files to \"exchange_alert\"' 선택"
    echo "4. Settings.bundle 폴더 선택"
    echo "5. 'Copy items if needed' 체크"
    echo "6. 'Add to target'에서 exchange_alert 선택"
    echo "7. Add 클릭"
    echo ""
    echo "또는 드래그 앤 드롭:"
    echo "1. Finder에서 Settings.bundle 폴더를 Xcode 프로젝트로 드래그"
    echo "2. 'Copy items if needed' 체크"
    echo "3. 'Add to target'에서 exchange_alert 선택"
fi

echo ""
echo "📱 Settings.bundle 구조:"
echo "Settings.bundle/"
echo "├── Info.plist"
echo "├── Root.plist"
echo "├── BackgroundRefresh.plist"
echo "└── Notifications.plist"

echo ""
echo "✅ 완료 후 iOS 설정 앱에서 '환율알라미' 앱을 찾을 수 있습니다."
