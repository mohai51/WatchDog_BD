const $ = id => document.getElementById(id);
const $text = (id, val) => { const el = $(id); if (el) el.textContent = val; };

let adminToken = sessionStorage.getItem('safemap_admin_token') || null;
let lang = localStorage.getItem('safemap-admin-lang') || 'bn';
let adminVisitChart = null;
let districtsMap = {};

const I18N = {
  bn: {
    loginTitle: 'অ্যাডমিন প্রবেশদ্বার',
    loginSubtitle: 'রিপোর্ট যাচাই এবং লাইভ সাইট ট্রাফিকের বিস্তারিত দেখতে অ্যাডমিন পাসওয়ার্ড দিন।',
    loginBtn: 'লগইন করুন (Login)',
    dashboardHeading: 'অ্যাডমিন কন্ট্রোল সেন্টার',
    tabReports: '📋 রিপোর্ট মডারেশন',
    tabAnalytics: '📊 সাইট অ্যানালিটিক্স',
    logout: 'লগআউট (Logout)',
    refresh: '🔄 Refresh',
    noQueue: 'এই অবস্থায় কোনো রিপোর্ট নেই।',
    approved: 'অনুমোদন করুন',
    rejected: 'বাতিল করুন',
    confirmApprove: 'এই রিপোর্টটি অনুমোদন করতে চান?',
    confirmReject: 'এই রিপোর্টটি বাতিল করতে চান?',
    incorrectPassword: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন (ডিফল্ট: admin123)।',
    snatching: 'ছিনতাই',
    theft: 'চুরি',
    robbery: 'ডাকাতি',
    extortion: 'চাঁদাবাজি',
    harassment: 'হয়রানি',
    assault: 'হামলা',
    fraud: 'প্রতারণা',
    other: 'অন্যান্য'
  },
  en: {
    loginTitle: 'Admin Portal Access',
    loginSubtitle: 'Enter administrator credentials to access moderation and live traffic analytics.',
    loginBtn: 'Login',
    dashboardHeading: 'Admin Control Center',
    tabReports: '📋 Report Moderation',
    tabAnalytics: '📊 Site Analytics',
    logout: 'Logout',
    refresh: '🔄 Refresh',
    noQueue: 'No reports found with this status.',
    approved: 'Approve',
    rejected: 'Reject',
    confirmApprove: 'Approve this report?',
    confirmReject: 'Reject this report?',
    incorrectPassword: 'Incorrect password! (Default: admin123)',
    snatching: 'Snatching',
    theft: 'Theft',
    robbery: 'Robbery',
    extortion: 'Extortion',
    harassment: 'Harassment',
    assault: 'Assault',
    fraud: 'Fraud',
    other: 'Other'
  }
};

async function api(url, opts = {}) {
  const headers = {
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {})
  };
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || ('HTTP ' + res.status));
  }
  return data;
}

// 1. Language & Theme handlers
$('langBtn').onclick = () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  localStorage.setItem('safemap-admin-lang', lang);
  renderLanguage();
};

$('themeBtn').onclick = () => {
  document.body.classList.toggle('dark');
  $('themeBtn').textContent = document.body.classList.contains('dark') ? '☀' : '☾';
  if (adminVisitChart) {
    loadAnalytics();
  }
};

function renderLanguage() {
  $text('langBtn', lang === 'bn' ? 'EN' : 'বাং');
  $text('loginTitle', I18N[lang].loginTitle);
  $text('loginSubtitle', I18N[lang].loginSubtitle);
  $text('loginBtnSubmit', I18N[lang].loginBtn);
  $text('dashboardHeading', I18N[lang].dashboardHeading);
  $text('tabReportsBtn', I18N[lang].tabReports);
  $text('tabAnalyticsBtn', I18N[lang].tabAnalytics);
  $text('logoutBtn', I18N[lang].logout);
}

// 2. Auth Flow
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const password = ($('password').value || '').trim();
  $('adminLoginError').textContent = '';
  try {
    const res = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    adminToken = res.token;
    sessionStorage.setItem('safemap_admin_token', adminToken);
    $('password').value = '';
    showDashboard();
  } catch (err) {
    $('adminLoginError').textContent = (err.message === 'Incorrect password' || err.message.includes('401'))
      ? I18N[lang].incorrectPassword
      : err.message;
  }
};

$('logoutBtn').onclick = () => {
  adminToken = null;
  sessionStorage.removeItem('safemap_admin_token');
  showAuth();
};

function showAuth() {
  $('adminAuthSection').hidden = false;
  $('adminDashboardSection').hidden = true;
  $('adminLoginError').textContent = '';
}

async function showDashboard() {
  $('adminAuthSection').hidden = true;
  $('adminDashboardSection').hidden = false;
  switchTab('reports');
  await loadDistricts();
  await loadQueue();
}

// 3. Tab switching
function switchTab(tab) {
  if (tab === 'reports') {
    $('tabReportsBtn').classList.add('active');
    $('tabReportsBtn').classList.remove('ghost');
    $('tabAnalyticsBtn').classList.remove('active');
    $('tabAnalyticsBtn').classList.add('ghost');
    $('adminReportsView').hidden = false;
    $('adminAnalyticsView').hidden = true;
  } else {
    $('tabAnalyticsBtn').classList.add('active');
    $('tabAnalyticsBtn').classList.remove('ghost');
    $('tabReportsBtn').classList.remove('active');
    $('tabReportsBtn').classList.add('ghost');
    $('adminReportsView').hidden = true;
    $('adminAnalyticsView').hidden = false;
    loadAnalytics();
  }
}

$('tabReportsBtn').onclick = () => {
  switchTab('reports');
  loadQueue();
};

$('tabAnalyticsBtn').onclick = () => {
  switchTab('analytics');
};

// 4. District Lookup
async function loadDistricts() {
  try {
    const meta = await api('/api/meta');
    for (const d of (meta.districts || [])) {
      districtsMap[d.code] = d.name;
    }
  } catch {}
}

// 5. Reports Moderation Queue
async function loadQueue() {
  if (!adminToken) return showAuth();
  const status = $('moderationStatus').value;
  $('adminMessage').textContent = '';
  try {
    const res = await api(`/api/admin/reports?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const queue = $('reportQueue');
    queue.replaceChildren();

    if (!res.reports || !res.reports.length) {
      const empty = document.createElement('div');
      empty.className = 'no-incidents-msg';
      empty.textContent = I18N[lang].noQueue;
      queue.append(empty);
      return;
    }

    for (const item of res.reports) {
      const card = document.createElement('div');
      card.className = 'queue-item';

      const dName = districtsMap[item.district_code] || item.district_code;
      const typeLabel = I18N[lang][item.type] || item.type;

      const title = document.createElement('div');
      title.style.display = 'flex';
      title.style.justifyContent = 'space-between';
      title.style.alignItems = 'center';
      title.style.marginBottom = '8px';

      const b = document.createElement('b');
      b.textContent = `#${item.id} · ${dName} · ${typeLabel}`;

      const dateBadge = document.createElement('span');
      dateBadge.style.fontSize = '11px';
      dateBadge.style.color = 'var(--muted)';
      dateBadge.textContent = `📅 ${item.incident_date} ${item.incident_time}`;

      title.append(b, dateBadge);
      card.append(title);

      const loc = document.createElement('div');
      loc.style.fontSize = '12px';
      loc.style.marginBottom = '6px';
      loc.textContent = `📍 ${item.location}`;
      card.append(loc);

      const desc = document.createElement('p');
      desc.textContent = item.description;
      card.append(desc);

      const meta = document.createElement('small');
      meta.style.display = 'block';
      meta.style.marginTop = '8px';
      meta.textContent = `রিপোর্টার: ${item.reporter_name || 'Anonymous'} · ভুক্তভোগী: ${item.is_victim ? 'হ্যাঁ' : 'না'} · স্ট্যাটাস: ${item.status}`;
      card.append(meta);

      if (item.status === 'pending') {
        const actions = document.createElement('div');
        actions.className = 'queue-actions';
        actions.style.marginTop = '12px';

        const btnApprove = document.createElement('button');
        btnApprove.className = 'button approve';
        btnApprove.textContent = `✓ ${I18N[lang].approved}`;
        btnApprove.onclick = () => updateStatus(item.id, 'approved');

        const btnReject = document.createElement('button');
        btnReject.className = 'button reject';
        btnReject.textContent = `✕ ${I18N[lang].rejected}`;
        btnReject.onclick = () => updateStatus(item.id, 'rejected');

        actions.append(btnApprove, btnReject);
        card.append(actions);
      }

      queue.append(card);
    }
  } catch (err) {
    if (err.message === 'Unauthorized' || err.message.includes('401')) {
      showAuth();
    } else {
      $('adminMessage').textContent = err.message;
    }
  }
}

async function updateStatus(id, newStatus) {
  const confirmMsg = newStatus === 'approved' ? I18N[lang].confirmApprove : I18N[lang].confirmReject;
  if (!confirm(confirmMsg)) return;

  try {
    await api(`/api/admin/reports/${id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: newStatus })
    });
    await loadQueue();
  } catch (err) {
    alert(err.message);
  }
}

$('moderationStatus').onchange = loadQueue;
$('refreshAdminBtn').onclick = loadQueue;

// 6. Analytics Section
async function loadAnalytics() {
  if (!adminToken) return showAuth();
  try {
    const data = await api('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    $text('analyticsTotalVisits', (data.total_visits || 0).toLocaleString());
    $text('analyticsTodayVisits', (data.today_visits || 0).toLocaleString());
    $text('analyticsTotalReports', (data.total_reports || 0).toLocaleString());
    $text('analyticsPendingReports', (data.pending_reports || 0).toLocaleString());
    $text('analyticsApprovedReports', (data.approved_reports || 0).toLocaleString());
    $text('analyticsRejectedReports', (data.rejected_reports || 0).toLocaleString());

    if (adminVisitChart) {
      adminVisitChart.destroy();
    }

    const labels = (data.daily_visits || []).map(v => v.date.slice(5));
    const counts = (data.daily_visits || []).map(v => v.count);
    const ink = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#8290a5';

    adminVisitChart = new Chart($('adminVisitChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: lang === 'bn' ? 'দৈনিক ভিজিটর' : 'Daily Visitors',
          data: counts,
          borderColor: '#2aa579',
          backgroundColor: '#2aa57920',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#2aa579'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: ink }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0, color: ink }, grid: { color: '#88888820' } }
        }
      }
    });
  } catch (err) {
    if (err.message === 'Unauthorized' || err.message.includes('401')) {
      showAuth();
    } else {
      $('adminMessage').textContent = err.message;
    }
  }
}

$('refreshAnalyticsBtn').onclick = loadAnalytics;

// Auto-login if token already in sessionStorage
renderLanguage();
if (adminToken) {
  showDashboard();
} else {
  showAuth();
}
