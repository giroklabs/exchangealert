import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { githubSyncService } from '../services/githubSyncService';
import type { GitHubSyncInfo, UserBackupData } from '../types';

export function BackupManager() {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [syncInfo, setSyncInfo] = useState<GitHubSyncInfo>(() => {
        const saved = localStorage.getItem('github-sync-info');
        return saved ? JSON.parse(saved) : {
            pat: '',
            owner: 'giroklabs',
            repo: 'exchangealert',
            filePath: 'data/user-backup.json'
        };
    });

    const [status, setStatus] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [autoSync, setAutoSync] = useState(() => {
        return localStorage.getItem('github-auto-sync') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('github-auto-sync', String(autoSync));
    }, [autoSync]);

    // 전역 localStorage 변경 감지 설정 (자동 동기화 트리거용)
    useEffect(() => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function (key, value) {
            const event = new CustomEvent('local-storage-update', { detail: { key } });
            window.dispatchEvent(event);
            originalSetItem.apply(this, [key, value] as any);
        };
        return () => {
            localStorage.setItem = originalSetItem;
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('github-sync-info', JSON.stringify(syncInfo));
    }, [syncInfo]);

    // 로컬 스토리지에서 모든 데이터를 수집하여 통합 백업 데이터 생성
    const collectLocalData = (): UserBackupData => {
        const fxInvestments = JSON.parse(localStorage.getItem('fx-investments') || '[]');
        const assetInvestments = JSON.parse(localStorage.getItem('asset-investments-v2') || '[]');
        const sevenSplitSettings = JSON.parse(localStorage.getItem('seven-split-settings') || 'null');
        const sevenSplitSlots = JSON.parse(localStorage.getItem('seven-split-slots') || '[]');

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            fxInvestments,
            assetInvestments,
            sevenSplitSettings: sevenSplitSettings || undefined,
            sevenSplitSlots
        };
    };

    // 데이터를 로컬 스토리지에 배포
    const deployLocalData = (data: UserBackupData) => {
        if (data.fxInvestments) localStorage.setItem('fx-investments', JSON.stringify(data.fxInvestments));
        if (data.assetInvestments) localStorage.setItem('asset-investments-v2', JSON.stringify(data.assetInvestments));
        if (data.sevenSplitSettings) localStorage.setItem('seven-split-settings', JSON.stringify(data.sevenSplitSettings));
        if (data.sevenSplitSlots) localStorage.setItem('seven-split-slots', JSON.stringify(data.sevenSplitSlots));

        // 페이지 새로고침하여 데이터 반영
        if (window.confirm('데이터를 불러왔습니다. 변경사항을 적용하기 위해 페이지를 새로고침하시겠습니까?')) {
            window.location.reload();
        }
    };

    // 수동 파일 내보내기
    const handleManualExport = () => {
        const data = collectLocalData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const fileName = `dollar-invest-full-backup-${new Date().toISOString().split('T')[0]}.json`;

        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', fileName);
        link.click();
        setStatus('파일 내보내기 완료');
    };

    // 수동 파일 불러오기
    const handleManualImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (window.confirm('기존의 모든 데이터가 덮어씌워집니다. 계속하시겠습니까?')) {
                    deployLocalData(data);
                }
            } catch (err) {
                alert('잘못된 백업 파일입니다.');
            }
        };
        reader.readAsText(file);
    };

    // 연결 테스트
    const handleTestConnection = async () => {
        setIsLoading(true);
        setStatus('서버 연결 확인 중...');
        const ok = await githubSyncService.testConnection();
        setIsLoading(false);
        if (ok) {
            setStatus('연결 성공: GitHub 서버에 접속 가능합니다.');
        } else {
            setStatus('연결 실패: 브라우저 또는 네트워크가 GitHub API를 차단하고 있습니다. 광고 차단기 등을 확인해 주세요.');
        }
    };

    // GitHub로 동기화 (Push)
    const handleGitHubPush = async () => {
        if (!syncInfo.pat) {
            alert('GitHub Personal Access Token(PAT)을 먼저 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setStatus('GitHub 데이터를 확인 중...');
        try {
            // 먼저 기존 파일의 SHA를 가져옵니다 (덮어쓰기를 위해)
            const existing = await githubSyncService.fetchBackup(syncInfo);
            const data = collectLocalData();

            setStatus('GitHub에 데이터를 전송 중...');
            await githubSyncService.pushBackup(syncInfo, data, existing?.sha);

            const now = new Date().toLocaleString();
            setSyncInfo({ ...syncInfo, lastSync: now });
            setStatus(`동기화 성공: ${now}`);
        } catch (error: any) {
            console.error('Push Error:', error);
            const isNetworkError = error.message === 'Load failed' || error.message === 'Failed to fetch' || error.name === 'TypeError';
            const msg = isNetworkError
                ? '네트워크 연결 차단 (브라우저 확장 프로그램 또는 네트워크 환경 확인 필요)'
                : error.message;
            setStatus(`오류: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 알림창이 없는 자동 동기화용 Push
    const handleSilentPush = async () => {
        if (!syncInfo.pat) return;
        try {
            setStatus('자동 동기화 중... 🔄');
            const existing = await githubSyncService.fetchBackup(syncInfo);
            const data = collectLocalData();
            await githubSyncService.pushBackup(syncInfo, data, existing?.sha);

            const now = new Date().toLocaleString();
            setSyncInfo(prev => ({ ...prev, lastSync: now }));
            setStatus(`자동 동기화 완료 ✅ (${now})`);

            // 3초 후 상태 메시지 지우기
            setTimeout(() => {
                setStatus(prev => prev.includes('자동 동기화 완료') ? '' : prev);
            }, 3000);
        } catch (error) {
            console.error('Auto Sync Error:', error);
            setStatus('자동 동기화 실패 ❌ (GitHub 토큰 또는 연결 오류)');
        }
    };

    // 자동 동기화 이벤트 리스너 (디바운스 적용)
    useEffect(() => {
        if (!autoSync || !syncInfo.pat) return;

        let timeoutId: ReturnType<typeof setTimeout>;
        const handleUpdate = (e: any) => {
            const interestedKeys = ['fx-investments', 'asset-investments-v2', 'seven-split-settings', 'seven-split-slots'];
            if (interestedKeys.includes(e.detail?.key)) {
                clearTimeout(timeoutId);
                // 3초간 추가 입력이 없으면 백그라운드 동기화 실행
                timeoutId = setTimeout(() => {
                    handleSilentPush();
                }, 3000);
            }
        };

        window.addEventListener('local-storage-update', handleUpdate);
        return () => {
            window.removeEventListener('local-storage-update', handleUpdate);
            clearTimeout(timeoutId);
        };
    }, [autoSync, syncInfo]);

    // GitHub에서 불러오기 (Fetch)
    const handleGitHubFetch = async () => {
        if (!syncInfo.pat) {
            alert('GitHub Personal Access Token(PAT)을 먼저 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setStatus('GitHub에서 데이터를 가져오는 중...');
        try {
            const result = await githubSyncService.fetchBackup(syncInfo);
            if (!result) {
                setStatus('GitHub에 백업된 데이터가 없습니다.');
                return;
            }

            if (window.confirm(`GitHub의 데이터(${new Date(result.data.timestamp).toLocaleString()})를 불러와 로컬 데이터를 덮어씌우시겠습니까?`)) {
                deployLocalData(result.data);
                setStatus('데이터 불러오기 완료');
            } else {
                setStatus('취소됨');
            }
        } catch (error: any) {
            console.error('Fetch Error:', error);
            const isNetworkError = error.message === 'Load failed' || error.message === 'Failed to fetch' || error.name === 'TypeError';
            const msg = isNetworkError
                ? '네트워크 연결 차단 (브라우저 확장 프로그램 또는 네트워크 환경 확인 필요)'
                : error.message;
            setStatus(`오류: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* 메인 버튼 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
                    }`}
            >
                <span className="text-xl">🛡️</span>
                <span className="font-bold text-sm">데이터 백업 & 동기화</span>
            </button>

            {/* 관리 창 */}
            {isOpen && (
                <div className={`absolute bottom-16 right-0 w-80 md:w-96 p-6 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
                    }`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            📦 데이터 관리 매니저
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="space-y-6">
                        {/* GitHub 설정 */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">GitHub 동기화</h4>
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500"
                                >
                                    {showSettings ? '설정 숨기기' : '상세 설정'}
                                </button>
                            </div>

                            <div className="space-y-2 text-sm">
                                {showSettings && (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-2 mb-3">
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-bold">Owner / Repo</label>
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={syncInfo.owner}
                                                    onChange={(e) => setSyncInfo({ ...syncInfo, owner: e.target.value })}
                                                    className={`flex-1 p-1 text-[10px] rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white'}`}
                                                />
                                                <span className="text-gray-400">/</span>
                                                <input
                                                    type="text"
                                                    value={syncInfo.repo}
                                                    onChange={(e) => setSyncInfo({ ...syncInfo, repo: e.target.value })}
                                                    className={`flex-1 p-1 text-[10px] rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white'}`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-bold">File Path</label>
                                            <input
                                                type="text"
                                                value={syncInfo.filePath}
                                                onChange={(e) => setSyncInfo({ ...syncInfo, filePath: e.target.value })}
                                                className={`w-full p-1 text-[10px] rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white'}`}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="block text-[10px] text-gray-500 font-bold uppercase">Personal Access Token (PAT)</label>
                                    <input
                                        type="password"
                                        value={syncInfo.pat}
                                        placeholder="ghp_..."
                                        onChange={(e) => setSyncInfo({ ...syncInfo, pat: e.target.value })}
                                        className={`w-full p-2 rounded-xl border text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                        ⚡ 실시간 자동 동기화
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={autoSync}
                                            onChange={(e) => setAutoSync(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleGitHubPush}
                                        disabled={isLoading}
                                        className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        GitHub로 백업
                                    </button>
                                    <button
                                        onClick={handleGitHubFetch}
                                        disabled={isLoading}
                                        className="flex-1 py-2 bg-gray-600 text-white rounded-xl text-xs font-bold hover:bg-gray-700 disabled:opacity-50"
                                    >
                                        GitHub에서 복구
                                    </button>
                                </div>
                                <button
                                    onClick={handleTestConnection}
                                    className="w-full py-2 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    서버 연결 테스트 (오류 지속 시 클릭)
                                </button>
                                {syncInfo.lastSync && (
                                    <p className="text-[10px] text-gray-400 text-center">최근 동기화: {syncInfo.lastSync}</p>
                                )}
                            </div>
                        </div>

                        {/* 상세 도움말 */}
                        <div className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h5 className="text-[10px] font-black text-gray-600 dark:text-gray-300 mb-1">🆘 오류가 계속되나요?</h5>
                            <ul className="text-[10px] text-gray-800 dark:text-gray-200 dark:text-blue-300 space-y-1">
                                <li>• 토큰 발급 시 <strong>repo</strong> 권한을 체크했는지 확인해 주세요.</li>
                                <li>• 브라우저의 <strong>광고 차단기(AdBlock)</strong>를 끄고 시도해 주세요.</li>
                                <li>• 리포지토리 이름이 <strong>exchangealert</strong>가 맞는지 확인해 주세요.</li>
                            </ul>
                        </div>

                        {/* 수동 백업 */}
                        <div className="space-y-3 border-t pt-4 border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">수동 파일 관리</h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleManualExport}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}
                                >
                                    📥 파일로 저장
                                </button>
                                <label className={`flex-1 py-2 rounded-xl text-xs font-bold border text-center cursor-pointer ${theme === 'dark' ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                                    📤 파일 불러오기
                                    <input type="file" accept=".json" onChange={handleManualImport} className="hidden" />
                                </label>
                            </div>
                        </div>

                        {/* 상태 메시지 */}
                        {status && (
                            <div className={`p-3 rounded-xl text-[11px] font-bold text-center ${status.includes('성공') ? 'bg-green-100 text-green-600' :
                                status.includes('오류') ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-gray-900 dark:text-gray-100' : 'bg-gray-200 text-gray-800 dark:text-gray-200'
                                }`}>
                                {status}
                            </div>
                        )}

                        <div className="bg-gray-50 dark:bg-gray-800/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                            <p className="text-[10px] text-gray-700 dark:text-gray-200 leading-relaxed font-bold">
                                💡 스플릿, 자산 스플릿, 환차익 계산기의 데이터가 GitHub 리포지토리 파일 하나로 안전하게 통합 관리됩니다.
                            </p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                🔔 <strong>자동 동기화 설정 시:</strong> 버튼을 누르거나 키보드 입력이 끝난 후 약 3초 뒤에 백그라운드에서 조용히 저장됩니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
