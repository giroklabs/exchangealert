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
            console.error(error);
            setStatus(`오류 발생: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

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
            console.error(error);
            setStatus(`오류 발생: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

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
                            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">GitHub 클라우드 동기화</h4>
                            <div className="space-y-2 text-sm">
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Personal Access Token (PAT)</label>
                                <input
                                    type="password"
                                    value={syncInfo.pat}
                                    placeholder="ghp_..."
                                    onChange={(e) => setSyncInfo({ ...syncInfo, pat: e.target.value })}
                                    className={`w-full p-2 rounded-xl border text-xs ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                                />
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
                                {syncInfo.lastSync && (
                                    <p className="text-[10px] text-gray-400 text-center">최근 동기화: {syncInfo.lastSync}</p>
                                )}
                            </div>
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
                                status.includes('오류') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                {status}
                            </div>
                        )}

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
                            <p className="text-[10px] text-amber-700 dark:text-amber-200 leading-relaxed">
                                💡 세븐스플릿, 자산투자, 환차익 계산기의 모든 데이터가 하나의 파일에 통합되어 백업됩니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
