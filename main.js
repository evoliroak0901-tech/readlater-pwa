// Side Panel JavaScript

let allPages = [];
let currentTab = 'all';
let searchQuery = '';

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    // グローバルにセッター関数とデータを公開
    window.updateAllPages = (newPages) => {
        allPages = newPages;
        window.allPages = allPages;
        renderCurrentView();
    };

    await loadPages();
    setupEventListeners();
    renderCurrentView();

    // Supabase初期化（supabase.jsで定義）
    if (typeof initializeSupabase === 'function') {
        initializeSupabase();
    }

    // Web Share Target / URLパラメータの処理（シェアメニューからの登録など）
    // 少し待機してから実行することで初期化完了を確実にする
    setTimeout(handleShareTarget, 500);
});

// Web Share Target / URLパラメータの処理
async function handleShareTarget() {
    let search = window.location.search;

    // iOSショートカットなどで ? が抜けて /url=... になっている場合の救済処置
    if (!search && window.location.pathname.includes('url=')) {
        search = '?' + window.location.pathname.split('/').pop();
    }

    const params = new URLSearchParams(search);
    const sharedUrl = params.get('url');
    const sharedText = params.get('text');
    const sharedTitle = params.get('title');
    const action = params.get('action');

    if (sharedUrl || sharedText || sharedTitle || action) {
        console.log('Share parameters detected:', { sharedUrl, sharedText, sharedTitle, action });
    }

    // シェアされたURLまたはテキストがある場合、自動保存を試みる
    if (sharedUrl || sharedText) {
        const sourceUrl = sharedUrl || sharedText;
        let sourceTitle = sharedTitle || '';

        // タイトルがエンコードされている場合があるため、復元を試みる
        try {
            if (sourceTitle && sourceTitle.includes('%')) {
                sourceTitle = decodeURIComponent(sourceTitle);
            }
        } catch (e) {
            console.warn('Title decoding failed:', e);
        }

        console.log('Attempting auto-save from share:', sourceUrl);
        showToast('保存しています...', 'info');

        // URLパラメータを消去して履歴を綺麗にする
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            // 保存処理
            await handleExternalSave(sourceUrl, sourceTitle);
        } catch (e) {
            console.error('Auto-save error:', e);
            showToast('自動保存中にエラーが発生しました', 'error');
        }
    } else if (action === 'add') {
        // ショートカット「新しく追加」など
        window.history.replaceState({}, document.title, window.location.pathname);
        openDialog();
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // 検索
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderCurrentView();
    });

    // ダイアログ関連
    const addBtn = document.getElementById('addBtn');
    const dialogClose = document.getElementById('dialogClose');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const dialogOverlay = document.getElementById('dialogOverlay');

    if (addBtn) addBtn.addEventListener('click', openDialog);
    if (dialogClose) dialogClose.addEventListener('click', closeDialog);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);
    if (saveBtn) saveBtn.addEventListener('click', saveNewPage);
    if (dialogOverlay) {
        dialogOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'dialogOverlay') {
                closeDialog();
            }
        });
    }

    // 設定ダイアログ関連
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsDialog = document.getElementById('settingsDialog');

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettings);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    if (settingsDialog) {
        settingsDialog.addEventListener('click', (e) => {
            if (e.target.id === 'settingsDialog') {
                closeSettings();
            }
        });
    }
}

// ページデータ読み込み (LocalStorage使用)
async function loadPages() {
    const stored = localStorage.getItem('readlater_pages');
    allPages = stored ? JSON.parse(stored) : [];

    // タグを配列に正規化（古いデータとの互換性）
    allPages = allPages.map(page => ({
        ...page,
        tags: Array.isArray(page.tags) ? page.tags : [],
        sns: page.sns || detectSNS(page.url)
    }));

    updateCounts();
}

// ページデータ保存
async function savePages() {
    localStorage.setItem('readlater_pages', JSON.stringify(allPages));
    window.allPages = allPages; // 同期用にグローバルも更新
}

// タブ切り替え
function switchTab(tabName) {
    currentTab = tabName;

    // タブのアクティブ状態更新
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // ビューの表示切り替え
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${tabName}View`).classList.add('active');

    renderCurrentView();
}

// 現在のビューをレンダリング
function renderCurrentView() {
    switch (currentTab) {
        case 'all':
            renderAllPages();
            break;
        case 'unread':
            renderUnreadPages();
            break;
        case 'sites':
            renderSitesView();
            break;
        case 'tags':
            renderTagsView();
            break;
        case 'sns':
            renderSNSView();
            break;
    }

    updateCounts();
    toggleEmptyState();
}

// すべてのページを表示
function renderAllPages() {
    const container = document.getElementById('allItems');
    const filteredPages = filterPages(allPages);
    container.innerHTML = filteredPages.map(page => createPageItemHTML(page)).join('');
    attachPageItemListeners(container);
}

// 未読ページを表示
function renderUnreadPages() {
    const container = document.getElementById('unreadItems');
    const unreadPages = filterPages(allPages.filter(p => !p.read));
    container.innerHTML = unreadPages.map(page => createPageItemHTML(page)).join('');
    attachPageItemListeners(container);
}

// サイト別ビューを表示
function renderSitesView() {
    const container = document.getElementById('sitesGrid');
    const siteMap = new Map();

    allPages.forEach(page => {
        const count = siteMap.get(page.domain) || 0;
        siteMap.set(page.domain, count + 1);
    });

    const sites = Array.from(siteMap.entries())
        .map(([domain, count]) => ({
            domain,
            count,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            pages: allPages.filter(p => p.domain === domain)
        }))
        .sort((a, b) => b.count - a.count);

    container.innerHTML = sites.map(site => `
    <div class="site-card" data-domain="${site.domain}">
      <div class="site-icon">
        <img src="${site.favicon}" alt="${site.domain}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23475569%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'">
      </div>
      <div class="site-name" title="${site.domain}">${site.domain}</div>
      <div class="site-count">${site.count}件</div>
    </div>
  `).join('');

    // サイトカードクリックで該当ページを表示
    container.querySelectorAll('.site-card').forEach(card => {
        card.addEventListener('click', () => {
            const domain = card.dataset.domain;
            searchQuery = domain;
            document.getElementById('searchInput').value = domain;
            switchTab('all');
        });
    });
}

// タグ別ビューを表示
function renderTagsView() {
    const container = document.getElementById('tagsCloud');
    const tagMap = new Map();

    allPages.forEach(page => {
        page.tags.forEach(tag => {
            const count = tagMap.get(tag) || 0;
            tagMap.set(tag, count + 1);
        });
    });

    const tags = Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

    container.innerHTML = tags.map(({ tag, count }) => `
    <div class="tag-cloud-item" data-tag="${tag}">
      <span class="tag-cloud-label">${tag}</span>
      <span class="tag-cloud-count">${count}</span>
    </div>
  `).join('');

    // タグクリックで該当ページを表示
    container.querySelectorAll('.tag-cloud-item').forEach(item => {
        item.addEventListener('click', () => {
            const tag = item.dataset.tag;
            searchQuery = tag;
            document.getElementById('searchInput').value = tag;
            switchTab('all');
        });
    });
}

// SNS別ビューを表示
function renderSNSView() {
    const container = document.getElementById('snsGrid');
    const snsMap = new Map();

    allPages.forEach(page => {
        const snsKey = page.sns?.name || 'その他';
        const count = snsMap.get(snsKey) || 0;
        snsMap.set(snsKey, count + 1);
    });

    const snsList = Array.from(snsMap.entries())
        .map(([name, count]) => {
            const snsInfo = SNS_PLATFORMS.find(p => p.name === name) || {
                name: 'その他',
                icon: '🔗',
                color: '#475569'
            };
            return { ...snsInfo, count };
        })
        .sort((a, b) => b.count - a.count);

    container.innerHTML = snsList.map(sns => `
    <div class="sns-card" data-sns="${sns.name}">
      <div class="sns-icon" style="background-color: ${sns.color}">
        ${sns.icon}
      </div>
      <div class="sns-name">${sns.name}</div>
      <div class="sns-count">${sns.count}件</div>
    </div>
  `).join('');

    // SNSカードクリックで該当ページを表示
    container.querySelectorAll('.sns-card').forEach(card => {
        card.addEventListener('click', () => {
            const snsName = card.dataset.sns;
            searchQuery = snsName;
            document.getElementById('searchInput').value = snsName;
            switchTab('all');
        });
    });
}

// ページアイテムのHTML生成
function createPageItemHTML(page) {
    const date = new Date(page.savedAt);
    const timeAgo = getTimeAgo(date);

    return `
    <div class="page-item ${page.read ? 'read' : ''}" data-id="${page.id}">
      <div class="page-header">
        <div class="page-favicon">
          <img src="${page.favicon}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23475569%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'">
        </div>
        <div class="page-info">
          <div class="page-title">${escapeHtml(page.title)}</div>
          <div class="page-domain">${page.domain}</div>
        </div>
      </div>
      <div class="page-meta">
        <div class="page-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${timeAgo}
        </div>
        <div class="page-tags">
          ${(Array.isArray(page.tags) ? page.tags : []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="page-actions">
          <button class="page-action mark-read" title="${page.read ? '未読にする' : '既読にする'}">
            <svg viewBox="0 0 24 24" fill="${page.read ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
          </button>
          <button class="page-action delete" title="削除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ページアイテムのイベントリスナー設定
function attachPageItemListeners(container) {
    container.querySelectorAll('.page-item').forEach(item => {
        const pageId = item.dataset.id;
        const page = allPages.find(p => p.id === pageId);

        if (!page) return;

        // ページクリックで開く
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.page-action')) {
                if (page.url) {
                    window.open(page.url, '_blank');
                    markAsRead(pageId);
                }
            }
        });

        // 既読/未読トグル
        const markReadBtn = item.querySelector('.mark-read');
        markReadBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRead(pageId);
        });

        // 削除
        const deleteBtn = item.querySelector('.delete');
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePage(pageId);
        });
    });
}

// ページをフィルタリング
function filterPages(pages) {
    if (!searchQuery) return pages;

    return pages.filter(page => {
        const searchText = `${page.title} ${page.domain} ${page.tags.join(' ')} ${page.sns?.name || ''}`.toLowerCase();
        return searchText.includes(searchQuery);
    });
}

// 既読マーク
async function markAsRead(pageId) {
    const page = allPages.find(p => p.id === pageId);
    if (page) {
        page.read = true;
        await savePages();
        renderCurrentView();
    }
}

// 既読/未読トグル
async function toggleRead(pageId) {
    const page = allPages.find(p => p.id === pageId);
    if (page) {
        page.read = !page.read;
        await savePages();
        renderCurrentView();

        // クラウド同期
        if (typeof updatePageInCloud === 'function') {
            await updatePageInCloud(pageId, { read: page.read }); // readに修正
        }
    }
}

// ページ削除
async function deletePage(pageId) {
    if (!confirm('このページを削除しますか？')) return;

    allPages = allPages.filter(p => p.id !== pageId);
    await savePages();
    renderCurrentView();
    showToast('ページを削除しました');

    // クラウド同期
    if (typeof deletePageFromCloud === 'function') {
        await deletePageFromCloud(pageId);
    }
}

// カウント更新
function updateCounts() {
    const total = allPages.length;
    const unread = allPages.filter(p => !p.read).length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('allCount').textContent = total;
    document.getElementById('unreadCount').textContent = unread;
}

// 空の状態を表示/非表示
function toggleEmptyState() {
    const isEmpty = allPages.length === 0;
    const emptyState = document.getElementById('emptyState');

    if (isEmpty) {
        emptyState.classList.add('show');
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
    } else {
        emptyState.classList.remove('show');
        document.querySelectorAll('.view').forEach(view => view.style.display = '');
    }
}

// 相対時間取得
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = {
        年: 31536000,
        ヶ月: 2592000,
        週間: 604800,
        日: 86400,
        時間: 3600,
        分: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval}${unit}前`;
        }
    }

    return 'たった今';
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// トースト通知
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast ' + type;

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ダイアログ開く
function openDialog() {
    const dialogOverlay = document.getElementById('dialogOverlay');
    if (dialogOverlay) {
        dialogOverlay.classList.add('show');
        const urlInput = document.getElementById('urlInput');
        if (urlInput) urlInput.focus();
    }
}

// ダイアログ閉じる
function closeDialog() {
    const dialogOverlay = document.getElementById('dialogOverlay');
    if (dialogOverlay) {
        dialogOverlay.classList.remove('show');
        document.getElementById('urlInput').value = '';
        document.getElementById('titleInput').value = '';
        document.getElementById('noteInput').value = '';
    }
}

// 設定ダイアログを開く
function openSettings() {
    const settingsDialog = document.getElementById('settingsDialog');
    const geminiApiKey = document.getElementById('geminiApiKey');

    // 既存のAPIキーを読み込み
    const savedKey = localStorage.getItem('gemini_api_key');
    if (geminiApiKey && savedKey) {
        geminiApiKey.value = savedKey;
    }

    if (settingsDialog) {
        settingsDialog.classList.add('show');
    }
}

// 設定ダイアログを閉じる
function closeSettings() {
    const settingsDialog = document.getElementById('settingsDialog');
    if (settingsDialog) {
        settingsDialog.classList.remove('show');
        document.getElementById('geminiApiKey').value = '';
    }
}

// 設定を保存
function saveSettings() {
    const apiKey = document.getElementById('geminiApiKey').value.trim();

    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
        showToast('設定を保存しました✨', 'success');
    } else {
        localStorage.removeItem('gemini_api_key');
        showToast('APIキーを削除しました', 'success');
    }

    closeSettings();
}

// 新しいページ保存
async function saveNewPage() {
    const urlInput = document.getElementById('urlInput').value.trim();
    const titleInput = document.getElementById('titleInput').value.trim();
    const noteInput = document.getElementById('noteInput').value.trim();

    if (!urlInput) {
        showToast('URLまたはタイトルを入力してください', 'error');
        return;
    }

    // テキストからURLを抽出（TikTokなどのシェア対策）
    const extractedUrl = extractUrl(urlInput);
    const finalUrlInput = extractedUrl || urlInput;

    // 重複チェック
    if (finalUrlInput && finalUrlInput.match(/^https?:\/\//)) {
        const normalizedInput = normalizeUrl(finalUrlInput);
        const isGenericFeed = isGenericSnsFeed(finalUrlInput);

        if (!isGenericFeed && allPages.some(p => p.url && normalizeUrl(p.url) === normalizedInput)) {
            showToast('すでに保存されています', 'info');
            closeDialog();
            return;
        }
    }

    let url = '';
    let title = titleInput;
    let domain = '';
    let favicon = '';

    if (finalUrlInput.match(/^https?:\/\//)) {
        url = finalUrlInput;
        try {
            const urlObj = new URL(url);
            domain = urlObj.hostname;
            favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            if (!title) title = domain;
        } catch (e) {
            console.error('Invalid URL:', e);
        }
    } else {
        title = finalUrlInput;
    }

    const snsInfo = detectSNS(url);

    const page = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: url,
        title: title || 'Untitled',
        favicon: favicon,
        domain: domain,
        excerpt: noteInput,
        sns: snsInfo,
        tags: await generateTags(title, url, noteInput),
        read: false,
        savedAt: new Date().toISOString()
    };

    allPages.unshift(page);
    await savePages();

    // クラウド同期
    if (typeof savePageToCloud === 'function') {
        await savePageToCloud(page);
    }

    renderCurrentView();
    closeDialog();
    setTimeout(() => showToast('保存しました✨', 'success'), 100);
}

// タグ生成（AI + ドメインベース）
async function generateTags(title, url, excerpt) {
    const tags = [];

    if (!url) {
        tags.push('メモ');
        return tags;
    }

    // ドメインベースのタグを先に取得
    try {
        const domain = new URL(url).hostname;
        const domainTags = {
            'github.com': ['開発', 'GitHub'],
            'youtube.com': ['動画', 'YouTube'],
            'youtu.be': ['動画', 'YouTube'],
            'twitter.com': ['SNS', 'Twitter'],
            'x.com': ['SNS', 'X'],
            't.co': ['SNS', 'X'],
            'tiktok.com': ['動画', 'SNS', 'TikTok'],
            'instagram.com': ['SNS', 'Instagram'],
            'facebook.com': ['SNS', 'Facebook'],
            'qiita.com': ['技術記事', 'Qiita'],
            'zenn.dev': ['技術記事', 'Zenn'],
            'note.com': ['ブログ', 'Note'],
            'medium.com': ['ブログ', 'Medium'],
            'reddit.com': ['SNS', 'Reddit'],
            'stackoverflow.com': ['開発', 'Q&A'],
            'amazon.co.jp': ['ショッピング'],
            'amazon.com': ['ショッピング'],
            'netflix.com': ['動画', 'Netflix'],
            'spotify.com': ['音楽', 'Spotify'],
            // レシピサイト
            'cookpad.com': ['レシピ', '料理'],
            'kurashiru.com': ['レシピ', '料理'],
            'delishkitchen.tv': ['レシピ', '料理'],
            'recipe.rakuten.co.jp': ['レシピ', '料理'],
            'erecipe.woman.excite.co.jp': ['レシピ', '料理'],
            'allrecipes.jp': ['レシピ', '料理'],
            // グルメ・スポット
            'tabelog.com': ['グルメ', 'スポット'],
            'gurunavi.com': ['グルメ', 'スポット'],
            'hotpepper.jp': ['グルメ', 'スポット'],
            'retty.me': ['グルメ', 'スポット'],
            'jalan.net': ['旅行', 'スポット'],
            'tripadvisor.jp': ['旅行', 'スポット'],
            'booking.com': ['旅行', 'ホテル'],
            'airbnb.com': ['旅行', '宿泊'],
            'google.com/maps': ['地図', 'スポット']
        };

        for (const [key, value] of Object.entries(domainTags)) {
            if (domain.includes(key)) {
                tags.push(...value);
                break;
            }
        }
    } catch (e) {
        console.error('Domain tag generation error:', e);
    }

    // AI タグ生成を試みる（ユーザーのAPIキーを使用）
    try {
        const apiKey = localStorage.getItem('gemini_api_key');

        if (!apiKey) {
            console.log('ℹ️ Gemini API key not set, using domain tags only');
            if (tags.length === 0) {
                tags.push('未分類');
            }
            return [...new Set(tags)];
        }

        const prompt = `以下のWebページの情報から、適切なタグを3-5個、日本語で生成してください。
タグはカンマ区切りで出力してください。タグのみを出力し、他の説明は不要です。

タイトル: ${title || '不明'}
URL: ${url || '不明'}
${excerpt ? `内容: ${excerpt}` : ''}

タグ:`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100,
                    }
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // タグを抽出（カンマ区切り）
            const aiTags = generatedText
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0 && tag.length < 20)
                .slice(0, 5);

            if (aiTags.length > 0) {
                console.log('✨ AI generated tags:', aiTags);
                tags.push(...aiTags);
            }
        } else {
            console.warn('AI tag generation failed, using domain tags only');
        }
    } catch (e) {
        console.warn('AI tag generation error:', e);
        // エラー時はドメインタグのみ使用
    }

    if (tags.length === 0) {
        tags.push('未分類');
    }
    // 重複を削除して返す
    return [...new Set(tags)];
}

// URLから記事のメタデータ（タイトル、画像、抜粋）を自動取得
async function fetchPageMetadata(url) {
    try {
        showToast('記事情報を取得中...', 'info');

        // CORSを回避するため、プロキシAPIを使用
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            console.warn('Failed to fetch page metadata');
            return { title: null, image: null, excerpt: null };
        }

        const data = await response.json();
        const html = data.contents;

        // タイトルを抽出（優先順位: og:title > twitter:title > title タグ）
        let title = null;
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
        if (ogTitleMatch) title = ogTitleMatch[1];

        if (!title) {
            const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i);
            if (twitterTitleMatch) title = twitterTitleMatch[1];
        }

        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch) title = titleMatch[1].trim();
        }

        // 画像を抽出（優先順位: og:image > twitter:image）
        let image = null;
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
        if (ogImageMatch) image = ogImageMatch[1];

        if (!image) {
            const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i);
            if (twitterImageMatch) image = twitterImageMatch[1];
        }

        // 記事の抜粋を取得（優先順位: og:description > meta description）
        let excerpt = null;
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
        if (ogDescMatch) excerpt = ogDescMatch[1];

        if (!excerpt) {
            const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
            if (metaDescMatch) excerpt = metaDescMatch[1];
        }

        // 本文の一部を抽出（AIタグ生成用）
        if (!excerpt) {
            // <p>タグから最初の段落を取得
            const paragraphMatch = html.match(/<p[^>]*>([^<]{50,300})</i);
            if (paragraphMatch) {
                excerpt = paragraphMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200);
            }
        }

        console.log('✨ Fetched metadata:', { title, image: image ? '(found)' : '(none)', excerpt: excerpt ? excerpt.substring(0, 50) + '...' : '(none)' });

        return { title, image, excerpt };
    } catch (e) {
        console.error('Error fetching page metadata:', e);
        return { title: null, image: null, excerpt: null };
    }
}

// ---------------------------------------------------------
// Extension Bridge Interface
// ---------------------------------------------------------

// Extensionからのメッセージ受信
window.addEventListener('message', async (event) => {
    // 必要であればここで event.origin をチェック
    console.log('Message received from extension:', event.data);

    if (event.data.type === 'SAVE_PAGE_REQUEST') {
        const { url, title, favicon } = event.data.payload;

        // 保存処理を実行
        await handleExternalSave(url, title, favicon);

        // 完了応答を返す
        if (event.source) {
            event.source.postMessage({ type: 'PAGE_SAVED_SUCCESS' }, event.origin);
        }
    }

    // セッション注入（Extensionからの同期）
    if (event.data.type === 'INJECT_SESSION' && event.data.sessionStr) {
        console.log('Received session from extension, applying...');
        try {
            // Supabaseのキーを探す（または固定）- プロジェクトID変更時はここを確認
            const keySearch = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
            const key = keySearch || 'sb-sreimiuxlfqlifkrlwhv-auth-token';

            if (localStorage.getItem(key) !== event.data.sessionStr) {
                localStorage.setItem(key, event.data.sessionStr);
                showToast('ログイン情報を同期しました。リロードします...', 'success');
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (e) {
            console.error('Session injection failed:', e);
        }
    }
});

// 外部からの保存リクエスト処理
async function handleExternalSave(url, title, favicon) {
    if (!url) return;

    // テキストからURLを抽出
    const finalUrl = extractUrl(url) || url;

    // 重複チェック
    if (finalUrl && finalUrl.match(/^https?:\/\//)) {
        const normalizedInput = normalizeUrl(finalUrl);
        const isGenericFeed = isGenericSnsFeed(finalUrl);

        if (!isGenericFeed && allPages.some(p => p.url && normalizeUrl(p.url) === normalizedInput)) {
            showToast('すでに保存されています', 'info');
            return;
        }
    }

    // タイトル・画像・抜粋が提供されていない場合、自動取得を試みる
    let finalTitle = title;
    let finalImage = favicon;
    let finalExcerpt = '';

    if (!finalTitle || finalTitle === 'Untitled') {
        const metadata = await fetchPageMetadata(finalUrl);
        if (metadata.title) {
            finalTitle = metadata.title;
            console.log('✨ Auto-fetched title:', metadata.title);
        }
        if (metadata.image && !finalImage) {
            finalImage = metadata.image;
            console.log('✨ Auto-fetched image:', metadata.image);
        }
        if (metadata.excerpt) {
            finalExcerpt = metadata.excerpt;
            console.log('✨ Auto-fetched excerpt:', metadata.excerpt.substring(0, 50) + '...');
        }
    }

    // ドメイン抽出
    let domain = '';
    try {
        domain = new URL(finalUrl).hostname;
    } catch (e) {
        domain = 'unknown';
    }

    const snsInfo = detectSNS(finalUrl);

    const page = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: finalUrl,
        title: finalTitle || 'Untitled',
        favicon: finalImage || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        domain: domain,
        excerpt: finalExcerpt,
        sns: snsInfo,
        tags: await generateTags(finalTitle, finalUrl, finalExcerpt),
        read: false,
        savedAt: new Date().toISOString()
    };

    // リストの先頭に追加
    allPages.unshift(page);
    await savePages();
    renderCurrentView();
    showToast('保存しました！', 'success');

    // クラウド同期
    if (typeof savePageToCloud === 'function') {
        await savePageToCloud(page);
    }
}

// ---------------------------------------------------------
// SNSヘルパー関数
// ---------------------------------------------------------

const SNS_PLATFORMS = [
    { name: 'TikTok', icon: '🎵', color: '#000000', domains: ['tiktok.com'] },
    { name: 'X', icon: '𝕏', color: '#000000', domains: ['x.com', 'twitter.com', 't.co'] },
    { name: 'Instagram', icon: '📷', color: '#E4405F', domains: ['instagram.com'] },
    { name: 'YouTube', icon: '▶️', color: '#FF0000', domains: ['youtube.com', 'youtu.be'] },
    { name: 'GitHub', icon: '🐙', color: '#181717', domains: ['github.com'] },
    { name: 'Note', icon: '📝', color: '#41C9B4', domains: ['note.com'] },
    { name: 'Medium', icon: 'Ⓜ️', color: '#000000', domains: ['medium.com'] },
    { name: 'Qiita', icon: '📚', color: '#55C500', domains: ['qiita.com'] },
    { name: 'Zenn', icon: '⚡', color: '#3EA8FF', domains: ['zenn.dev'] }
];

function detectSNS(url) {
    if (!url) return null;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const platform = SNS_PLATFORMS.find(p => p.domains.some(d => hostname.includes(d)));
        return platform ? { name: platform.name, icon: platform.icon, color: platform.color } : null;
    } catch (e) {
        return null;
    }
}

function extractUrl(text) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

function normalizeUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        // トラッキングパラメータの削除
        const paramsToRemove = ['_t', '_r', 'is_from_webapp', 'sender_device', 'share_app_id', 'share_link_id', 'share_item_id', 'social_sharing_control'];
        paramsToRemove.forEach(p => u.searchParams.delete(p));
        // 末尾のスラッシュを削除して比べるための正規化
        let normalized = u.origin + u.pathname;
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        // 残りのクエリパラメータを結合（重要なパラメータが残っている場合のため）
        const search = u.search;
        return (normalized + search).toLowerCase();
    } catch (e) {
        return url.trim().replace(/\/$/, '').toLowerCase();
    }
}

// SNSのフィードやトップページかどうかを判定
function isGenericSnsFeed(url) {
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/$/, '').toLowerCase();

        // TikTok
        if (u.hostname.includes('tiktok.com')) {
            // /@user/video/123... ではない場合はフィードの可能性が高い
            return !path.includes('/video/');
        }

        // YouTube, X なども同様に判定可能
        if (u.hostname.includes('youtube.com') && path === '') return true;
        if (u.hostname.includes('x.com') && (path === '' || path === '/home')) return true;

        return false;
    } catch (e) {
        return false;
    }
}
