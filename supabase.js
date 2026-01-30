// Supabase Client
// CDN版を使用（ビルドツール不要）

// 環境変数
const SUPABASE_URL = 'https://sreimiuxlfqlifkrlwhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZWltaXV4bGZxbGlma3Jsd2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNDY1MzksImV4cCI6MjA1MjYyMjUzOX0.Gq3S_bYERVzstLPgNNDQExh-dMqLf7sTkjrFN-rJXuk';

// Supabaseクライアント作成
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 現在のユーザー
let currentUser = null;
let supabaseInitialized = false;

// 初期化関数
async function initializeSupabase() {
    if (supabaseInitialized) return;
    supabaseInitialized = true;

    console.log('Supabase Initializing...');

    // 認証状態の監視
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state change event:', event);
        currentUser = session?.user ?? null;

        updateAuthUI();

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                // URLのハッシュを消去
                if (window.location.hash) {
                    window.history.replaceState(null, null, window.location.pathname);
                }
                onSignIn();
            }
        } else if (event === 'SIGNED_OUT') {
            onSignOut();
        }
    });

    // 強制的なセッションチェック
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            await onSignIn();
        }
    } catch (e) {
        console.warn('Initial session check failed:', e);
    }

    updateAuthUI();
}

// すぐに初期化（DOMContentLoadedを待たない）
initializeSupabase();

// Googleログイン
async function signInWithGoogle() {
    try {
        console.log('Redirecting to Google Login...');
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
    } catch (e) {
        console.error('Cloud save failed:', e.message);
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
            window.updateAllPages(syncedPages);
            localStorage.setItem('readlater_pages', JSON.stringify(syncedPages));
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
