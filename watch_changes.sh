#!/bin/bash
# 파일 변경 감지 스크립트
while inotifywait -e modify,create,delete -r . 2>/dev/null; do
    echo "파일이 변경되었습니다. Xcode에서 새로고침하세요."
    # Xcode에서 자동으로 파일을 다시 로드하도록 알림
    osascript -e 'tell application "Xcode" to activate' 2>/dev/null || true
done
