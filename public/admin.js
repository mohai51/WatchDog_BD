/**
 * WatchDog BD — Admin Workspace & Moderation Workflow
 */

const $ = id => document.getElementById(id);
const $text = (id, val) => { const el = $(id); if (el) el.textContent = val; };

let adminToken = sessionStorage.getItem('watchdog_admin_token') || null;
let lang = localStorage.getItem('watchdog_admin_lang') || 'bn';
let adminVisitChart = null;
let districtsMap = {};

const I18N = {
  bn: {
    loginTitle: 'অ্যাডমিন কন্ট্রোল পোর্টাল',
    loginSubtitle: 'নাগরিক রিপোর্ট যাচাই, তথ্যসূত্র যাচাইকরণ ও ট্রাফিক অ্যানালিটিক্স অ্যাক্সেস করতে পাসওয়ার্ড দিন।',
    loginBtn: 'লগইন করুন (Login)',
    dashboardHeading: 'মডারেশন ও ইনটেলিজেন্স ওয়ার্কস্পেস',
    tabReports: 'রিপোর্ট মডারেশন কিউ',
    tabAnalytics: 'সাইট ট্রাফিক ও অ্যানালিটিক্স',
    logout: 'লগআউট (Logout)',
    noQueue: 'এই ফিল্টারে কোনো রিপোর্ট পাওয়া যায়নি।',
    incorrectPassword: 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।'
  },
  en: {
    loginTitle: 'Admin Control Portal',
    loginSubtitle: 'Enter administrator credentials to moderate community reports and view traffic intelligence.',
    loginBtn: 'Login',
    dashboardHeading: 'Moderation & Intelligence Workspace',
    tabReports: 'Moderation Queue',
    tabAnalytics: 'Site Traffic & Analytics',
    logout: 'Logout',
    noQueue: 'No reports found matching this filter.',
    incorrectPassword: 'Incorrect password! Please check credentials.'
  }
};

async function api(url, opts = {}) {
  const headers = {
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {})
  };
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

// 1. Theme & Language Controls
function updateAdminThemeIcon() {
  const isDark = document.body.classList.contains('dark');
  const btn = $('themeBtn');
  if (!btn) return;
  if (isDark) {
    btn.innerHTML = `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    btn.innerHTML = `<svg class="ui-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

$('themeBtn').onclick = () => {
  document.body.classList.toggle('dark');
  updateAdminThemeIcon();
  if (adminVisitChart) loadAnalytics();
};
updateAdminThemeIcon();

$('langBtn').onclick = () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  localStorage.setItem('watchdog_admin_lang', lang);
  renderLanguage();
};

function renderLanguage() {
  if ($('langText')) $('langText').textContent = lang === 'bn' ? 'EN' : 'বাং';
  else $text('langBtn', lang === 'bn' ? 'EN' : 'বাং');
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
    sessionStorage.setItem('watchdog_admin_token', adminToken);
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
  sessionStorage.removeItem('watchdog_admin_token');
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
  await loadDistrictsMap();
  await loadQueue();
}

// 3. Tab Navigation
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

$('tabReportsBtn').onclick = () => { switchTab('reports'); loadQueue(); };
$('tabAnalyticsBtn').onclick = () => { switchTab('analytics'); };

// 4. District Lookup
async function loadDistrictsMap() {
  try {
    const meta = await api('/api/meta');
    for (const d of (meta.districts || [])) {
      districtsMap[d.code] = d.name;
    }
  } catch {}
}

// 5. Moderation Queue Loading
async function loadQueue() {
  if (!adminToken) return showAuth();
  const status = $('moderationStatus').value;
  const verifFilter = $('filterVerification').value;
  $('adminMessage').textContent = '';

  try {
    let url = `/api/admin/reports?status=${encodeURIComponent(status)}`;
    if (verifFilter) url += `&verification_status=${encodeURIComponent(verifFilter)}`;

    const res = await api(url, {
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
      card.className = 'incident-card';
      card.style.background = 'var(--panel)';
      card.style.border = '1px solid var(--line)';

      const dName = districtsMap[item.district_code] || item.district_code;

      // Header row
      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.justifyContent = 'space-between';
      titleRow.style.alignItems = 'center';

      const heading = document.createElement('b');
      heading.textContent = `#${item.id} · ${dName} · [${item.type.toUpperCase()}]`;

      const codeTag = document.createElement('span');
      codeTag.style.fontFamily = 'monospace';
      codeTag.style.fontSize = '12px';
      codeTag.style.background = 'var(--sub)';
      codeTag.style.padding = '3px 8px';
      codeTag.style.borderRadius = '6px';
      codeTag.textContent = item.tracking_code || 'LEGACY-REF';

      titleRow.append(heading, codeTag);
      card.append(titleRow);

      // Meta info
      const meta = document.createElement('div');
      meta.style.fontSize = '12px';
      meta.style.color = 'var(--muted)';
      meta.textContent = `${item.incident_date} ${item.incident_time} | ${item.location}`;
      card.append(meta);

      // Narrative
      const narrative = document.createElement('p');
      narrative.className = 'incident-narrative';
      narrative.textContent = item.description;
      card.append(narrative);

      // Confidential submitter details for admin inspection
      const privateBox = document.createElement('div');
      privateBox.style.background = 'var(--sub)';
      privateBox.style.padding = '8px 12px';
      privateBox.style.borderRadius = '8px';
      privateBox.style.fontSize = '11px';
      const reporterInfo = item.reporter || {};
      privateBox.innerHTML = `
        <strong>গোপনীয় তথ্য (Admin Only):</strong> রিপোর্টার: ${reporterInfo.name || item.reporter_name || 'Anonymous'} | 
        যোগাযোগ: ${reporterInfo.contact || 'None'} | 
        সংশ্লিষ্টতা: ${item.witness_status || (item.is_victim ? 'victim' : 'witness')}
        ${item.reference_url ? ` | রেফারেন্স: <a href="${item.reference_url}" target="_blank" rel="noopener">লিংক ↗</a>` : ''}
      `;
      card.append(privateBox);

      // Moderation Action Controls
      if (item.status === 'pending') {
        const actionBox = document.createElement('div');
        actionBox.style.marginTop = '12px';
        actionBox.style.paddingTop = '10px';
        actionBox.style.borderTop = '1px solid var(--line)';
        actionBox.style.display = 'flex';
        actionBox.style.alignItems = 'center';
        actionBox.style.gap = '10px';
        actionBox.style.flexWrap = 'wrap';

        // Select verification tier
        const verifSelect = document.createElement('select');
        verifSelect.style.padding = '7px 10px';
        verifSelect.style.fontSize = '12px';
        verifSelect.innerHTML = `
          <option value="moderated">সাধারণ মডারেটেড (Moderated)</option>
          <option value="independently_verified">নিরপেক্ষভাবে প্রমাণিত (Independently Verified)</option>
          <option value="published_news_report">সংবাদে প্রকাশিত রিপোর্ট (Published News)</option>
        `;

        // Moderator decision note
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.placeholder = 'মডারেশন নোট / যাচাইয়ের প্রমাণ (ঐচ্ছিক)';
        noteInput.style.flex = '1';
        noteInput.style.minWidth = '200px';
        noteInput.style.padding = '7px 10px';
        noteInput.style.fontSize = '12px';

        const btnApprove = document.createElement('button');
        btnApprove.className = 'button primary';
        btnApprove.textContent = 'অনুমোদন ও প্রকাশ (Approve)';
        btnApprove.onclick = () => updateStatus(item.id, 'approved', verifSelect.value, noteInput.value);

        const btnReject = document.createElement('button');
        btnReject.className = 'button ghost';
        btnReject.style.color = 'var(--red)';
        btnReject.textContent = 'বাতিল (Reject)';
        btnReject.onclick = () => updateStatus(item.id, 'rejected', null, noteInput.value);

        const btnDelete = document.createElement('button');
        btnDelete.className = 'button ghost';
        btnDelete.style.color = 'var(--red)';
        btnDelete.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        btnDelete.textContent = 'ভুয়া/ডিলিট (Delete)';
        btnDelete.title = 'ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলুন';
        btnDelete.onclick = () => deleteReport(item.id);

        actionBox.append(verifSelect, noteInput, btnApprove, btnReject, btnDelete);
        card.append(actionBox);
      } else if (item.status === 'approved') {
        const actionBox = document.createElement('div');
        actionBox.style.marginTop = '10px';
        actionBox.style.display = 'flex';
        actionBox.style.justifyContent = 'space-between';
        actionBox.style.alignItems = 'center';
        actionBox.style.flexWrap = 'wrap';
        actionBox.style.gap = '8px';

        const statusPill = document.createElement('span');
        statusPill.className = 'verification-badge verif-' + (item.verification_status || 'moderated');
        statusPill.textContent = 'Active: ' + (item.verification_status || 'moderated');

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';

        const btnWithdraw = document.createElement('button');
        btnWithdraw.className = 'button ghost';
        btnWithdraw.style.fontSize = '11px';
        btnWithdraw.style.color = 'var(--ink)';
        btnWithdraw.textContent = 'প্রত্যাহার (Takedown)';
        btnWithdraw.onclick = () => updateStatus(item.id, 'rejected', 'withdrawn', 'Takedown requested');

        const btnDelete = document.createElement('button');
        btnDelete.className = 'button ghost';
        btnDelete.style.fontSize = '11px';
        btnDelete.style.color = 'var(--red)';
        btnDelete.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        btnDelete.textContent = 'ভুয়া রিপোর্ট ডিলিট (Delete)';
        btnDelete.title = 'ভুয়া প্রমাণিত হওয়ায় ডাটাবেস ও ম্যাপ থেকে সম্পূর্ণ মুছে ফেলুন';
        btnDelete.onclick = () => deleteReport(item.id);

        btnGroup.append(btnWithdraw, btnDelete);
        actionBox.append(statusPill, btnGroup);
        card.append(actionBox);
      } else if (item.status === 'rejected') {
        const actionBox = document.createElement('div');
        actionBox.style.marginTop = '10px';
        actionBox.style.display = 'flex';
        actionBox.style.justifyContent = 'space-between';
        actionBox.style.alignItems = 'center';
        actionBox.style.flexWrap = 'wrap';
        actionBox.style.gap = '8px';

        const statusPill = document.createElement('span');
        statusPill.className = 'badge-tag';
        statusPill.style.background = 'var(--red-subtle)';
        statusPill.style.color = 'var(--red)';
        statusPill.textContent = 'Status: Rejected';

        const btnDelete = document.createElement('button');
        btnDelete.className = 'button ghost';
        btnDelete.style.fontSize = '11px';
        btnDelete.style.color = 'var(--red)';
        btnDelete.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        btnDelete.textContent = 'স্থায়ীভাবে ডিলিট (Delete)';
        btnDelete.title = 'ডাটাবেস থেকে সম্পূর্ণ মুছে ফেলুন';
        btnDelete.onclick = () => deleteReport(item.id);

        actionBox.append(statusPill, btnDelete);
        card.append(actionBox);
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

async function deleteReport(id) {
  const confirmMsg = 'এই রিপোর্টটি কি ভুয়া বা ভুল প্রমাণিত হয়েছে? আপনি কি এটি ডাটাবেস ও লাইভ ম্যাপ থেকে স্থায়ীভাবে ডিলিট (Permanent Delete) করতে চান? এই অ্যাকশনটি অপরিবর্তনীয়।';
  if (!confirm(confirmMsg)) return;

  try {
    await api(`/api/admin/reports/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    $('adminMessage').textContent = `রিপোর্ট #${id} সফলভাবে সিস্টেম থেকে স্থায়ীভাবে ডিলিট করা হয়েছে।`;
    $('adminMessage').style.color = 'var(--teal)';
    await loadQueue();
  } catch (err) {
    alert(err.message || 'রিপোর্ট ডিলিট করা যায়নি।');
  }
}

async function updateStatus(id, state, verificationStatus, note) {
  const confirmMsg = state === 'approved' ? 'এই রিপোর্টটি অনুমোদন ও প্রকাশ করতে চান?' : 'এই রিপোর্টটি বাতিল বা প্রত্যাহার করতে চান?';
  if (!confirm(confirmMsg)) return;

  try {
    await api(`/api/admin/reports/${id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: state,
        verification_status: verificationStatus,
        moderator_note: note
      })
    });
    await loadQueue();
  } catch (err) {
    alert(err.message);
  }
}

$('moderationStatus').onchange = loadQueue;
$('filterVerification').onchange = loadQueue;
$('refreshAdminBtn').onclick = loadQueue;

// 6. Analytics Overview
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

    const verif = data.verification_breakdown || {};
    $text('analyticsNewsReports', verif.published_news_report || 0);
    $text('analyticsIndVerified', verif.independently_verified || 0);
    $text('analyticsModerated', verif.moderated || 0);
    $text('analyticsRejectedReports', data.rejected_reports || 0);

    if (adminVisitChart) adminVisitChart.destroy();

    const labels = (data.daily_visits || []).map(v => v.date.slice(5));
    const counts = (data.daily_visits || []).map(v => v.count);
    const ink = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#64748B';

    adminVisitChart = new Chart($('adminVisitChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: lang === 'bn' ? 'দৈনিক ভিজিটর' : 'Daily Visitors',
          data: counts,
          borderColor: '#00BFA6',
          backgroundColor: 'rgba(0, 191, 166, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#00BFA6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
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

// 7. Auto-start
renderLanguage();
if (adminToken) {
  showDashboard();
} else {
  showAuth();
}

// Developer Profile Modal handlers
function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

if ($('adminDevProfileBtn')) {
  $('adminDevProfileBtn').onclick = () => openModal('devProfileModal');
}
document.querySelectorAll('[data-close="devProfileModal"]').forEach(b => {
  b.onclick = () => closeModal('devProfileModal');
});
if ($('devProfileModal')) {
  $('devProfileModal').addEventListener('click', e => {
    if (e.target === $('devProfileModal')) closeModal('devProfileModal');
  });
}
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('devProfileModal')) closeModal('devProfileModal');
});
