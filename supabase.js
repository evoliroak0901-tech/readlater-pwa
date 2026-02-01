// Supabase Client
// CDN版を使用（ビルドツール不要）

// 環境変数
const SUPABASE_URL = 'https://sreimiuxlfqlifkrlwhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZWltaXV4bGZxbGlma3Jsd2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTIyNDIsImV4cCI6MjA4NDU2ODI0Mn0.2EaMQC3NdPU7Tqxps0P-YO5Stc9X5gjrXz_tPrG82XE';

// Supabaseクライアント作成
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 現在のユーザー
let currentUser = null;
let supabaseInitialized = false;

// 初期化関数
// 初期化関数
async function initializeSupabase() {
    if (supabaseInitialized) return;
    supabaseInitialized = true;

    console.log('Supabase Initializing...');

    // URLにアクセストークンがある場合の特別対応
    const hasTokenInUrl = window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=recovery');

    if (hasTokenInUrl) {
        console.log('🔑 Token detected in URL, manually processing...');
        // UIをローディング状態に
        const container = document.getElementById('authContainer');
        if (container) container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">接続中...</div>';

        // 手動でトークンを抽出してセッションを確立
        try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken) {
                console.log('✅ Manually setting session with extracted tokens...');
                const { data, error } = await supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || ''
                });

                if (error) {
                    console.error('❌ setSession error:', error);
                    alert('ログインエラー: ' + error.message);
                } else {
                    console.log('🎉 Session manually established!', data);
                    // URLをクリーンアップ
                    window.history.replaceState(null, null, window.location.pathname);
                }
            }
        } catch (e) {
            console.error('❌ Manual token processing failed:', e);
        }
    }

    // 認証状態の監視
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state change event:', event);
        console.log('📧 Session user:', session?.user?.email || 'No user');
        console.log('🔑 Session exists:', !!session);
        currentUser = session?.user ?? null;

        updateAuthUI();

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            if (session) {
                console.log('✅ Login successful! User:', session.user.email);
                if (window.location.hash.includes('access_token')) {
                    console.log('🧹 Cleaning URL hash...');
                    window.history.replaceState(null, null, window.location.pathname);
                }
                onSignIn();
                // 拡張機能にセッションを送信（ブリッジ機能）
                sendSessionToExtension(session);
            } else {
                console.warn('⚠️ Event fired but no session found');
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out');
            onSignOut();
        }
    });

    // 強制的なセッションチェック（少し待ってから実行）
    setTimeout(async () => {
        console.log('🔍 Manual session check starting...');
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) {
                console.error('❌ Session retrieval error:', error);
                throw error;
            }

            if (session) {
                console.log('✅ Manual session found:', session.user.email);
                currentUser = session.user;
                if (!window.location.hash.includes('access_token')) {
                    await onSignIn();
                }
                updateAuthUI();
                // 拡張機能にセッションを送信
                sendSessionToExtension(session);
            } else {
                console.warn('⚠️ No session found in manual check');
            }
        } catch (e) {
            console.error('❌ Initial session check failed:', e);
        }
    }, 500);
}

// 拡張機能へセッションを送る
function sendSessionToExtension(session) {
    const EXTENSION_ID = 'fnkkpddniihppcmnjpnobknhdobojhfd';
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        console.log('Sending session to extension:', EXTENSION_ID);
        try {
            chrome.runtime.sendMessage(EXTENSION_ID, {
                type: 'AUTH_SESSION',
                session: session
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Extension verify check: Not installed or mismatch', chrome.runtime.lastError);
                } else {
                    console.log('Extension confirmed receipt:', response);
                }
            });
        } catch (e) {
            console.log('Failed to send to extension (may not be installed):', e);
        }
    }
}

// すぐに初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
    initializeSupabase();
}

// Googleログイン
async function signInWithGoogle() {
    try {
        console.log('Redirecting to Google Login...');

        // Extension(iframe)内で実行されているか確認
        if (window.self !== window.top) {
            console.log('Running in iframe, opening popup...');
            // Iframe内ではGoogleログインがブロックされるため、別ウィンドウで開く
            window.open(window.location.href, '_blank');
            if (window.showToast) window.showToast('別タブでログイン画面を開きました。ログイン後に「🔄」ボタンを押してください', 'info');
            return;
        }

        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Login error:', error);
        alert('ログインエラーが発生しました: ' + error.message);
    }
}

// ログアウト
async function signOut() {
    try {
        await supabaseClient.auth.signOut();
        window.location.reload(); // 確実にクリーンアップ
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// --- CRUD操作 ---

// 保存
async function savePageToCloud(page) {
    if (!currentUser) {
        console.warn('Cannot save: User not logged in');
        if (window.showToast) window.showToast('クラウド保存失敗: ログインしていません', 'error');
        return;
    }

    console.log('Saving to cloud...', page.id);
    try {
        const { error } = await supabaseClient.from('pages').upsert({
            id: page.id,
            user_id: currentUser.id,
            url: page.url,
            title: page.title,
            favicon: page.favicon,
            domain: page.domain,
            excerpt: page.excerpt,
            tags: page.tags || [],
            read: page.read || false,
            saved_at: page.savedAt || new Date().toISOString()
        });

        if (error) throw error;
        console.log('Cloud save success!');
        // 成功時はうるさいのでトースト出さないか、控えめに
    } catch (e) {
        console.error('Cloud save failed:', e.message);
        if (window.showToast) window.showToast(`クラウド保存エラー: ${e.message}`, 'error');
    }
}

// 読み出し
async function loadPagesFromCloud() {
    if (!currentUser) return [];
    try {
        const { data, error } = await supabaseClient
            .from('pages')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('saved_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(item => ({
            id: item.id,
            url: item.url,
            title: item.title,
            favicon: item.favicon,
            domain: item.domain,
            excerpt: item.excerpt,
            tags: item.tags || [],
            read: item.read,
            savedAt: item.saved_at
        }));
    } catch (e) {
        console.error('Cloud load failed:', e.message);
        if (window.showToast) window.showToast(`データ取得エラー: ${e.message}`, 'error');
        return [];
    }
}

// 削除
async function deletePageFromCloud(pageId) {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient.from('pages').delete().eq('id', pageId).eq('user_id', currentUser.id);
        if (error) throw error;
    } catch (e) {
        console.error('Cloud delete failed:', e.message);
    }
}

// 更新
async function updatePageInCloud(pageId, updates) {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient.from('pages').update(updates).eq('id', pageId).eq('user_id', currentUser.id);
        if (error) throw error;
    } catch (e) {
        console.error('Cloud update failed:', e.message);
    }
}

// --- 同期ロジック ---

let realtimeChannel = null;

async function syncData() {
    if (!currentUser) return;
    try {
        console.log('Syncing data for user:', currentUser.email);

        // 1. クラウドから取得
        const cloudPages = await loadPagesFromCloud();

        // 2. ローカルから取得
        const localPages = JSON.parse(localStorage.getItem('readlater_pages') || '[]');

        // 3. マージ
        const pageMap = new Map();
        // クラウド側を優先
        cloudPages.forEach(p => pageMap.set(p.id, p));

        // 4. ローカルにしか存在しないものをクラウドに上げる
        for (const p of localPages) {
            if (!pageMap.has(p.id)) {
                await savePageToCloud(p);
                pageMap.set(p.id, p);
            }
        }

        const finalPages = Array.from(pageMap.values()).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        // リアルタイム購読開始
        subscribeToChanges();

        return finalPages;
    } catch (e) {
        console.error('Sync failed:', e);
        return JSON.parse(localStorage.getItem('readlater_pages') || '[]');
    }
}

// リアルタイム購読
function subscribeToChanges() {
    if (!currentUser) return;
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    console.log('Starting Realtime subscription...');
    realtimeChannel = supabaseClient
        .channel('public:pages')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'pages',
            filter: `user_id=eq.${currentUser.id}`
        }, async (payload) => {
            console.log('Realtime change received:', payload.eventType);

            // 最新データを再取得して UIを更新
            const updatedPages = await loadPagesFromCloud();
            if (typeof window.updateAllPages === 'function') {
                window.updateAllPages(updatedPages);
                localStorage.setItem('readlater_pages', JSON.stringify(updatedPages));
            }
        })
        .subscribe();
}

// サインイン時
async function onSignIn() {
    console.log('Handling Sign In UI and Sync...');
    // UIは既に onAuthStateChange で更新されているはずだが、念のため
    updateAuthUI();

    try {
        const syncedPages = await syncData();
        if (syncedPages && typeof window.updateAllPages === 'function') {
            // タグを配列に正規化（古いデータとの互換性）
            const normalizedPages = syncedPages.map(page => ({
                ...page,
                tags: Array.isArray(page.tags) ? page.tags : []
            }));
            window.updateAllPages(normalizedPages);
            localStorage.setItem('readlater_pages', JSON.stringify(normalizedPages));
        }
    } catch (e) {
        console.error('Sync error in onSignIn:', e);
    }
}

// サインアウト時
function onSignOut() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    updateAuthUI();
}

// UI更新
function updateAuthUI() {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (currentUser) {
        const avatar = currentUser.user_metadata?.avatar_url || '';
        const name = currentUser.user_metadata?.full_name || currentUser.email;

        container.innerHTML = `
            <div class="user-info">
                ${avatar ? `<img src="${avatar}" class="user-avatar" alt="avatar">` : '<div class="user-avatar-placeholder"></div>'}
                <span class="user-name">${name}</span>
                <button class="btn-signout" onclick="signOut()">ログアウト</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="btn-signin" onclick="signInWithGoogle()">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Googleログイン
            </button>
        `;
    }
}
