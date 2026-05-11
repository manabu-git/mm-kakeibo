/* ============================================
   M&M家計簿 - Application Logic
   manabu & mako の家計簿アプリ
   ============================================ */

// ---- Categories ----
const CATEGORIES = {
    expense: [
        { id: 'food', name: '食費', icon: '🍽️', color: '#fb923c' },
        { id: 'housing', name: '住居費', icon: '🏠', color: '#60a5fa' },
        { id: 'transport', name: '交通費', icon: '🚗', color: '#34d399' },
        { id: 'utilities', name: '光熱費', icon: '💡', color: '#fbbf24' },
        { id: 'communication', name: '通信費', icon: '📱', color: '#818cf8' },
        { id: 'medical', name: '医療費', icon: '🏥', color: '#f87171' },
        { id: 'clothing', name: '衣服費', icon: '👕', color: '#c084fc' },
        { id: 'entertainment', name: '娯楽費', icon: '🎮', color: '#2dd4bf' },
        { id: 'education', name: '教育費', icon: '📚', color: '#a78bfa' },
        { id: 'groceries', name: '日用品', icon: '🧴', color: '#fb7185' },
        { id: 'dining', name: '外食', icon: '🍣', color: '#e879f9' },
        { id: 'other_expense', name: 'その他', icon: '💳', color: '#94a3b8' },
    ],
    income: [
        { id: 'salary', name: '給料', icon: '💰', color: '#4ade80' },
        { id: 'bonus', name: 'ボーナス', icon: '🎉', color: '#fbbf24' },
        { id: 'side_income', name: '副収入', icon: '💼', color: '#60a5fa' },
        { id: 'investment', name: '投資', icon: '📈', color: '#818cf8' },
        { id: 'gift', name: 'お祝い', icon: '🎁', color: '#f472b6' },
        { id: 'refund', name: '返金', icon: '🔄', color: '#2dd4bf' },
        { id: 'other_income', name: 'その他', icon: '✨', color: '#94a3b8' },
    ]
};

const PERSON_INFO = {
    manabu: { name: 'manabu', avatar: '🧑‍💻', color: '#60a5fa' },
    mako: { name: 'mako', avatar: '👩‍💼', color: '#f472b6' },
    shared: { name: '共通', avatar: '👫', color: '#c084fc' },
};

// ---- State ----
let state = {
    entries: [],
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    selectedType: 'expense',
    selectedPerson: 'manabu',
    selectedCategory: null,
    deleteTargetId: null,
    // Scan state
    scanPerson: 'manabu',
    scanImageBase64: null,
    scanResult: null,
};

// ---- Storage & Sync ----
async function loadEntries() {
    const gasUrl = getGasUrl();
    
    // 1. Load from LocalStorage first for instant rendering
    try {
        const saved = localStorage.getItem('mm_kakeibo_entries');
        if (saved) {
            state.entries = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load entries:', e);
    }

    // 2. Fetch from Google Sheets if configured
    if (gasUrl) {
        try {
            const response = await fetch(gasUrl);
            const data = await response.json();
            if (data && Array.isArray(data.entries)) {
                state.entries = data.entries;
                // Save synced data locally
                localStorage.setItem('mm_kakeibo_entries', JSON.stringify(state.entries));
                updateDashboard();
                updateHistory();
            }
        } catch (e) {
            console.error('Failed to load from GAS:', e);
            showToast('⚠️ スプレッドシートの同期に失敗しました');
        }
    }
}

async function saveEntries() {
    // 1. Save locally immediately
    try {
        localStorage.setItem('mm_kakeibo_entries', JSON.stringify(state.entries));
    } catch (e) {
        console.error('Failed to save entries locally:', e);
    }

    // 2. Sync to Google Sheets
    const gasUrl = getGasUrl();
    if (gasUrl) {
        try {
            await fetch(gasUrl, {
                method: 'POST',
                // Use text/plain to avoid CORS preflight issues with GAS
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'sync',
                    entries: state.entries
                })
            });
        } catch (e) {
            console.error('Failed to sync to GAS:', e);
            showToast('⚠️ スプレッドシートへの保存に失敗しました');
        }
    }
}

// ---- Utilities ----
function formatCurrency(amount) {
    return '¥' + amount.toLocaleString('ja-JP');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getMonthEntries() {
    return state.entries.filter(entry => {
        const d = new Date(entry.date);
        return d.getFullYear() === state.currentYear && d.getMonth() === state.currentMonth;
    });
}

function getCategoryById(id, type) {
    const cats = CATEGORIES[type] || CATEGORIES.expense;
    return cats.find(c => c.id === id) || { id: 'unknown', name: '不明', icon: '❓', color: '#94a3b8' };
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// ---- Month Navigation ----
function updateMonthDisplay() {
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('currentMonth').textContent = `${state.currentYear}年 ${monthNames[state.currentMonth]}`;
}

function prevMonth() {
    state.currentMonth--;
    if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
    }
    updateMonthDisplay();
    updateDashboard();
    updateHistory();
}

function nextMonth() {
    state.currentMonth++;
    if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
    }
    updateMonthDisplay();
    updateDashboard();
    updateHistory();
}

// ---- Tab Navigation ----
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'history') updateHistory();
    if (tabName === 'scan') checkApiKey();
}

// ---- Dashboard ----
let categoryChartInstance = null;
let dailyChartInstance = null;

function updateDashboard() {
    const entries = getMonthEntries();

    const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalExpense;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
    document.getElementById('totalBalance').textContent = formatCurrency(balance);

    // Person breakdown
    const manabuExpense = entries.filter(e => e.type === 'expense' && e.person === 'manabu').reduce((sum, e) => sum + e.amount, 0);
    const makoExpense = entries.filter(e => e.type === 'expense' && e.person === 'mako').reduce((sum, e) => sum + e.amount, 0);
    const sharedExpense = entries.filter(e => e.type === 'expense' && e.person === 'shared').reduce((sum, e) => sum + e.amount, 0);

    const manabuTotal = manabuExpense + Math.round(sharedExpense / 2);
    const makoTotal = makoExpense + Math.round(sharedExpense / 2);
    const maxPersonExpense = Math.max(manabuTotal, makoTotal, 1);

    document.getElementById('manabuExpense').textContent = formatCurrency(manabuTotal);
    document.getElementById('makoExpense').textContent = formatCurrency(makoTotal);
    document.getElementById('manabuBar').style.width = `${(manabuTotal / maxPersonExpense) * 100}%`;
    document.getElementById('makoBar').style.width = `${(makoTotal / maxPersonExpense) * 100}%`;

    // Charts
    updateCategoryChart(entries);
    updateDailyChart(entries);

    // Recent transactions
    updateRecentList(entries);
}

function updateCategoryChart(entries) {
    const expenses = entries.filter(e => e.type === 'expense');
    const categoryMap = {};

    expenses.forEach(e => {
        const cat = getCategoryById(e.category, 'expense');
        if (!categoryMap[cat.id]) {
            categoryMap[cat.id] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0 };
        }
        categoryMap[cat.id].total += e.amount;
    });

    const sorted = Object.values(categoryMap).sort((a, b) => b.total - a.total);
    const labels = sorted.map(c => c.icon + ' ' + c.name);
    const data = sorted.map(c => c.total);
    const colors = sorted.map(c => c.color);

    const ctx = document.getElementById('categoryChart').getContext('2d');

    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.map(c => c + '88'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#4a4a5a',
                        font: { family: "'Inter', 'Noto Sans JP', sans-serif", size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#4a4a5a',
                    bodyColor: '#6b6b80',
                    borderColor: 'rgba(220, 215, 205, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatCurrency(context.parsed);
                        }
                    }
                }
            },
        }
    });
}

function updateDailyChart(entries) {
    const daysInMonth = getDaysInMonth(state.currentYear, state.currentMonth);
    const dailyExpenses = new Array(daysInMonth).fill(0);
    const dailyIncomes = new Array(daysInMonth).fill(0);

    entries.forEach(e => {
        const day = new Date(e.date).getDate() - 1;
        if (day >= 0 && day < daysInMonth) {
            if (e.type === 'expense') dailyExpenses[day] += e.amount;
            else dailyIncomes[day] += e.amount;
        }
    });

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChartInstance) dailyChartInstance.destroy();

    dailyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '支出',
                    data: dailyExpenses,
                    backgroundColor: 'rgba(248, 113, 113, 0.4)',
                    borderColor: '#f87171',
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: '収入',
                    data: dailyIncomes,
                    backgroundColor: 'rgba(74, 222, 128, 0.4)',
                    borderColor: '#4ade80',
                    borderWidth: 1,
                    borderRadius: 3,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        color: '#6b6b80',
                        font: { size: 9 },
                        maxTicksLimit: 10,
                    },
                    grid: { display: false },
                    border: { display: false },
                },
                y: {
                    ticks: {
                        color: '#6b6b80',
                        font: { size: 10 },
                        callback: function(value) {
                            if (value >= 10000) return Math.round(value / 10000) + '万';
                            if (value >= 1000) return Math.round(value / 1000) + '千';
                            return value;
                        }
                    },
                    grid: { color: 'rgba(0,0,0,0.03)' },
                    border: { display: false },
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#4a4a5a',
                        font: { family: "'Inter', 'Noto Sans JP', sans-serif", size: 11 },
                        usePointStyle: true,
                        pointStyleWidth: 8,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#4a4a5a',
                    bodyColor: '#6b6b80',
                    borderColor: 'rgba(220, 215, 205, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: function(context) {
                            return ' ' + context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
        }
    });
}

function updateRecentList(entries) {
    const container = document.getElementById('recentList');
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>まだ記録がありません。「追加」タブから記録しましょう！</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(entry => createTransactionHTML(entry)).join('');
}

// ---- Transaction Item HTML ----
function createTransactionHTML(entry) {
    const cat = getCategoryById(entry.category, entry.type);
    const person = PERSON_INFO[entry.person] || PERSON_INFO.shared;
    const dateObj = new Date(entry.date);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const isExpense = entry.type === 'expense';

    return `
        <div class="transaction-item" data-id="${entry.id}" onclick="openEditModal('${entry.id}')">
            <div class="transaction-category-icon" style="background: ${cat.color}22;">
                ${cat.icon}
            </div>
            <div class="transaction-details">
                <div class="transaction-title">${entry.memo || cat.name}</div>
                <div class="transaction-meta">
                    <span>${dateStr}</span>
                    <span class="transaction-person-badge badge-${entry.person}">
                        ${person.avatar} ${person.name}
                    </span>
                </div>
            </div>
            <div class="transaction-amount ${entry.type}">
                ${isExpense ? '-' : '+'}${formatCurrency(entry.amount)}
            </div>
            <button class="transaction-delete" onclick="event.stopPropagation(); requestDelete('${entry.id}')" aria-label="削除">🗑️</button>
        </div>
    `;
}

// ---- History ----
function updateHistory() {
    const entries = getMonthEntries();
    const personFilter = document.getElementById('filterPerson').value;
    const categoryFilter = document.getElementById('filterCategory').value;
    const typeFilter = document.getElementById('filterType').value;

    let filtered = entries;

    if (personFilter !== 'all') {
        filtered = filtered.filter(e => e.person === personFilter);
    }
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(e => e.category === categoryFilter);
    }
    if (typeFilter !== 'all') {
        filtered = filtered.filter(e => e.type === typeFilter);
    }

    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const container = document.getElementById('historyList');
    const emptyEl = document.getElementById('historyEmpty');

    if (sorted.length === 0) {
        container.innerHTML = '';
        emptyEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'none';
        container.innerHTML = sorted.map(entry => createTransactionHTML(entry)).join('');
    }
}

// ---- Category Grid ----
function renderCategoryGrid() {
    const grid = document.getElementById('categoryGrid');
    const cats = CATEGORIES[state.selectedType];

    grid.innerHTML = cats.map(cat => `
        <button type="button" class="category-btn ${state.selectedCategory === cat.id ? 'active' : ''}"
                data-category="${cat.id}" id="cat-${cat.id}">
            <span class="category-btn-icon">${cat.icon}</span>
            <span>${cat.name}</span>
        </button>
    `).join('');

    grid.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedCategory = btn.dataset.category;
            grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// populateCategoryFilter
function populateCategoryFilter() {
    const select = document.getElementById('filterCategory');
    const options = ['<option value="all">全カテゴリ</option>'];

    CATEGORIES.expense.forEach(cat => {
        options.push(`<option value="${cat.id}">${cat.icon} ${cat.name}</option>`);
    });
    CATEGORIES.income.forEach(cat => {
        options.push(`<option value="${cat.id}">${cat.icon} ${cat.name}</option>`);
    });

    select.innerHTML = options.join('');
}

// ---- Form Submission ----
function handleSubmit(e) {
    e.preventDefault();

    const amount = parseInt(document.getElementById('amount').value, 10);
    const date = document.getElementById('date').value;
    const memo = document.getElementById('memo').value.trim();

    if (!amount || amount <= 0) {
        showToast('⚠️ 金額を入力してください');
        return;
    }
    if (!date) {
        showToast('⚠️ 日付を入力してください');
        return;
    }
    if (!state.selectedCategory) {
        showToast('⚠️ カテゴリを選択してください');
        return;
    }

    const entry = {
        id: generateId(),
        type: state.selectedType,
        amount: amount,
        person: state.selectedPerson,
        category: state.selectedCategory,
        date: date,
        memo: memo,
        createdAt: new Date().toISOString(),
    };

    const commitEntry = () => {
        state.entries.push(entry);
        saveEntries();

        // Reset form
        document.getElementById('amount').value = '';
        document.getElementById('memo').value = '';
        state.selectedCategory = null;
        renderCategoryGrid();

        const cat = getCategoryById(entry.category, entry.type);
        showToast(`✅ ${cat.icon} ${formatCurrency(amount)} を記録しました`);

        // Update date to current month view
        const d = new Date(date);
        state.currentYear = d.getFullYear();
        state.currentMonth = d.getMonth();
        updateMonthDisplay();
    };

    // #7: Duplicate check
    const duplicates = findDuplicates(entry);
    if (duplicates.length > 0) {
        showDuplicateWarning(duplicates, commitEntry);
    } else {
        commitEntry();
    }
}

// ---- Delete ----
function requestDelete(id) {
    state.deleteTargetId = id;
    document.getElementById('deleteModal').style.display = '';
}

function confirmDelete() {
    if (state.deleteTargetId) {
        state.entries = state.entries.filter(e => e.id !== state.deleteTargetId);
        saveEntries();
        showToast('🗑️ 記録を削除しました');
        updateDashboard();
        updateHistory();
    }
    closeDeleteModal();
}

function closeDeleteModal() {
    state.deleteTargetId = null;
    document.getElementById('deleteModal').style.display = 'none';
}

// ---- Toast ----
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================
// Receipt Scan with Gemini API
// ============================================

function getApiKey() {
    return localStorage.getItem('mm_kakeibo_gemini_key') || '';
}

function getGasUrl() {
    return localStorage.getItem('mm_kakeibo_gas_url') || '';
}

function saveSettingsData(key, gasUrl) {
    localStorage.setItem('mm_kakeibo_gemini_key', key);
    localStorage.setItem('mm_kakeibo_gas_url', gasUrl);
}

function checkApiKey() {
    const notice = document.getElementById('apiKeyNotice');
    if (!getApiKey()) {
        notice.style.display = '';
    } else {
        notice.style.display = 'none';
    }
}

function openSettings() {
    document.getElementById('apiKeyInput').value = getApiKey();
    document.getElementById('gasUrlInput').value = getGasUrl();
    document.getElementById('settingsModal').style.display = '';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function handleSaveSettings() {
    const key = document.getElementById('apiKeyInput').value.trim();
    const gasUrl = document.getElementById('gasUrlInput').value.trim();
    
    saveSettingsData(key, gasUrl);
    showToast('✅ 設定を保存しました');
    checkApiKey();
    closeSettings();
    
    // Trigger sync if GAS URL was added
    if (gasUrl) {
        showToast('🔄 スプレッドシートから最新データを再取得中...');
        // 保存したURLを使って強制的にスプレッドシートのデータでローカルを上書きする
        loadEntries().then(() => {
            updateDashboard();
            updateHistory();
            showToast('✅ スプレッドシートと同期完了！');
        });
    }
}

// ---- Image Handling ----
function handleImageSelect(file) {
    if (!file) return;

    // UIを画像処理中モードに変更
    document.getElementById('scanInputArea').style.display = 'none';
    document.getElementById('scanPreview').style.display = 'none';
    document.getElementById('scanResults').style.display = 'none';
    document.getElementById('scanLoading').style.display = '';
    document.querySelector('.loading-text').textContent = '画像を最適化中...';
    document.querySelector('.loading-sub').textContent = '通信量を抑えるためサイズを圧縮しています';

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // 画質を保ちつつ通信制限に引っかからないサイズに制限
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width = Math.round(width * (MAX_HEIGHT / height));
                    height = MAX_HEIGHT;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // JPEG形式で適度に圧縮（Token数/データ量の大幅削減）
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            state.scanImageBase64 = compressedBase64;

            // プレビュー表示
            document.getElementById('previewImage').src = compressedBase64;
            document.getElementById('scanLoading').style.display = 'none';
            document.getElementById('scanPreview').style.display = '';
        };
        img.onerror = () => {
            showToast('❌ 画像の読み込みに失敗しました');
            resetScan();
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        showToast('❌ ファイルの読み込みに失敗しました');
        resetScan();
    };
    reader.readAsDataURL(file);
}

function resetScan() {
    state.scanImageBase64 = null;
    state.scanResult = null;
    document.getElementById('scanInputArea').style.display = '';
    document.getElementById('scanPreview').style.display = 'none';
    document.getElementById('scanResults').style.display = 'none';
    document.getElementById('scanLoading').style.display = 'none';
    document.getElementById('scanError').style.display = 'none';
    // Reset file inputs
    document.getElementById('receiptCamera').value = '';
    document.getElementById('receiptFile').value = '';
}

// ---- Gemini API Call ----
async function executeOCR(retryCount = 0) {
    const MAX_RETRIES = 3;
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('🔑 まずAPIキーを設定してください');
        openSettings();
        return;
    }

    if (!state.scanImageBase64) {
        showToast('⚠️ 画像が選択されていません');
        return;
    }

    // Show loading
    document.getElementById('scanPreview').style.display = 'none';
    document.getElementById('scanLoading').style.display = '';

    if (retryCount > 0) {
        document.querySelector('.loading-text').textContent = `リトライ中... (${retryCount}/${MAX_RETRIES})`;
        document.querySelector('.loading-sub').textContent = 'APIの制限を待っています';
    } else {
        document.querySelector('.loading-text').textContent = 'AIがレシートを解析中...';
        document.querySelector('.loading-sub').textContent = '店名・品目・金額を自動で読み取っています';
    }

    try {
        // Extract base64 data and mime type
        const matches = state.scanImageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error('画像データの形式が正しくありません');

        const mimeType = matches[1];
        const imageData = matches[2];

        const prompt = `あなたはレシート読み取りAIです。以下のレシート画像を解析して、JSON形式で結果を返してください。

必ず以下のJSON形式で返してください（他のテキストは不要です）：
{
  "store_name": "店名",
  "store_branch": "支店名（あれば）",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "items": [
    {
      "name": "商品名",
      "price": 数値(税込),
      "category": "カテゴリID"
    }
  ],
  "total": 合計金額の数値,
  "payment_method": "支払方法"
}

カテゴリIDは以下から選んでください：
- food: 食料品（スーパーの食材、飲料など）
- dining: 外食（レストラン、カフェなど）
- groceries: 日用品（洗剤、ティッシュなど）
- clothing: 衣服
- medical: 医療・薬
- entertainment: 娯楽（酒類もここ）
- transport: 交通
- communication: 通信
- utilities: 光熱費
- housing: 住居
- education: 教育
- other_expense: その他

注意：
- 金額は必ず数値（整数）で返してください
- 日付はYYYY-MM-DD形式で返してください
- 読み取れない項目は最善の推測をしてください
- レジ袋は groceries カテゴリにしてください
- ビール・酒類は entertainment カテゴリにしてください`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: imageData
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json",
                    }
                })
            }
        );

        if (!response.ok) {
            let err = {};
            try { err = await response.json(); } catch (_) {}
            const errorMsg = err.error?.message || '';

            // Auto-retry on rate limit / quota errors
            if ((response.status === 429 || errorMsg.toLowerCase().includes('quota')) && retryCount < MAX_RETRIES) {
                showToast(`⏳ API制限中... ${3}秒後にリトライします`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                return executeOCR(retryCount + 1);
            }

            // Friendly error messages with raw detail
            if (response.status === 429 || errorMsg.toLowerCase().includes('quota')) {
                throw { friendly: '🕐 アクセスが集中しています。1分ほど待ってからもう一度お試しください', raw: errorMsg };
            } else if (response.status === 400) {
                throw { friendly: '🔑 APIキーが正しくないようです。設定画面でキーを確認・再入力してください', raw: errorMsg };
            } else if (response.status === 403) {
                throw { friendly: '🚫 このAPIキーではアクセスが許可されていません。Google AI Studio でキーの設定を確認してください', raw: errorMsg };
            } else if (response.status >= 500) {
                throw { friendly: '🔧 Google側のサーバーで問題が発生しています。しばらく待ってから再試行してください', raw: errorMsg || `HTTP ${response.status}` };
            } else {
                throw { friendly: '⚠️ 読み取りに失敗しました。もう一度お試しください', raw: errorMsg || `HTTP ${response.status}` };
            }
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw { friendly: '🤔 AIからの応答が空でした。レシートが写真にはっきり写っているか確認して、もう一度試してください', raw: 'Empty response from API' };

        // Parse JSON from response (handle markdown code blocks more robustly)
        let jsonStr = text;
        
        // Remove markdown code blocks
        jsonStr = jsonStr.replace(/```[a-z]*\n?/ig, '').replace(/```\n?/g, '');
        
        // Extract just the JSON object or array portion
        const firstCurly = jsonStr.indexOf('{');
        const firstSquare = jsonStr.indexOf('[');
        const lastCurly = jsonStr.lastIndexOf('}');
        const lastSquare = jsonStr.lastIndexOf(']');
        
        let startIdx = -1;
        let endIdx = -1;
        
        if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
            startIdx = firstCurly;
            endIdx = lastCurly;
        } else if (firstSquare !== -1) {
            startIdx = firstSquare;
            endIdx = lastSquare;
        }
        
        if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }
        
        jsonStr = jsonStr.trim();

        let result;
        try {
            result = JSON.parse(jsonStr);
        } catch (parseErr) {
            throw { friendly: '📋 レシートの内容をうまく読み取れませんでした。レシート全体がはっきり写るように撮り直してください', raw: `JSON parse error: ${parseErr.message}` };
        }

        state.scanResult = result;

        // Display results
        displayScanResults(result);

    } catch (error) {
        console.error('OCR Error:', error);
        document.getElementById('scanLoading').style.display = 'none';

        let friendlyMsg, rawMsg;
        if (error.friendly) {
            friendlyMsg = error.friendly;
            rawMsg = error.raw;
        } else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            friendlyMsg = '📶 ネットワークに接続できません。Wi-Fiや電波の状態を確認してください';
            rawMsg = error.message || 'Network error';
        } else {
            friendlyMsg = '⚠️ 予期しないエラーが発生しました。もう一度お試しください';
            rawMsg = error.message || String(error);
        }
        showScanError(friendlyMsg, rawMsg);
    }
}

// ---- Display Results ----
function displayScanResults(result) {
    document.getElementById('scanLoading').style.display = 'none';
    document.getElementById('scanResults').style.display = '';

    // Store info
    const storeName = [result.store_name, result.store_branch].filter(Boolean).join(' ');
    const dateStr = result.date || '';
    const timeStr = result.time || '';
    document.getElementById('resultStore').innerHTML = `
        <div class="store-name">🏪 ${storeName || '不明な店舗'}</div>
        <div class="store-date">${dateStr} ${timeStr} ${result.payment_method ? '/ ' + result.payment_method : ''}</div>
    `;

    // Items
    const itemsContainer = document.getElementById('resultItems');
    if (result.items && result.items.length > 0) {
        itemsContainer.innerHTML = result.items.map((item, i) => {
            const cat = getCategoryById(item.category, 'expense');
            
            // Generate category select options
            const optionsHtml = CATEGORIES.expense.map(c => 
                `<option value="${c.id}" ${c.id === cat.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
            ).join('');

            return `
                <div class="result-item">
                    <input type="checkbox" class="result-item-checkbox" data-index="${i}" checked>
                    <span class="result-item-name">${item.name}</span>
                    <select class="result-item-category result-item-category-select" data-index="${i}">
                        ${optionsHtml}
                    </select>
                    <span class="result-item-amount">${formatCurrency(item.price)}</span>
                </div>
            `;
        }).join('');
    } else {
        itemsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">品目を読み取れませんでした</p>';
    }

    // Total
    document.getElementById('resultTotal').innerHTML = `
        <span class="result-total-label">合計</span>
        <span class="result-total-amount">${formatCurrency(result.total || 0)}</span>
    `;
}

// ---- Save Scanned Entries ----
function saveAllScannedItems() {
    if (!state.scanResult) return;

    const result = state.scanResult;
    const date = result.date || new Date().toISOString().split('T')[0];
    const storeName = [result.store_name, result.store_branch].filter(Boolean).join(' ');
    const checkboxes = document.querySelectorAll('.result-item-checkbox');

    // Build entries to save
    const newEntries = [];
    result.items.forEach((item, i) => {
        const checkbox = checkboxes[i];
        const categorySelect = document.querySelector(`.result-item-category-select[data-index="${i}"]`);
        const itemCategory = categorySelect ? categorySelect.value : (item.category || 'food');

        if (checkbox && checkbox.checked) {
            newEntries.push({
                id: generateId(),
                type: 'expense',
                amount: Math.round(item.price),
                person: state.scanPerson,
                category: itemCategory,
                date: date,
                memo: `${item.name}（${storeName}）`,
                store: storeName,
                createdAt: new Date().toISOString(),
            });
        }
    });

    const commitAll = () => {
        newEntries.forEach(e => state.entries.push(e));
        saveEntries();
        showToast(`✅ ${newEntries.length}件登録しました。続けて撮影できます`);

        const d = new Date(date);
        state.currentYear = d.getFullYear();
        state.currentMonth = d.getMonth();
        updateMonthDisplay();
        resetScan(); // #4: Stay on scan tab
    };

    // #7: Duplicate check
    const allDuplicates = newEntries.flatMap(e => findDuplicates(e));
    if (allDuplicates.length > 0) {
        // Deduplicate the list
        const seen = new Set();
        const uniqueDups = allDuplicates.filter(d => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
        });
        showDuplicateWarning(uniqueDups, commitAll);
    } else {
        commitAll();
    }
}

function saveTotalOnly() {
    if (!state.scanResult) return;

    const result = state.scanResult;
    const date = result.date || new Date().toISOString().split('T')[0];
    const storeName = [result.store_name, result.store_branch].filter(Boolean).join(' ');

    // Determine the main category (most items)
    const categoryCounts = {};
    (result.items || []).forEach(item => {
        const cat = item.category || 'food';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const mainCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'food';

    const entry = {
        id: generateId(),
        type: 'expense',
        amount: Math.round(result.total),
        person: state.scanPerson,
        category: mainCategory,
        date: date,
        memo: storeName,
        store: storeName,
        createdAt: new Date().toISOString(),
    };

    const commitTotal = () => {
        state.entries.push(entry);
        saveEntries();
        showToast(`✅ ${formatCurrency(result.total)} を登録しました。続けて撮影できます`);

        const d = new Date(date);
        state.currentYear = d.getFullYear();
        state.currentMonth = d.getMonth();
        updateMonthDisplay();
        resetScan(); // #4: Stay on scan tab
    };

    // #7: Duplicate check
    const duplicates = findDuplicates(entry);
    if (duplicates.length > 0) {
        showDuplicateWarning(duplicates, commitTotal);
    } else {
        commitTotal();
    }
}

// ============================================
// #7: Duplicate Check
// ============================================

function findDuplicates(newEntry) {
    return state.entries.filter(existing =>
        existing.date === newEntry.date &&
        existing.amount === newEntry.amount &&
        existing.category === newEntry.category &&
        existing.person === newEntry.person
    );
}

let _duplicateConfirmCallback = null;

function showDuplicateWarning(duplicates, onConfirm) {
    _duplicateConfirmCallback = onConfirm;
    const list = document.getElementById('duplicateList');
    list.innerHTML = duplicates.map(d => {
        const cat = getCategoryById(d.category, d.type);
        const person = PERSON_INFO[d.person] || PERSON_INFO.shared;
        const dateObj = new Date(d.date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        return `<div class="duplicate-item">${dateStr} ${cat.icon} ${cat.name} ${formatCurrency(d.amount)} (${person.name})</div>`;
    }).join('');
    document.getElementById('duplicateModal').style.display = '';
}

function closeDuplicateModal() {
    _duplicateConfirmCallback = null;
    document.getElementById('duplicateModal').style.display = 'none';
}

function confirmDuplicate() {
    if (_duplicateConfirmCallback) _duplicateConfirmCallback();
    closeDuplicateModal();
}

// ============================================
// #2: Scan Error UI
// ============================================

function showScanError(message, rawError) {
    document.getElementById('scanPreview').style.display = 'none';
    document.getElementById('scanLoading').style.display = 'none';
    document.getElementById('scanResults').style.display = 'none';
    const errorDiv = document.getElementById('scanError');
    errorDiv.style.display = '';
    document.getElementById('scanErrorMessage').textContent = message;
    document.getElementById('scanErrorRaw').textContent = rawError || '';
}

// ============================================
// #3: Edit Modal
// ============================================

function populateEditCategories(type) {
    const select = document.getElementById('editCategory');
    const cats = CATEGORIES[type] || CATEGORIES.expense;
    select.innerHTML = cats.map(c =>
        `<option value="${c.id}">${c.icon} ${c.name}</option>`
    ).join('');
}

function openEditModal(id) {
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;

    state.editTargetId = id;

    // Populate type & trigger category update
    document.getElementById('editType').value = entry.type;
    populateEditCategories(entry.type);

    document.getElementById('editAmount').value = entry.amount;
    document.getElementById('editCategory').value = entry.category;
    document.getElementById('editDate').value = entry.date;
    document.getElementById('editMemo').value = entry.memo || '';

    // Person toggle
    document.querySelectorAll('[data-edit-person]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.editPerson === entry.person);
    });

    document.getElementById('editModal').style.display = '';
}

function closeEditModal() {
    state.editTargetId = null;
    document.getElementById('editModal').style.display = 'none';
}

function handleEditSave() {
    const id = state.editTargetId;
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;

    const amount = parseInt(document.getElementById('editAmount').value, 10);
    if (!amount || amount <= 0) {
        showToast('⚠️ 金額を入力してください');
        return;
    }

    entry.type = document.getElementById('editType').value;
    entry.amount = amount;
    entry.category = document.getElementById('editCategory').value;
    entry.date = document.getElementById('editDate').value;
    entry.memo = document.getElementById('editMemo').value.trim();

    // Get selected person
    const activePersonBtn = document.querySelector('[data-edit-person].active');
    if (activePersonBtn) entry.person = activePersonBtn.dataset.editPerson;

    saveEntries();
    closeEditModal();
    updateDashboard();
    updateHistory();
    showToast('✅ 記録を更新しました');
}

// ---- Event Binding ----
function initEvents() {
    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', prevMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Type toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedType = btn.dataset.type;
            state.selectedCategory = null;
            renderCategoryGrid();
        });
    });

    // Person toggle (Add tab)
    document.querySelectorAll('[data-person]').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.person-toggle');
            parent.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.person) state.selectedPerson = btn.dataset.person;
        });
    });

    // Scan person toggle
    document.querySelectorAll('[data-scan-person]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-scan-person]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.scanPerson = btn.dataset.scanPerson;
        });
    });

    // Form
    document.getElementById('entryForm').addEventListener('submit', handleSubmit);

    // Filters
    document.getElementById('filterPerson').addEventListener('change', updateHistory);
    document.getElementById('filterCategory').addEventListener('change', updateHistory);
    document.getElementById('filterType').addEventListener('change', updateHistory);

    // Delete modal
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDeleteModal();
    });

    // Settings
    document.getElementById('settingsGearBtn').addEventListener('click', openSettings);
    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('saveSettings').addEventListener('click', handleSaveSettings);
    document.getElementById('cancelSettings').addEventListener('click', closeSettings);
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSettings();
    });

    // Receipt scan - camera & file
    document.getElementById('receiptCamera').addEventListener('change', (e) => {
        handleImageSelect(e.target.files[0]);
    });
    document.getElementById('receiptFile').addEventListener('change', (e) => {
        handleImageSelect(e.target.files[0]);
    });

    // Scan actions
    document.getElementById('scanExecuteBtn').addEventListener('click', executeOCR);
    document.getElementById('scanCancelBtn').addEventListener('click', resetScan);
    document.getElementById('scanAgainBtn').addEventListener('click', resetScan);
    document.getElementById('saveAllBtn').addEventListener('click', saveAllScannedItems);
    document.getElementById('saveTotalBtn').addEventListener('click', saveTotalOnly);

    // Scan error actions (#2)
    document.getElementById('scanRetryBtn').addEventListener('click', () => executeOCR());
    document.getElementById('scanManualBtn').addEventListener('click', () => {
        resetScan();
        switchTab('add');
    });
    document.getElementById('scanResetBtn').addEventListener('click', resetScan);

    // Edit modal (#3)
    document.getElementById('saveEdit').addEventListener('click', handleEditSave);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });
    document.getElementById('editType').addEventListener('change', (e) => {
        populateEditCategories(e.target.value);
    });
    document.querySelectorAll('[data-edit-person]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-edit-person]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Duplicate modal (#7)
    document.getElementById('confirmDuplicate').addEventListener('click', confirmDuplicate);
    document.getElementById('cancelDuplicate').addEventListener('click', closeDuplicateModal);
    document.getElementById('duplicateModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDuplicateModal();
    });

    // Set default date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
}

// ---- Initialization ----
async function init() {
    // 最初にデータを読み込む（同期完了を待つ）
    await loadEntries();

    updateMonthDisplay();
    renderCategoryGrid();
    populateCategoryFilter();
    initEvents();
    updateDashboard();
    checkApiKey();
}

// Start app
document.addEventListener('DOMContentLoaded', init);
