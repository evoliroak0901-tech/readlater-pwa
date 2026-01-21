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
function initializeSupabase() {
    if (supabaseInitialized) return;
    supabaseInitialized = true;

    // 認証状態の監視
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user ?? null;
        console.log('Auth event:', event, currentUser?.email);

        if (event === 'SIGNED_IN') {
            onSignIn();
        } else if (event === 'SIGNED_OUT') {
            onSignOut();
        }
    });

    // 初期セッションチェック
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            onSignIn();
        } else {
            updateAuthUI();
        }
    });
}

// Googleログイン
async function signInWithGoogle() {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Login error:', error);
    }
}

// ログアウト
async function signOut() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// --- CRUD操作 ---

// 保存
async function savePageToCloud(page) {
    if (!currentUser) return;
    try {
        await supabaseClient.from('pages').upsert({
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
    } catch (e) {
        console.error('Cloud save error:', e);
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
        console.error('Cloud load error:', e);
        return [];
    }
}

// 削除
async function deletePageFromCloud(pageId) {
    if (!currentUser) return;
    try {
        await supabaseClient.from('pages').delete().eq('id', pageId).eq('user_id', currentUser.id);
    } catch (e) {
        console.error('Cloud delete error:', e);
    }
}

// 更新
async function updatePageInCloud(pageId, updates) {
    if (!currentUser) return;
    try {
        await supabaseClient.from('pages').update(updates).eq('id', pageId).eq('user_id', currentUser.id);
    } catch (e) {
        console.error('Cloud update error:', e);
    }
}

// --- 同期ロジック ---

async function syncData() {
    if (!currentUser) return;
    console.log('Syncing data...');

    // 1. クラウドから最新取得
    const cloudPages = await loadPagesFromCloud();

    // 2. ローカル取得
    const localPages = JSON.parse(localStorage.getItem('readlater_pages') || '[]');

    // 3. マージ
    const pageMap = new Map();
    localPages.forEach(p => pageMap.set(p.id, p));
    cloudPages.forEach(p => pageMap.set(p.id, p)); // クラウド優先

    // 4. 未保存分をクラウドへ
    for (const p of localPages) {
        if (!cloudPages.find(cp => cp.id === p.id)) {
            await savePageToCloud(p);
        }
    }

    const finalPages = Array.from(pageMap.values()).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return finalPages;
}

// サインイン時
async function onSignIn() {
    const syncedPages = await syncData();
    if (syncedPages && typeof window.updateAllPages === 'function') {
        window.updateAllPages(syncedPages);
        localStorage.setItem('readlater_pages', JSON.stringify(syncedPages));
    }
    updateAuthUI();
}

// サインアウト時
function onSignOut() {
    updateAuthUI();
}

// UI更新
function updateAuthUI() {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <div class="user-info">
                <img src="${currentUser.user_metadata.avatar_url || ''}" class="user-avatar" alt="avatar">
                <span class="user-name">${currentUser.user_metadata.full_name || currentUser.email}</span>
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
