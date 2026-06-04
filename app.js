/**
 * BookHouse — app.js
 * Frontend Library Borrowing System
 * Data tersimpan di Supabase (PostgreSQL + Auth)
 */

'use strict';

const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

// ============================================================
//  SESSION HELPERS (gunakan localStorage hanya untuk cache session)
// ============================================================
function getSession() {
  try { const v = localStorage.getItem('bh_session'); return v ? JSON.parse(v) : null; } catch { return null; }
}
function setSession(data) {
  try { localStorage.setItem('bh_session', JSON.stringify(data)); } catch {}
}
function clearSession() {
  localStorage.removeItem('bh_session');
  localStorage.removeItem('bh_last_ticket');
}

// ============================================================
//  TOAST NOTIFICATION
// ============================================================
function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" aria-label="Tutup">✕</button>
  `;
  el.querySelector('.toast-close').onclick = () => el.remove();
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    el.style.transition = 'all .3s';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ============================================================
//  UTILITY
// ============================================================
function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(date instanceof Date ? date : new Date(date));
}
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function initials(name) { return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); }

function generateTicketNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'BH-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ============================================================
//  LANDING PAGE
// ============================================================
function initLanding() {
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    nav.style.background = window.scrollY > 60 ? 'rgba(11,15,26,.98)' : 'rgba(11,15,26,.8)';
  });

  const toggle = document.getElementById('navToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const links = document.querySelector('.nav-links');
      if (links) {
        links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
        links.style.flexDirection = 'column';
        links.style.position = 'absolute';
        links.style.top = '64px';
        links.style.left = '0'; links.style.right = '0';
        links.style.background = 'var(--bg-800)';
        links.style.padding = '1.5rem 2rem';
        links.style.borderBottom = '1px solid rgba(255,255,255,.06)';
      }
    });
  }
}

// ============================================================
//  LOGIN PAGE
// ============================================================
function initLogin() {
  const tabUser = document.getElementById('tabUser');
  const tabAdmin = document.getElementById('tabAdmin');
  const formUser = document.getElementById('formUser');
  const formAdmin = document.getElementById('formAdmin');

  if (tabUser && tabAdmin) {
    tabUser.addEventListener('click', () => {
      tabUser.classList.add('active'); tabAdmin.classList.remove('active');
      formUser.classList.remove('hidden'); formAdmin.classList.add('hidden');
    });
    tabAdmin.addEventListener('click', () => {
      tabAdmin.classList.add('active'); tabUser.classList.remove('active');
      formAdmin.classList.remove('hidden'); formUser.classList.add('hidden');
    });
  }

  setupPassToggle('toggleUserPass', 'userPassword');
  setupPassToggle('toggleAdminPass', 'adminPassword');

  // User Login via Supabase Auth
  const loginUserForm = document.getElementById('loginUserForm');
  if (loginUserForm) {
    loginUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('userEmail').value.trim();
      const pass = document.getElementById('userPassword').value;
      const btn = document.getElementById('loginUserBtn');
      let ok = true;

      clearErrors(['userEmailErr', 'userPassErr']);
      if (!email) { setError('userEmailErr', 'Email wajib diisi'); ok = false; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('userEmailErr', 'Format email tidak valid'); ok = false; }
      if (!pass) { setError('userPassErr', 'Password wajib diisi'); ok = false; }
      if (!ok) return;

      setLoading(btn, true);
      const { data, error } = await sbSignIn(email, pass);

      if (error) {
        setLoading(btn, false);
        setError('userPassErr', 'Email atau password salah');
        return;
      }

      const profile = await dbGetProfile(data.user.id);
      const firstName = profile?.first_name || data.user.user_metadata?.first_name || 'User';
      const lastName = profile?.last_name || data.user.user_metadata?.last_name || '';

      setSession({ type: 'user', id: data.user.id, email: data.user.email, firstName, lastName });
      setLoading(btn, false);
      showToast(`Selamat datang, ${firstName}! 🎉`, 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    });
  }

  // Lupa Password Modal
  const forgotLink = document.getElementById('forgotPasswordLink');
  const forgotModal = document.getElementById('forgotModal');
  const closeForgotModal = document.getElementById('closeForgotModal');
  const sendResetBtn = document.getElementById('sendResetBtn');

  forgotLink?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('forgotEmail').value = '';
    document.getElementById('forgotEmailErr').textContent = '';
    document.getElementById('forgotFormGroup').classList.remove('hidden');
    document.getElementById('forgotSuccess').classList.add('hidden');
    sendResetBtn.classList.remove('hidden');
    forgotModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  closeForgotModal?.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  forgotModal?.addEventListener('click', (e) => {
    if (e.target.id === 'forgotModal') {
      forgotModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });

  sendResetBtn?.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const errEl = document.getElementById('forgotEmailErr');
    errEl.textContent = '';

    if (!email) { errEl.textContent = 'Email wajib diisi'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Format email tidak valid'; return; }

    setLoading(sendResetBtn, true);

    // URL redirect ke halaman reset — sesuaikan dengan URL GitHub Pages kamu
    const redirectUrl = window.location.origin + window.location.pathname.replace('login.html', '') + 'reset-password.html';
    const { error } = await sbResetPassword(email, redirectUrl);

    setLoading(sendResetBtn, false);

    if (error) {
      errEl.textContent = 'Gagal mengirim email. Pastikan email terdaftar.';
      return;
    }

    // Tampilkan pesan sukses
    document.getElementById('forgotFormGroup').classList.add('hidden');
    sendResetBtn.classList.add('hidden');
    document.getElementById('forgotSuccess').classList.remove('hidden');
  });

  // Admin Login (hardcoded, tidak pakai Supabase Auth)
  const loginAdminForm = document.getElementById('loginAdminForm');
  if (loginAdminForm) {
    loginAdminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('adminUsername').value.trim();
      const pass = document.getElementById('adminPassword').value;
      const btn = document.getElementById('loginAdminBtn');
      let ok = true;

      clearErrors(['adminUserErr', 'adminPassErr']);
      if (!username) { setError('adminUserErr', 'Username wajib diisi'); ok = false; }
      if (!pass) { setError('adminPassErr', 'Password wajib diisi'); ok = false; }
      if (!ok) return;

      setLoading(btn, true);
      setTimeout(() => {
        if (username !== ADMIN_CREDENTIALS.username || pass !== ADMIN_CREDENTIALS.password) {
          setLoading(btn, false);
          setError('adminPassErr', 'Username atau password admin salah');
          return;
        }
        setSession({ type: 'admin', username: 'admin' });
        setLoading(btn, false);
        showToast('Login Admin berhasil! 🛡️', 'success');
        setTimeout(() => window.location.href = 'admin.html', 800);
      }, 600);
    });
  }
}

// ============================================================
//  REGISTER PAGE
// ============================================================
function initRegister() {
  setupPassToggle('toggleRegPass', 'regPassword');

  const passInput = document.getElementById('regPassword');
  if (passInput) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      const fill = document.getElementById('strengthFill');
      const text = document.getElementById('strengthText');
      if (!fill || !text) return;
      let strength = 0;
      if (val.length >= 6) strength++;
      if (val.length >= 10) strength++;
      if (/[A-Z]/.test(val)) strength++;
      if (/[0-9]/.test(val)) strength++;
      if (/[^A-Za-z0-9]/.test(val)) strength++;

      const levels = [
        { w: '0%', color: 'transparent', label: '' },
        { w: '20%', color: '#f43f5e', label: 'Sangat Lemah' },
        { w: '40%', color: '#f97316', label: 'Lemah' },
        { w: '60%', color: '#fbbf24', label: 'Cukup' },
        { w: '80%', color: '#10b981', label: 'Kuat' },
        { w: '100%', color: '#059669', label: 'Sangat Kuat' },
      ];
      const lvl = levels[Math.min(strength, 5)];
      fill.style.width = lvl.w;
      fill.style.background = lvl.color;
      text.textContent = lvl.label;
      text.style.color = lvl.color;
    });
  }

  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const address = document.getElementById('regAddress').value.trim();
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPass').value;
    const agree = document.getElementById('agreeTerms').checked;
    const btn = document.getElementById('registerBtn');

    clearErrors(['firstNameErr', 'lastNameErr', 'regEmailErr', 'regPhoneErr', 'regAddressErr', 'regPassErr', 'regConfirmPassErr']);
    let ok = true;
    if (!firstName) { setError('firstNameErr', 'Nama depan wajib diisi'); ok = false; }
    if (!lastName) { setError('lastNameErr', 'Nama belakang wajib diisi'); ok = false; }
    if (!email) { setError('regEmailErr', 'Email wajib diisi'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('regEmailErr', 'Format email tidak valid'); ok = false; }
    if (!phone) { setError('regPhoneErr', 'Nomor telepon wajib diisi'); ok = false; }
    if (!address) { setError('regAddressErr', 'Alamat wajib diisi'); ok = false; }
    if (!pass || pass.length < 6) { setError('regPassErr', 'Password minimal 6 karakter'); ok = false; }
    if (pass !== confirmPass) { setError('regConfirmPassErr', 'Password tidak cocok'); ok = false; }
    if (!agree) { showToast('Anda harus menyetujui syarat dan ketentuan', 'error'); ok = false; }
    if (!ok) return;

    setLoading(btn, true);

    // Daftar via Supabase Auth
    const { data, error } = await sbSignUp(email, pass, { first_name: firstName, last_name: lastName });

    if (error) {
      setLoading(btn, false);
      if (error.message.includes('already registered')) {
        setError('regEmailErr', 'Email sudah terdaftar');
      } else {
        showToast('Gagal mendaftar: ' + error.message, 'error');
      }
      return;
    }

    // Simpan data tambahan ke tabel profiles
    if (data.user) {
      await dbInsertProfile({
        id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        phone,
        address,
      });

      setSession({ type: 'user', id: data.user.id, email: data.user.email, firstName, lastName });
    }

    setLoading(btn, false);
    showToast('Pendaftaran berhasil! Selamat datang 🎉', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 900);
  });
}

// ============================================================
//  USER DASHBOARD
// ============================================================
let selectedBook = null;
let borrowPhotoDataUrl = null;
let _cachedBooks = [];
let _cachedFavourites = [];

function initDashboard() {
  const session = getSession();
  if (!session || session.type !== 'user') {
    window.location.href = 'login.html'; return;
  }

  // Set user info
  const fullName = `${session.firstName} ${session.lastName}`;
  setText('welcomeName', session.firstName);
  setText('sidebarUserName', fullName);
  const av = initials(fullName);
  setText('sidebarAvatar', av);
  setText('topbarAvatar', av);

  const dateEl = document.getElementById('welcomeDate');
  if (dateEl) dateEl.innerHTML = formatDate(new Date()).replace(' ', '<br/>');

  setupSidebar('sidebar', 'hamburger', 'sidebarClose', 'sidebarOverlay');

  // Nav links
  const navSectionMap = { navdashboard:'dashboard', navexplore:'explore', navborrows:'borrows', navfav:'favourites' };
  document.querySelectorAll('.sidebar-link[id^="nav"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = navSectionMap[link.id.toLowerCase()] || link.id.replace('nav','').toLowerCase();
      showSection(sec);
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      if (sec === 'explore') renderExploreBooks();
      if (sec === 'borrows') renderBorrowsTable();
      if (sec === 'favourites') renderFavourites();
    });
  });

  // Logout
  document.getElementById('userLogout')?.addEventListener('click', async () => {
    await sbSignOut();
    clearSession();
    window.location.href = 'login.html';
  });

  // Search & filter
  document.getElementById('searchBooks')?.addEventListener('input', renderExploreBooks);
  document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
    const cat = e.target.value;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    renderExploreBooks();
  });

  document.getElementById('categoryTabs')?.addEventListener('click', (e) => {
    if (!e.target.classList.contains('cat-tab')) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    const catFilter = document.getElementById('categoryFilter');
    if (catFilter) catFilter.value = e.target.dataset.cat;
    renderExploreBooks();
  });

  // Book modal
  document.getElementById('closeBookModal')?.addEventListener('click', closeBookModal);
  document.getElementById('bookModal')?.addEventListener('click', (e) => { if (e.target.id === 'bookModal') closeBookModal(); });
  document.getElementById('modalBorrowBtn')?.addEventListener('click', openBorrowModal);

  setupBorrowModal();

  // Load semua data
  loadDashboardData();

  if (location.hash === '#explore') showSection('explore');
  else if (location.hash === '#borrows') showSection('borrows');
  else if (location.hash === '#favourites') showSection('favourites');
}

async function loadDashboardData() {
  const session = getSession();
  // Ambil data dari Supabase
  _cachedBooks = await dbGetBooks();
  _cachedFavourites = await dbGetFavourites(session.id);

  updateStats();
  renderTrending();
  renderBorrowList();
  renderExploreBooks();
  renderBorrowsTable();
  renderFavourites();
}

function showSection(name) {
  const sections = { dashboard:'sectionDashboard', explore:'sectionExplore', borrows:'sectionBorrows', favourites:'sectionFavourites' };
  Object.entries(sections).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', key !== name);
  });
  const sidebar = document.getElementById('sidebar');
  if (sidebar && window.innerWidth < 900) sidebar.classList.remove('open');
}

async function updateStats() {
  const session = getSession();
  const borrows = await dbGetBorrows(session.id);
  const active = borrows.filter(b => b.status === 'active' || b.status === 'pending');
  const returned = borrows.filter(b => b.status === 'returned');
  setText('statBorrowCount', borrows.length);
  setText('statReturnCount', returned.length);
  setText('statTicketCount', active.length);
}

function renderTrending() {
  const books = _cachedBooks.slice(0, 5);
  const list = document.getElementById('trendingList');
  if (!list) return;
  list.innerHTML = books.map((b, i) => `
    <div class="trending-item" onclick="openBookDetail(${b.id})">
      <span class="trending-rank">${i+1}</span>
      <div class="mini-cover" style="background:${b.color}; position:relative; overflow:hidden;">
        ${b.cover_url ? `<img src="${b.cover_url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>` : ''}
        <span style="position:relative; z-index:1; ${b.cover_url ? 'display:none;' : ''}">📚</span>
      </div>
      <div class="trending-info">
        <div class="trending-title">${b.title}</div>
        <div class="trending-author">${b.author}</div>
      </div>
      <span style="color:var(--yellow);font-size:.8rem">${'★'.repeat(b.rating)}</span>
    </div>
  `).join('');
}

async function renderBorrowList() {
  const session = getSession();
  const borrows = (await dbGetBorrows(session.id)).slice(0, 4);
  const list = document.getElementById('borrowList');
  if (!list) return;
  if (!borrows.length) {
    list.innerHTML = '<div class="empty-state-sm"><span>📭</span><p>Belum ada peminjaman</p></div>';
    return;
  }
  list.innerHTML = borrows.map(borrow => {
    const book = _cachedBooks.find(b => b.id === borrow.book_id) || {};
    return `
      <div class="borrow-item">
        <div class="mini-cover" style="background:${book.color||'var(--surface)'}; position:relative; overflow:hidden;">
          ${book.cover_url ? `<img src="${book.cover_url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>` : ''}
          <span style="position:relative; z-index:1; ${book.cover_url ? 'display:none;' : ''}">📖</span>
        </div>
        <div class="borrow-info">
          <div class="borrow-title">${book.title||'—'}</div>
          <div class="borrow-date">${formatDate(borrow.borrow_date)}</div>
        </div>
        <span class="status-chip chip-${borrow.status}">${statusLabel(borrow.status)}</span>
      </div>
    `;
  }).join('');
}

function statusLabel(s) {
  return { pending:'Pending', active:'Aktif', returned:'Kembali' }[s] || s;
}

function renderExploreBooks() {
  const grid = document.getElementById('booksGrid');
  const badge = document.getElementById('bookCountBadge');
  if (!grid) return;
  const search = (document.getElementById('searchBooks')?.value || '').toLowerCase();
  const cat = document.getElementById('categoryFilter')?.value || '';
  let books = _cachedBooks;
  if (search) books = books.filter(b => b.title.toLowerCase().includes(search) || b.author.toLowerCase().includes(search));
  if (cat) books = books.filter(b => b.category === cat);
  if (badge) badge.textContent = `${books.length} buku`;
  if (!books.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>Buku tidak ditemukan</h3><p>Coba kata kunci lain.</p></div>';
    return;
  }
  grid.innerHTML = books.map(b => bookCardHTML(b)).join('');
}

function bookCardHTML(b) {
  const fav = _cachedFavourites.includes(b.id);
  const stockColor = b.stock === 0 ? 'var(--red)' : b.stock <= 3 ? 'var(--yellow)' : 'var(--green)';
  return `
    <div class="book-card" onclick="openBookDetail(${b.id})" data-book-id="${b.id}">
      <div class="book-cover" style="background:${b.color}; position:relative; overflow:hidden; padding:0;">
        ${b.cover_url ?
          `<img src="${b.cover_url}" alt="Cover" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0; z-index:0;" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
           <div class="fallback-cover" style="display:none; position:absolute; inset:0; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; z-index:1;">
             <div class="book-pattern"></div>
             <div class="book-cover-content" style="position:relative; z-index:2; text-align:center;">
               <div class="book-cover-icon">📚</div>
               <span>${b.category.toUpperCase()}</span>
             </div>
           </div>`
        :
          `<div class="book-pattern"></div>
           <div class="book-cover-content">
             <div class="book-cover-icon">📚</div>
             <span>${b.category.toUpperCase()}</span>
           </div>`
        }
        ${b.stock === 0 ? '<div class="book-badge" style="background:var(--red); z-index:3;">Habis</div>' : ''}
        <button class="fav-btn" onclick="toggleFav(event,${b.id})" title="${fav?'Hapus dari favorit':'Tambah ke favorit'}" style="position:absolute;top:8px;left:10px;background:rgba(0,0,0,.5);border:none;cursor:pointer;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:.9rem;transition:all .2s; z-index:3;">
          ${fav ? '⭐' : '☆'}
        </button>
      </div>
      <div class="book-info">
        <span class="book-category">${b.category}</span>
        <h4 class="book-title">${b.title}</h4>
        <p class="book-author">${b.author}</p>
        <div class="book-meta">
          <div class="book-stars">${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</div>
          <span class="book-stock" style="color:${stockColor}">Stok: ${b.stock}</span>
        </div>
      </div>
    </div>
  `;
}

async function toggleFav(e, id) {
  e.stopPropagation();
  const session = getSession();
  const added = await dbToggleFavourite(session.id, id);
  if (added) {
    _cachedFavourites.push(id);
    showToast('Ditambahkan ke favorit ⭐', 'success');
  } else {
    _cachedFavourites = _cachedFavourites.filter(f => f !== id);
    showToast('Dihapus dari favorit', 'info');
  }
  renderExploreBooks();
  renderFavourites();
}

function renderFavourites() {
  const grid = document.getElementById('favGrid');
  if (!grid) return;
  const books = _cachedBooks.filter(b => _cachedFavourites.includes(b.id));
  if (!books.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><h3>Belum ada favorit</h3><p>Tambahkan buku ke favorit dengan menekan ikon bintang di kartu buku.</p></div>';
    return;
  }
  grid.innerHTML = books.map(b => bookCardHTML(b)).join('');
}

function openBookDetail(id) {
  const b = _cachedBooks.find(bk => bk.id === id);
  if (!b) return;
  selectedBook = b;
  const modal = document.getElementById('bookModal');
  if (!modal) return;

  const coverEl = document.getElementById('modalCover');
  coverEl.style.background = b.color;
  coverEl.style.position = 'relative';
  coverEl.style.overflow = 'hidden';
  coverEl.style.padding = '0';
  if (b.cover_url) {
    coverEl.innerHTML = `<img src="${b.cover_url}" alt="Cover ${b.title}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0;transition:opacity .4s" onload="this.style.opacity='1'" onerror="this.parentElement.innerHTML='<span style=\\'font-size:3rem;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)\\'>📚</span>'"/>`;
  } else {
    coverEl.innerHTML = '<span style="font-size:3rem;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">📚</span>';
  }

  document.getElementById('modalCategory').textContent = b.category;
  document.getElementById('modalTitle').textContent = b.title;
  document.getElementById('modalAuthor').textContent = `oleh ${b.author}`;
  document.getElementById('modalDesc').textContent = b.description;
  document.getElementById('modalStock').textContent = `Stok: ${b.stock}`;
  document.getElementById('modalYear').textContent = `Tahun: ${b.year}`;
  document.getElementById('modalStars').textContent = '★'.repeat(b.rating) + '☆'.repeat(5-b.rating);

  const borrowBtn = document.getElementById('modalBorrowBtn');
  if (b.stock <= 0) {
    borrowBtn.textContent = '❌ Stok Habis';
    borrowBtn.disabled = true;
    borrowBtn.style.opacity = '.5';
  } else {
    borrowBtn.innerHTML = '🎫 Pinjam Buku Ini';
    borrowBtn.disabled = false;
    borrowBtn.style.opacity = '1';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBookModal() {
  document.getElementById('bookModal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ============================================================
//  BORROW MODAL
// ============================================================
function openBorrowModal() {
  closeBookModal();
  const modal = document.getElementById('borrowModal');
  if (!modal || !selectedBook) return;

  const session = getSession();
  const fullNameEl = document.getElementById('borrowFullName');
  if (fullNameEl) fullNameEl.value = `${session.firstName} ${session.lastName}`;

  const info = document.getElementById('selectedBookInfo');
  if (info) {
    info.innerHTML = `
      <div style="background:${selectedBook.color};width:56px;height:75px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0">📚</div>
      <div>
        <div style="font-size:.75rem;color:var(--accent);font-weight:700;text-transform:uppercase">${selectedBook.category}</div>
        <div style="font-size:1rem;font-weight:800;color:var(--text-100);margin:.2rem 0">${selectedBook.title}</div>
        <div style="font-size:.83rem;color:var(--text-300)">${selectedBook.author}</div>
      </div>
    `;
  }

  goToBorrowStep(1);
  borrowPhotoDataUrl = null;
  resetUploadArea();

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function setupBorrowModal() {
  document.getElementById('closeBorrowModal')?.addEventListener('click', closeBorrowModal);
  document.getElementById('borrowModal')?.addEventListener('click', (e) => { if (e.target.id === 'borrowModal') closeBorrowModal(); });
  document.getElementById('cancelBorrow')?.addEventListener('click', closeBorrowModal);
  document.getElementById('backStep1')?.addEventListener('click', () => goToBorrowStep(1));
  document.getElementById('backStep2')?.addEventListener('click', () => goToBorrowStep(2));
  document.getElementById('goStep2')?.addEventListener('click', () => goToBorrowStep(2));

  document.getElementById('goStep3')?.addEventListener('click', () => {
    const name = document.getElementById('borrowFullName')?.value.trim() || '';
    const idNum = document.getElementById('borrowIdNum')?.value.trim() || '';
    const phone = document.getElementById('borrowPhone')?.value.trim() || '';
    let ok = true;
    clearErrors(['borrowNameErr','borrowIdErr','borrowPhoneErr','uploadErr']);

    if (!name) { setError('borrowNameErr','Nama lengkap wajib diisi'); ok = false; }
    if (!idNum) { setError('borrowIdErr','Nomor identitas wajib diisi'); ok = false; }
    if (!phone) { setError('borrowPhoneErr','Nomor HP wajib diisi'); ok = false; }
    if (!borrowPhotoDataUrl) { setError('uploadErr','Foto identitas wajib diupload'); ok = false; }
    if (!ok) return;

    const dur = parseInt(document.getElementById('borrowDuration')?.value || 7);
    const deadline = addDays(new Date(), dur);
    const summary = document.getElementById('confirmSummary');
    if (summary) {
      summary.innerHTML = `
        <div class="confirm-row full"><div class="clabel">Buku</div><div class="cval">${selectedBook.title}</div></div>
        <div class="confirm-row"><div class="clabel">Nama Peminjam</div><div class="cval">${name}</div></div>
        <div class="confirm-row"><div class="clabel">No. Identitas</div><div class="cval">${idNum}</div></div>
        <div class="confirm-row"><div class="clabel">Nomor HP</div><div class="cval">${phone}</div></div>
        <div class="confirm-row"><div class="clabel">Durasi Pinjam</div><div class="cval">${dur} hari</div></div>
        <div class="confirm-row"><div class="clabel">Batas Kembali</div><div class="cval">${formatDate(deadline)}</div></div>
      `;
    }
    goToBorrowStep(3);
  });

  document.getElementById('submitBorrow')?.addEventListener('click', submitBorrow);

  // Upload handlers
  const uploadArea = document.getElementById('uploadArea');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('idPhotoInput');
  const removePhoto = document.getElementById('removePhoto');

  uploadBtn?.addEventListener('click', () => fileInput?.click());
  uploadArea?.addEventListener('click', (e) => { if (e.target === uploadArea || e.target.classList.contains('upload-placeholder')) fileInput?.click(); });
  uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragging'); });
  uploadArea?.addEventListener('dragleave', () => uploadArea.classList.remove('dragging'));
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragging');
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  });
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  });
  removePhoto?.addEventListener('click', (e) => { e.stopPropagation(); resetUploadArea(); borrowPhotoDataUrl = null; });
}

function processFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Hanya file gambar yang diizinkan', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Ukuran file maksimum 5MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    borrowPhotoDataUrl = e.target.result;
    document.getElementById('uploadPlaceholder')?.classList.add('hidden');
    document.getElementById('uploadPreview')?.classList.remove('hidden');
    const img = document.getElementById('previewImg');
    if (img) img.src = borrowPhotoDataUrl;
    const nameEl = document.getElementById('previewName');
    if (nameEl) nameEl.textContent = file.name;
    clearErrors(['uploadErr']);
  };
  reader.readAsDataURL(file);
}

function resetUploadArea() {
  document.getElementById('uploadPlaceholder')?.classList.remove('hidden');
  document.getElementById('uploadPreview')?.classList.add('hidden');
  const fileInput = document.getElementById('idPhotoInput');
  if (fileInput) fileInput.value = '';
  const img = document.getElementById('previewImg');
  if (img) img.src = '';
}

function goToBorrowStep(n) {
  [1,2,3].forEach(i => {
    const content = document.getElementById(`borrowStep${i}`);
    if (content) content.classList.toggle('hidden', i !== n);
    const ind = document.getElementById(`step${i}Ind`);
    if (ind) {
      ind.classList.remove('active','done');
      if (i === n) ind.classList.add('active');
      else if (i < n) ind.classList.add('done');
    }
  });
  const conn = document.querySelectorAll('.step-connector');
  conn.forEach((c, i) => c.classList.toggle('done', i + 1 < n));
}

function closeBorrowModal() {
  document.getElementById('borrowModal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

async function submitBorrow() {
  const session = getSession();
  const btn = document.getElementById('submitBorrow');
  setLoading(btn, true);

  const name = document.getElementById('borrowFullName')?.value.trim() || '';
  const idNum = document.getElementById('borrowIdNum')?.value.trim() || '';
  const phone = document.getElementById('borrowPhone')?.value.trim() || '';
  const dur = parseInt(document.getElementById('borrowDuration')?.value || 7);
  const notes = document.getElementById('borrowNotes')?.value.trim() || '';

  const ticketNumber = generateTicketNumber();
  const borrowDate = new Date();
  const deadline = addDays(borrowDate, dur);

  // Upload foto ke Supabase Storage
  let photoUrl = null;
  if (borrowPhotoDataUrl) {
    const tempId = `${Date.now()}`;
    photoUrl = await uploadIdPhoto(session.id, tempId, borrowPhotoDataUrl);
  }

  // Simpan borrow ke database
  const { data: borrow, error } = await dbInsertBorrow({
    ticket_number: ticketNumber,
    user_id: session.id,
    book_id: selectedBook.id,
    borrower_name: name,
    borrower_id_num: idNum,
    borrower_phone: phone,
    borrow_date: borrowDate.toISOString(),
    deadline: deadline.toISOString(),
    duration: dur,
    notes,
    photo_url: photoUrl,
    status: 'pending',
  });

  if (error) {
    setLoading(btn, false);
    showToast('Gagal membuat peminjaman: ' + error.message, 'error');
    return;
  }

  // Kurangi stok buku
  const updatedBook = await dbUpdateBook(selectedBook.id, { stock: selectedBook.stock - 1 });
  if (updatedBook.data) {
    const idx = _cachedBooks.findIndex(b => b.id === selectedBook.id);
    if (idx >= 0) _cachedBooks[idx] = updatedBook.data;
  }

  // Simpan tiket ke localStorage untuk halaman ticket.html
  localStorage.setItem('bh_last_ticket', JSON.stringify(borrow));

  setLoading(btn, false);
  closeBorrowModal();
  showToast('Permintaan peminjaman berhasil! 🎫', 'success');
  setTimeout(() => window.location.href = 'ticket.html', 800);
}

async function renderBorrowsTable() {
  const session = getSession();
  const borrows = await dbGetBorrows(session.id);
  const tbody = document.getElementById('borrowsTableBody');
  if (!tbody) return;
  if (!borrows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row"><span>📭 Belum ada riwayat peminjaman</span></td></tr>';
    return;
  }
  tbody.innerHTML = borrows.map((b, i) => {
    const book = _cachedBooks.find(bk => bk.id === b.book_id) || {};
    return `
      <tr>
        <td>${i+1}</td>
        <td>${book.title || '—'}</td>
        <td>${formatDate(b.borrow_date)}</td>
        <td><span class="status-chip chip-${b.status}">${statusLabel(b.status)}</span></td>
        <td><button class="view-ticket-btn" onclick="viewTicket('${b.id}')">Lihat Tiket</button></td>
      </tr>
    `;
  }).join('');
}

async function viewTicket(borrowId) {
  const borrow = await dbGetBorrow(borrowId);
  if (!borrow) return;
  localStorage.setItem('bh_last_ticket', JSON.stringify(borrow));
  window.location.href = 'ticket.html';
}

// ============================================================
//  TICKET PAGE
// ============================================================
function initTicket() {
  const raw = localStorage.getItem('bh_last_ticket');
  const borrow = raw ? JSON.parse(raw) : null;
  if (!borrow) { window.location.href = 'dashboard.html'; return; }

  // Ambil data buku dari cache atau fetch langsung
  async function loadTicket() {
    const book = await dbGetBook(borrow.book_id) || {};

    setText('ticketBookTitle', book.title || '—');
    setText('ticketBookAuthor', book.author ? `oleh ${book.author}` : '—');
    setText('ticketCategory', book.category || '—');
    setText('ticketName', borrow.borrower_name || '—');
    setText('ticketId', borrow.borrower_id_num || '—');
    setText('ticketDate', formatDate(borrow.borrow_date));
    setText('ticketDeadline', formatDate(borrow.deadline));
    setText('ticketNumber', borrow.ticket_number);
    setText('barcodeText', borrow.ticket_number);

    const cover = document.getElementById('ticketBookCover');
    if (cover) {
      cover.style.background = book.color || 'var(--surface)';
      cover.innerHTML = '<span style="font-size:2rem">📚</span>';
    }

    generateQR(borrow.ticket_number);
    generateBarcode(borrow.ticket_number);
  }

  loadTicket();

  document.getElementById('printTicket')?.addEventListener('click', () => window.print());
  document.getElementById('downloadTicket')?.addEventListener('click', () => {
    showToast('Gunakan Cetak untuk menyimpan sebagai PDF.', 'info', 5000);
  });
}

function generateQR(seed) {
  const grid = document.getElementById('qrGrid');
  if (!grid) return;
  grid.innerHTML = '';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    const rand = Math.abs((hash * (i + 1) * 7) % 100);
    cell.style.background = rand > 45 ? 'var(--text-100)' : 'transparent';
    grid.appendChild(cell);
  }
}

function generateBarcode(seed) {
  const container = document.getElementById('ticketBarcode');
  if (!container) return;
  const existing = container.querySelector('.barcode-lines');
  if (!existing) return;
  existing.innerHTML = '';
  let hash = 0;
  for (let c of seed) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const h = Math.abs((hash * (i + 1) * 13) % 36) + 12;
    const w = i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
    bar.style.height = `${h}px`;
    bar.style.width = `${w}px`;
    existing.appendChild(bar);
  }
}

// ============================================================
//  ADMIN DASHBOARD
// ============================================================
let adminDeleteTarget = null;
let selectedBookColor = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
let selectedCatColor = '#6366f1';
let adminCoverDataUrl = null;
let _adminBooks = [];
let _adminCategories = [];
let _adminBorrows = [];
let _adminProfiles = [];

function initAdmin() {
  const session = getSession();
  if (!session || session.type !== 'admin') {
    window.location.href = 'login.html'; return;
  }

  setupSidebar('adminSidebar', 'adminHamburger', 'adminSidebarClose', 'adminOverlay');

  document.querySelectorAll('[data-admin-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = link.dataset.adminSection;
      adminShowSection(sec);
      document.querySelectorAll('[data-admin-section]').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const titleMap = { overview:'Overview', books:'Kelola Buku', categories:'Kategori Buku', borrows:'Data Peminjaman', users:'Data User' };
      setText('adminPageTitle', titleMap[sec] || sec);
    });
  });

  document.getElementById('adminLogout')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'login.html';
  });

  // Book form
  document.getElementById('openAddBookModal')?.addEventListener('click', () => openBookForm());
  document.getElementById('closeBookForm')?.addEventListener('click', closeBookForm);
  document.getElementById('cancelBookForm')?.addEventListener('click', closeBookForm);
  document.getElementById('bookFormModal')?.addEventListener('click', (e) => { if (e.target.id === 'bookFormModal') closeBookForm(); });
  document.getElementById('bookForm')?.addEventListener('submit', saveBook);

  // Category form
  document.getElementById('openAddCatModal')?.addEventListener('click', () => openCatForm());
  document.getElementById('closeCatForm')?.addEventListener('click', closeCatForm);
  document.getElementById('cancelCatForm')?.addEventListener('click', closeCatForm);
  document.getElementById('catFormModal')?.addEventListener('click', (e) => { if (e.target.id === 'catFormModal') closeCatForm(); });
  document.getElementById('catForm')?.addEventListener('submit', saveCat);

  // Color options - books
  document.querySelectorAll('#colorOptions .color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#colorOptions .color-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedBookColor = opt.dataset.color;
      document.getElementById('bookColor').value = selectedBookColor;
    });
  });

  // Color options - categories
  document.querySelectorAll('#catColorOptions .color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#catColorOptions .color-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedCatColor = opt.dataset.color;
      document.getElementById('catColor').value = selectedCatColor;
    });
  });

  // Delete modal
  document.getElementById('cancelDelete')?.addEventListener('click', () => document.getElementById('deleteModal')?.classList.add('hidden'));
  document.getElementById('deleteModal')?.addEventListener('click', (e) => { if (e.target.id === 'deleteModal') document.getElementById('deleteModal').classList.add('hidden'); });
  document.getElementById('confirmDelete')?.addEventListener('click', executeDelete);

  // Search & filter
  document.getElementById('adminSearchBook')?.addEventListener('input', adminRenderBooksTable);
  document.getElementById('adminFilterCat')?.addEventListener('change', adminRenderBooksTable);
  document.getElementById('adminBorrowFilter')?.addEventListener('change', adminRenderBorrowsTable);

  // Cover upload
  const adminUploadArea = document.getElementById('adminUploadArea');
  const adminCoverInput = document.getElementById('adminCoverInput');
  const adminRemovePhoto = document.getElementById('adminRemovePhoto');

  adminUploadArea?.addEventListener('click', (e) => {
    if (e.target === adminUploadArea || e.target.closest('#adminUploadPlaceholder')) adminCoverInput?.click();
  });
  adminUploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); adminUploadArea.classList.add('dragging'); });
  adminUploadArea?.addEventListener('dragleave', () => adminUploadArea.classList.remove('dragging'));
  adminUploadArea?.addEventListener('drop', (e) => {
    e.preventDefault(); adminUploadArea.classList.remove('dragging');
    const file = e.dataTransfer?.files[0];
    if (file) processAdminCover(file);
  });
  adminCoverInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processAdminCover(file);
  });
  adminRemovePhoto?.addEventListener('click', (e) => { e.stopPropagation(); resetAdminCover(); });

  loadAdminData();
}

async function loadAdminData() {
  [_adminBooks, _adminCategories, _adminBorrows, _adminProfiles] = await Promise.all([
    dbGetBooks(),
    dbGetCategories(),
    dbGetBorrows(),
    dbGetAllProfiles(),
  ]);

  adminUpdateStats();
  adminRenderRecentBorrows();
  adminRenderLowStock();
  adminRenderBooksTable();
  adminRenderCategories();
  adminRenderBorrowsTable();
  adminRenderUsersTable();
  populateCategoryDropdowns();
}

function processAdminCover(file) {
  if (!file.type.startsWith('image/')) { showToast('Hanya file gambar yang diizinkan', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Ukuran file maksimum 5MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    adminCoverDataUrl = e.target.result;
    document.getElementById('adminUploadPlaceholder')?.classList.add('hidden');
    document.getElementById('adminUploadPreview')?.classList.remove('hidden');
    const img = document.getElementById('adminPreviewImg');
    if (img) img.src = adminCoverDataUrl;
  };
  reader.readAsDataURL(file);
}

function resetAdminCover() {
  adminCoverDataUrl = null;
  document.getElementById('adminUploadPlaceholder')?.classList.remove('hidden');
  document.getElementById('adminUploadPreview')?.classList.add('hidden');
  const fileInput = document.getElementById('adminCoverInput');
  if (fileInput) fileInput.value = '';
  const img = document.getElementById('adminPreviewImg');
  if (img) img.src = '';
}

function adminShowSection(name) {
  const map = { overview:'adminSectionOverview', books:'adminSectionBooks', categories:'adminSectionCategories', borrows:'adminSectionBorrows', users:'adminSectionUsers' };
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', key !== name);
  });
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar && window.innerWidth < 900) sidebar.classList.remove('open');
}

function adminUpdateStats() {
  setText('adminStatBooks', _adminBooks.length);
  setText('adminStatBorrows', _adminBorrows.filter(b => b.status === 'active' || b.status === 'pending').length);
  setText('adminStatUsers', _adminProfiles.length);
  setText('adminStatCats', _adminCategories.length);
}

function adminRenderRecentBorrows() {
  const container = document.getElementById('adminRecentBorrows');
  if (!container) return;
  const borrows = _adminBorrows.slice(0, 5);
  if (!borrows.length) {
    container.innerHTML = '<div class="empty-state-sm"><span>📭</span><p>Belum ada data</p></div>'; return;
  }
  container.innerHTML = borrows.map(b => {
    const book = _adminBooks.find(bk => bk.id === b.book_id) || {};
    return `
      <div class="borrow-item">
        <div class="mini-cover" style="background:${book.color||'var(--surface)'}">📖</div>
        <div class="borrow-info">
          <div class="borrow-title">${b.borrower_name || '—'}</div>
          <div class="borrow-date">${book.title||'—'} • ${formatDate(b.borrow_date)}</div>
        </div>
        <span class="status-chip chip-${b.status}">${statusLabel(b.status)}</span>
      </div>
    `;
  }).join('');
}

function adminRenderLowStock() {
  const container = document.getElementById('adminLowStock');
  if (!container) return;
  const low = _adminBooks.filter(b => b.stock <= 3).sort((a,b) => a.stock - b.stock);
  if (!low.length) {
    container.innerHTML = '<div class="empty-state-sm"><span>✅</span><p>Semua stok aman</p></div>'; return;
  }
  container.innerHTML = low.map(b => `
    <div class="borrow-item">
      <div class="mini-cover" style="background:${b.color}">📚</div>
      <div class="borrow-info">
        <div class="borrow-title">${b.title}</div>
        <div class="borrow-date">${b.author}</div>
      </div>
      <span class="stock-badge ${b.stock===0?'stock-out':'stock-low'}">${b.stock}</span>
    </div>
  `).join('');
}

function adminRenderBooksTable() {
  const tbody = document.getElementById('adminBooksBody');
  if (!tbody) return;
  const search = (document.getElementById('adminSearchBook')?.value || '').toLowerCase();
  const cat = document.getElementById('adminFilterCat')?.value || '';
  let books = _adminBooks;
  if (search) books = books.filter(b => b.title.toLowerCase().includes(search) || b.author.toLowerCase().includes(search));
  if (cat) books = books.filter(b => b.category === cat);

  if (!books.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Tidak ada buku</td></tr>'; return;
  }
  tbody.innerHTML = books.map(b => `
    <tr>
      <td><div class="mini-book-cover" style="background:${b.color}">📚</div></td>
      <td>
        <div class="book-title-cell">${b.title}</div>
        <div class="book-author-cell">${b.author}</div>
      </td>
      <td>${b.category}</td>
      <td>${b.year}</td>
      <td><span class="stock-badge ${b.stock===0?'stock-out':b.stock<=3?'stock-low':'stock-ok'}">${b.stock}</span></td>
      <td><span class="status-chip ${b.stock>0?'chip-active':'chip-pending'}">${b.stock>0?'Tersedia':'Habis'}</span></td>
      <td>
        <div class="table-actions">
          <button class="action-btn edit-btn" title="Edit" onclick="openBookForm(${b.id})">✏️</button>
          <button class="action-btn adjust-btn" title="Tambah Stok" onclick="quickAdjustStock(${b.id})">+</button>
          <button class="action-btn delete-btn" title="Hapus" onclick="confirmDeleteBook(${b.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function adminRenderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = _adminCategories.map(c => {
    const count = _adminBooks.filter(b => b.category === c.name).length;
    return `
      <div class="category-card">
        <div class="cat-icon" style="background:${c.color}22;font-size:1.4rem">${c.icon||'📂'}</div>
        <div class="cat-info">
          <div class="cat-name">${c.name}</div>
          <div class="cat-count">${count} buku</div>
          ${c.desc ? `<div style="font-size:.73rem;color:var(--text-400);margin-top:2px">${c.desc}</div>` : ''}
        </div>
        <div class="cat-actions">
          <button class="action-btn edit-btn" title="Edit" onclick="openCatForm(${c.id})">✏️</button>
          <button class="action-btn delete-btn" title="Hapus" onclick="confirmDeleteCat(${c.id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  populateCategoryDropdowns();
}

function adminRenderBorrowsTable() {
  const tbody = document.getElementById('adminBorrowsBody');
  if (!tbody) return;
  const filter = document.getElementById('adminBorrowFilter')?.value || '';
  let borrows = filter ? _adminBorrows.filter(b => b.status === filter) : _adminBorrows;
  if (!borrows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><span>📭 Belum ada data peminjaman</span></td></tr>'; return;
  }
  tbody.innerHTML = borrows.map(b => {
    const book = _adminBooks.find(bk => bk.id === b.book_id) || {};
    return `
      <tr>
        <td style="font-family:monospace;font-size:.8rem;color:var(--accent)">${b.ticket_number}</td>
        <td>${b.borrower_name || '—'}</td>
        <td>${book.title || '—'}</td>
        <td>${formatDate(b.borrow_date)}</td>
        <td style="color:${new Date(b.deadline) < new Date() && b.status !== 'returned' ? 'var(--red)' : 'inherit'}">${formatDate(b.deadline)}</td>
        <td><span class="status-chip chip-${b.status}">${statusLabel(b.status)}</span></td>
        <td>
          <div class="table-actions">
            ${b.status !== 'returned' ? `<button class="action-btn edit-btn" onclick="markReturned('${b.id}')" title="Tandai Kembali">✓</button>` : ''}
            ${b.status === 'pending' ? `<button class="action-btn adjust-btn" onclick="markActive('${b.id}')" title="Aktifkan">🟢</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function markReturned(id) {
  const borrow = _adminBorrows.find(b => b.id == id);
  if (!borrow) return;

  const { error } = await dbUpdateBorrow(id, { status: 'returned' });
  if (error) { showToast('Gagal update status', 'error'); return; }

  // Kembalikan stok
  const book = _adminBooks.find(b => b.id === borrow.book_id);
  if (book) {
    await dbUpdateBook(book.id, { stock: book.stock + 1 });
    book.stock++;
  }

  const idx = _adminBorrows.findIndex(b => b.id == id);
  if (idx >= 0) _adminBorrows[idx].status = 'returned';

  adminRenderBorrowsTable();
  adminRenderBooksTable();
  adminUpdateStats();
  adminRenderLowStock();
  showToast('Buku berhasil ditandai kembali ✅', 'success');
}

async function markActive(id) {
  const { error } = await dbUpdateBorrow(id, { status: 'active' });
  if (error) { showToast('Gagal update status', 'error'); return; }

  const idx = _adminBorrows.findIndex(b => b.id == id);
  if (idx >= 0) _adminBorrows[idx].status = 'active';

  adminRenderBorrowsTable();
  adminUpdateStats();
  showToast('Status peminjaman diaktifkan 🟢', 'success');
}

function adminRenderUsersTable() {
  const tbody = document.getElementById('adminUsersBody');
  if (!tbody) return;
  tbody.innerHTML = _adminProfiles.map((u, i) => {
    const userBorrows = _adminBorrows.filter(b => b.user_id === u.id).length;
    return `
      <tr>
        <td>${i+1}</td>
        <td>${u.first_name} ${u.last_name}</td>
        <td>${u.phone || '—'}</td>
        <td>${u.address || '—'}</td>
        <td>${formatDate(u.created_at || new Date())}</td>
        <td>${userBorrows}</td>
        <td>
          <button class="action-btn delete-btn" onclick="confirmDeleteUser('${u.id}')" title="Hapus">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- BOOK CRUD ----
function openBookForm(id) {
  const modal = document.getElementById('bookFormModal');
  const title = document.getElementById('bookFormTitle');
  const form = document.getElementById('bookForm');
  if (!modal) return;

  form?.reset();
  document.getElementById('editBookId').value = '';
  resetAdminCover();
  selectedBookColor = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
  document.getElementById('bookColor').value = selectedBookColor;
  document.querySelectorAll('#colorOptions .color-opt').forEach((o,i) => o.classList.toggle('active', i===0));

  if (id) {
    const book = _adminBooks.find(b => b.id === id);
    if (!book) return;
    title.textContent = 'Edit Buku';
    document.getElementById('editBookId').value = book.id;
    document.getElementById('bookTitle').value = book.title;
    document.getElementById('bookAuthor').value = book.author;
    document.getElementById('bookCategory').value = book.category;
    document.getElementById('bookYear').value = book.year;
    document.getElementById('bookStock').value = book.stock;
    document.getElementById('bookPublisher').value = book.publisher || '';
    document.getElementById('bookDesc').value = book.desc || '';
    if (book.cover_url) {
      adminCoverDataUrl = book.cover_url;
      document.getElementById('adminUploadPlaceholder')?.classList.add('hidden');
      document.getElementById('adminUploadPreview')?.classList.remove('hidden');
      if (document.getElementById('adminPreviewImg')) document.getElementById('adminPreviewImg').src = adminCoverDataUrl;
    }
    selectedBookColor = book.color;
    document.getElementById('bookColor').value = selectedBookColor;
  } else {
    title.textContent = 'Tambah Buku Baru';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBookForm() {
  document.getElementById('bookFormModal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

async function saveBook(e) {
  e.preventDefault();
  const editId = document.getElementById('editBookId')?.value;
  const title = document.getElementById('bookTitle')?.value.trim();
  const author = document.getElementById('bookAuthor')?.value.trim();
  const category = document.getElementById('bookCategory')?.value;
  const year = parseInt(document.getElementById('bookYear')?.value || new Date().getFullYear());
  const stock = parseInt(document.getElementById('bookStock')?.value || 0);
  const publisher = document.getElementById('bookPublisher')?.value.trim() || '';
  const desc = document.getElementById('bookDesc')?.value.trim() || '';
  const cover_url = adminCoverDataUrl || '';
  const color = document.getElementById('bookColor')?.value || selectedBookColor;

  clearErrors(['bookTitleErr','bookAuthorErr','bookCatErr','bookStockErr']);
  let ok = true;
  if (!title) { setError('bookTitleErr','Judul wajib diisi'); ok = false; }
  if (!author) { setError('bookAuthorErr','Pengarang wajib diisi'); ok = false; }
  if (!category) { setError('bookCatErr','Pilih kategori'); ok = false; }
  if (isNaN(stock) || stock < 0) { setError('bookStockErr','Stok tidak valid'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('saveBookBtn');
  setLoading(btn, true);

  if (editId) {
    const { data, error } = await dbUpdateBook(editId, { title, author, category, year, stock, publisher, description: desc, color, cover_url });
    if (error) { showToast('Gagal update buku: ' + error.message, 'error'); setLoading(btn, false); return; }
    const idx = _adminBooks.findIndex(b => b.id == editId);
    if (idx >= 0 && data) _adminBooks[idx] = data;
  } else {
    const { data, error } = await dbInsertBook({ title, author, category, year, stock, publisher, description: desc, color, cover_url, rating: 4 });
    if (error) { showToast('Gagal tambah buku: ' + error.message, 'error'); setLoading(btn, false); return; }
    if (data) _adminBooks.push(data);
  }

  setLoading(btn, false);
  closeBookForm();
  adminRenderBooksTable();
  adminUpdateStats();
  adminRenderLowStock();
  populateCategoryDropdowns();
  showToast(editId ? 'Buku berhasil diperbarui ✅' : 'Buku baru berhasil ditambahkan 🎉', 'success');
}

async function quickAdjustStock(id) {
  const book = _adminBooks.find(b => b.id === id);
  if (!book) return;
  const newStock = prompt(`Stok saat ini: ${book.stock}\nMasukkan stok baru untuk "${book.title}":`, book.stock);
  if (newStock === null) return;
  const num = parseInt(newStock);
  if (isNaN(num) || num < 0) { showToast('Stok tidak valid', 'error'); return; }

  const { error } = await dbUpdateBook(id, { stock: num });
  if (error) { showToast('Gagal update stok', 'error'); return; }

  book.stock = num;
  adminRenderBooksTable();
  adminRenderLowStock();
  showToast(`Stok "${book.title}" diperbarui menjadi ${num}`, 'success');
}

function confirmDeleteBook(id) {
  adminDeleteTarget = { type: 'book', id };
  document.getElementById('deleteModalTitle').textContent = 'Hapus Buku?';
  document.getElementById('deleteModalMsg').textContent = 'Buku ini akan dihapus permanen dari sistem.';
  document.getElementById('deleteModal')?.classList.remove('hidden');
}

function confirmDeleteCat(id) {
  adminDeleteTarget = { type: 'cat', id };
  document.getElementById('deleteModalTitle').textContent = 'Hapus Kategori?';
  document.getElementById('deleteModalMsg').textContent = 'Kategori ini akan dihapus. Buku dalam kategori ini tidak akan terhapus.';
  document.getElementById('deleteModal')?.classList.remove('hidden');
}

function confirmDeleteUser(id) {
  adminDeleteTarget = { type: 'user', id };
  document.getElementById('deleteModalTitle').textContent = 'Hapus User?';
  document.getElementById('deleteModalMsg').textContent = 'Data user ini akan dihapus permanen.';
  document.getElementById('deleteModal')?.classList.remove('hidden');
}

async function executeDelete() {
  if (!adminDeleteTarget) return;
  const { type, id } = adminDeleteTarget;

  if (type === 'book') {
    const { error } = await dbDeleteBook(id);
    if (error) { showToast('Gagal hapus buku', 'error'); return; }
    _adminBooks = _adminBooks.filter(b => b.id !== id);
    adminRenderBooksTable(); adminUpdateStats(); adminRenderLowStock();
    showToast('Buku dihapus', 'success');
  } else if (type === 'cat') {
    const { error } = await dbDeleteCategory(id);
    if (error) { showToast('Gagal hapus kategori', 'error'); return; }
    _adminCategories = _adminCategories.filter(c => c.id !== id);
    adminRenderCategories();
    showToast('Kategori dihapus', 'success');
  } else if (type === 'user') {
    const { error } = await dbDeleteProfile(id);
    if (error) { showToast('Gagal hapus user', 'error'); return; }
    _adminProfiles = _adminProfiles.filter(u => u.id !== id);
    adminRenderUsersTable(); adminUpdateStats();
    showToast('User dihapus', 'success');
  }

  document.getElementById('deleteModal')?.classList.add('hidden');
  adminDeleteTarget = null;
}

// ---- CATEGORY CRUD ----
function openCatForm(id) {
  const modal = document.getElementById('catFormModal');
  const title = document.getElementById('catFormTitle');
  if (!modal) return;
  document.getElementById('catForm')?.reset();
  document.getElementById('editCatId').value = '';
  selectedCatColor = '#6366f1';
  document.getElementById('catColor').value = selectedCatColor;
  document.querySelectorAll('#catColorOptions .color-opt').forEach((o,i) => o.classList.toggle('active', i===0));

  if (id) {
    const cat = _adminCategories.find(c => c.id === id);
    if (!cat) return;
    title.textContent = 'Edit Kategori';
    document.getElementById('editCatId').value = cat.id;
    document.getElementById('catName').value = cat.name;
    document.getElementById('catDesc').value = cat.desc || '';
    selectedCatColor = cat.color;
    document.getElementById('catColor').value = selectedCatColor;
  } else {
    title.textContent = 'Tambah Kategori Baru';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCatForm() {
  document.getElementById('catFormModal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

async function saveCat(e) {
  e.preventDefault();
  const editId = document.getElementById('editCatId')?.value;
  const name = document.getElementById('catName')?.value.trim();
  const desc = document.getElementById('catDesc')?.value.trim() || '';
  const color = document.getElementById('catColor')?.value || selectedCatColor;

  clearErrors(['catNameErr']);
  if (!name) { setError('catNameErr','Nama kategori wajib diisi'); return; }

  if (!editId && _adminCategories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    setError('catNameErr','Kategori sudah ada'); return;
  }

  const icons = { Fiksi:'📕', Sains:'🔬', Bisnis:'💼', Psikologi:'🧠', Sejarah:'🏛️', Teknologi:'💻', Filsafat:'🧿' };

  if (editId) {
    const { data, error } = await dbUpdateCategory(editId, { name, desc, color });
    if (error) { showToast('Gagal update kategori', 'error'); return; }
    const idx = _adminCategories.findIndex(c => c.id == editId);
    if (idx >= 0 && data) _adminCategories[idx] = data;
  } else {
    const { data, error } = await dbInsertCategory({ name, desc, color, icon: icons[name] || '📂' });
    if (error) { showToast('Gagal tambah kategori', 'error'); return; }
    if (data) _adminCategories.push(data);
  }

  closeCatForm();
  adminRenderCategories();
  adminUpdateStats();
  populateCategoryDropdowns();
  showToast(editId ? 'Kategori diperbarui ✅' : 'Kategori baru ditambahkan 🎉', 'success');
}

function populateCategoryDropdowns() {
  const selects = ['bookCategory', 'adminFilterCat'];
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const currentVal = sel.value;
    const firstOption = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOption);
    _adminCategories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

// ============================================================
//  SHARED HELPERS
// ============================================================
function setupSidebar(sidebarId, hamburgerId, closeId, overlayId) {
  const sidebar = document.getElementById(sidebarId);
  const hamburger = document.getElementById(hamburgerId);
  const close = document.getElementById(closeId);
  const overlay = document.getElementById(overlayId);

  const open = () => { sidebar?.classList.add('open'); if (overlay) overlay.style.display = 'block'; };
  const closeSB = () => { sidebar?.classList.remove('open'); if (overlay) overlay.style.display = 'none'; };

  hamburger?.addEventListener('click', open);
  close?.addEventListener('click', closeSB);
  overlay?.addEventListener('click', closeSB);
}

function setupPassToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  if (!toggle || !input) return;
  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  if (loading) {
    if (text) text.style.display = 'none';
    loader?.classList.remove('hidden');
    btn.disabled = true;
  } else {
    if (text) text.style.display = '';
    loader?.classList.add('hidden');
    btn.disabled = false;
  }
}

// ============================================================
//  ROUTER
// ============================================================
(function init() {
  const page = document.body.className;

  if (page === 'page-landing') initLanding();
  else if (page === 'page-auth') {
    const session = getSession();
    if (session) {
      window.location.href = session.type === 'admin' ? 'admin.html' : 'dashboard.html';
      return;
    }
    if (document.getElementById('loginUserForm')) initLogin();
    else if (document.getElementById('registerForm')) initRegister();
  }
  else if (page === 'page-dashboard') initDashboard();
  else if (page === 'page-ticket') initTicket();
  else if (page === 'page-admin') initAdmin();
})();

// ============================================================
//  GLOBAL FUNCTIONS (inline onclick)
// ============================================================
window.openBookDetail = openBookDetail;
window.toggleFav = toggleFav;
window.viewTicket = viewTicket;
window.showSection = showSection;
window.adminShowSection = adminShowSection;
window.openBookForm = openBookForm;
window.openCatForm = openCatForm;
window.confirmDeleteBook = confirmDeleteBook;
window.confirmDeleteCat = confirmDeleteCat;
window.confirmDeleteUser = confirmDeleteUser;
window.quickAdjustStock = quickAdjustStock;
window.markReturned = markReturned;
window.markActive = markActive;
