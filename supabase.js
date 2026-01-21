// Supabase Client
// CDN版を使用（ビルドツール不要）

// 環境変数（実際の値に設定済み）
const SUPABASE_URL = 'https://sreimiuxlfqlifkrlwhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZWltaXV4bGZxbGlma3Jsd2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNDY1MzksImV4cCI6MjA1MjYyMjUzOX0.Gq3S_bYERVzstLPgNNDQExh-dMqLf7sTkjrFN-rJXuk';

// Supabaseクライアント作成
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 現在のユーザー
let currentUser = null;

// 初期化フラグ
let supabaseInitialized = false;

// Supabase初期化関数
function initializeSupabase() {
    if (supabaseInitialized) return;
    supabaseInitialized = true;

    // 認証状態の変更を監視
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user ?? null;

        if (event === 'SIGNED_IN') {
            console.log('Signed in:', currentUser);
            onSignIn();
        } else if (event === 'SIGNED_OUT') {
            console.log('Signed out');
            onSignOut();
        }
    });

    // 初期化時にセッションをチェック
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            onSignIn();
        }
        updateAuthUI();
    });
}

// サインイン処理
async function signInWithGoogle() {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin // 現在のURL（VercelならVercel、ローカルならローカル）に自動で合わせる
            }
        });

        if (error) throw error;
    } catch (error) {
        console.error('Error signing in:', error.message);
        showToast('ログインエラーが発生しました', 'error');
    }
}

// サインアウト処理
async function signOut() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        showToast('ログアウトしました', 'success');
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('ログアウトに失敗しました', 'error');
    }
}

// ページを保存（Supabase版）
async function savePageToCloud(page) {
    if (!currentUser) return false;

    try {
        const { data, error } = await supabaseClient
            .from('pages')
            .upsert({
                id: page.id,
                user_id: currentUser.id,
                url: page.url,
                title: page.title,
                favicon: page.favicon,
                domain: page.domain,
                excerpt: page.excerpt,
                tags: page.tags || [],
                is_read: page.read || false,
                saved_at: page.savedAt || new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Save error:', error);
        return false;
    }
}

// ページを取得（Supabase版）
async function loadPagesFromCloud() {
    if (!currentUser) return [];

    try {
        const { data, error } = await supabaseClient
            .from('pages')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('saved_at', { ascending: false });

        if (error) throw error;

        // DB形式からアプリ形式に変換
        return (data || []).map(item => ({
            id: item.id,
            url: item.url,
            title: item.title,
            favicon: item.favicon,
            domain: item.domain,
            excerpt: item.excerpt,
            tags: item.tags || [],
            read: item.is_read,
            savedAt: item.saved_at
        }));
    } catch (error) {
        console.error('Load error:', error);
        return [];
    }
}

// ページを削除（Supabase版）
async function deletePageFromCloud(pageId) {
    if (!currentUser) {
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('pages')
            .delete()
            .eq('id', pageId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete error:', error);
        showToast('削除に失敗しました', 'error');
        return false;
    }
}

// ページを更新（Supabase版）
async function updatePageInCloud(pageId, updates) {
    if (!currentUser) {
        return false;
    }

    try {
        const { error } = await supabase
            .from('pages')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', pageId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Update error:', error);
        showToast('更新に失敗しました', 'error');
        return false;
    }
}

// ローカルとクラウドを同期
async function syncData() {
    if (!currentUser) {
        // ログインしていない場合はローカルストレージのみ使用
        return;
    }

    try {
        // クラウドからデータを取得
        const cloudPages = await loadPagesFromCloud();

        // ローカルデータを取得
        const localPages = JSON.parse(localStorage.getItem('readlater_pages') || '[]');

        // マージ（クラウドを優先）
        const pageMap = new Map();

        // ローカルデータを追加
        localPages.forEach(page => {
            pageMap.set(page.id, page);
        });

        // クラウドデータで上書き
        cloudPages.forEach(page => {
            pageMap.set(page.id, page);
        });

        // ローカルにのみ存在するデータをクラウドにアップロード
        for (const page of localPages) {
            if (!cloudPages.find(p => p.id === page.id)) {
                await savePageToCloud(page);
            }
        }

        // マージされたデータを返す
        return Array.from(pageMap.values())
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    } catch (error) {
        console.error('Sync error:', error);
        return [];
    }
}

// サインイン時の処理
async function onSignIn() {
    console.log('Starting data sync...');
    // データを同期
    const syncedPages = await syncData();

    // グローバルのallPagesを更新
    if (window.allPages !== undefined) {
        window.allPages = syncedPages;
        allPages = syncedPages; // ローカル変数が存在する場合のフォールバック
    }

    if (typeof window.savePages === 'function') {
        await window.savePages(); // ローカルにも保存
    }

    if (typeof window.renderCurrentView === 'function') {
        window.renderCurrentView();
    }

    // UIを更新
    updateAuthUI();
}

// サインアウト時の処理
function onSignOut() {
    // ローカルデータのみ使用
    loadPages();
    updateAuthUI();
}

// 認証UIを更新
function updateAuthUI() {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer) return;

    if (currentUser) {
        authContainer.innerHTML = `
      <div class="user-info">
        <img src="${currentUser.user_metadata.avatar_url || ''}" alt="Avatar" class="user-avatar">
        <span class="user-name">${currentUser.user_metadata.full_name || currentUser.email}</span>
        <button class="btn-signout" onclick="signOut()">ログアウト</button>
      </div>
    `;
    } else {
        authContainer.innerHTML = `
      <button class="btn-signin" onclick="signInWithGoogle()">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Googleでログイン
      </button>
    `;
    }
}
