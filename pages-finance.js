/* ================================================================
   EarnHub Admin - Overview, People and Finance pages
   ================================================================ */

(function () {
  'use strict';

  var A = window.AdminApp;
  var ui = A.ui;
  var esc = A.esc;

  function money(value) { return A.formatKES(value); }

  /* ============================================================
     Dashboard
     ============================================================ */

  A.registerPage({
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Platform-wide metrics and activity',
    icon: 'layout-dashboard',
    group: 'overview',
    permissions: ['dashboard.view'],
    render: function (container) {
      return A.api('/api/admin/dashboard').then(function (data) {
        var s = data.stats || {};
        var charts = data.charts || {};
        var recent = data.recent || {};
        var moduleAccess = data.moduleAccess || {};

        var metrics = [
          ui.metricCard({
            label: 'Total Users',
            value: A.formatNumber(s.totalUsers),
            hint: A.formatNumber(s.newUsersToday) + ' joined today',
            icon: 'users',
            color: 'var(--accent-sky)',
            bg: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.03))',
            border: 'rgba(14,165,233,0.25)',
            iconBg: 'rgba(14,165,233,0.15)'
          }),
          ui.metricCard({
            label: "Today's Earnings",
            value: money(s.todaysEarnings),
            hint: A.formatNumber(s.activeUsers) + ' activated accounts',
            icon: 'trending-up',
            color: 'var(--accent-emerald)',
            bg: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))',
            border: 'rgba(16,185,129,0.25)',
            iconBg: 'rgba(16,185,129,0.15)'
          }),
          ui.metricCard({
            label: 'Wallet Float',
            value: money(s.totalWalletBalance),
            hint: A.formatNumber(s.pendingActivations) + ' pending activations',
            icon: 'wallet',
            color: 'var(--accent-cyan)',
            bg: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.03))',
            border: 'rgba(6,182,212,0.25)',
            iconBg: 'rgba(6,182,212,0.15)'
          }),
          ui.metricCard({
            label: 'Pending Withdrawals',
            value: money(s.pendingWithdrawals),
            hint: A.formatNumber(s.pendingPayments) + ' pending payments',
            icon: 'banknote',
            color: 'var(--accent-amber)',
            bg: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))',
            border: 'rgba(245,158,11,0.25)',
            iconBg: 'rgba(245,158,11,0.15)'
          })
        ].join('');

        var attention = [
          { label: 'Pending reviews', value: s.pendingReviews, icon: 'clipboard-check', route: 'hotel-reviews', permission: 'reviews.manage' },
          { label: 'AI / writing submissions', value: s.pendingReviews, icon: 'brain-circuit', route: 'ai-training', permission: 'tasks.review' },
          { label: 'Unresolved risk events', value: s.fraudAlerts, icon: 'shield-alert', route: 'risk', permission: 'fraud.view' },
          { label: 'Failed provider callbacks', value: s.failedCallbacks, icon: 'webhook', route: 'providers', permission: 'providers.view' }
        ].filter(function (item) { return A.hasPermission(item.permission); });

        var attentionHtml = attention.length
          ? ui.card(
            ui.sectionTitle('Needs attention', 'Unresolved operational queues') +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + attention.map(function (item) {
              return (
                '<button type="button" data-action="go:' + esc(item.route) + '" class="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 text-left hover:border-[var(--accent-emerald)]/40 transition-colors">' +
                '<span class="flex items-center gap-3 min-w-0">' +
                '<i data-lucide="' + esc(item.icon) + '" class="h-4 w-4 text-[var(--accent-emerald)] shrink-0" aria-hidden="true"></i>' +
                '<span class="text-sm text-[var(--text-secondary)] truncate">' + esc(item.label) + '</span>' +
                '</span>' +
                '<span class="font-display font-bold text-white">' + A.formatNumber(item.value || 0) + '</span>' +
                '</button>'
              );
            }).join('') + '</div>'
          )
          : '';

        var chartPoints = (charts.dailyEarnings || []).length >= (charts.dailyRevenue || []).length
          ? charts.dailyEarnings : (charts.dailyRevenue || []);

        var chartCard = ui.card(
          ui.sectionTitle('Earnings trend', 'Paid amounts over the last 7 days') +
          ui.sparkline(chartPoints) +
          '<div class="flex flex-wrap items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">' +
          '<span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm" style="background:var(--accent-emerald)"></span>Earnings</span>' +
          '<span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm" style="background:var(--accent-sky)"></span>Revenue collected</span>' +
          '</div>'
        );

        var moduleKeys = Object.keys(moduleAccess);
        var moduleCard = ui.card(
          ui.sectionTitle('Module adoption', 'Users with active access') +
          (moduleKeys.length
            ? '<div class="space-y-2">' + moduleKeys.map(function (key) {
              var count = moduleAccess[key] || 0;
              var pct = s.activeUsers ? Math.min(100, Math.round((count / Math.max(1, s.totalUsers)) * 100)) : 0;
              return (
                '<div class="flex items-center gap-3">' +
                '<span class="w-32 shrink-0 text-xs text-[var(--text-secondary)] truncate">' + esc(key.replace(/_/g, ' ')) + '</span>' +
                '<span class="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">' +
                '<span class="block h-full rounded-full" style="width:' + pct + '%;background:linear-gradient(90deg,var(--accent-emerald),var(--accent-teal))"></span>' +
                '</span>' +
                '<span class="w-10 text-right text-xs font-semibold text-white">' + A.formatNumber(count) + '</span>' +
                '</div>'
              );
            }).join('') + '</div>'
            : ui.empty('No module data yet.', 'blocks'))
        );

        var orders = recent.orders || [];
        var withdrawals = recent.withdrawals || [];
        var modulePayments = recent.modulePayments || [];

        var activityCard = ui.card(
          ui.sectionTitle('Recent activity', 'Latest platform events') +
          '<div class="space-y-6">' +
          activityBlock('Paid orders', 'receipt', orders.map(function (o) {
            return { id: o.id, title: o.userId, meta: A.timeAgo(o.paidAt || o.createdAt), right: money(o.amountKES) };
          })) +
          activityBlock('Withdrawals', 'banknote', withdrawals.map(function (w) {
            return {
              id: w.id, title: (w.user && (w.user.username || w.user.email)) || w.userId,
              meta: A.timeAgo(w.createdAt) + ' · ' + w.status, right: money(w.amountKES)
            };
          })) +
          activityBlock('Module payments', 'repeat', modulePayments.map(function (p) {
            return {
              id: p.id, title: (p.moduleKey || '').replace(/_/g, ' '),
              meta: A.timeAgo(p.paidAt || p.createdAt), right: money(p.amountKES)
            };
          })) +
          '</div>'
        );

        container.innerHTML =
          ui.pageHeader('Dashboard', 'Live platform metrics', ui.button({ action: 'page:retry', label: 'Refresh', icon: 'refresh-cw', variant: 'ghost' })) +
          '<div class="space-y-4">' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">' + metrics + '</div>' +
          attentionHtml +
          '<div class="grid grid-cols-1 xl:grid-cols-3 gap-4">' +
          '<div class="xl:col-span-2 space-y-4">' + chartCard + activityCard + '</div>' +
          '<div class="space-y-4">' + moduleCard + ui.card(
            ui.sectionTitle("Today's revenue", 'Collected through M-Pesa') +
            '<p class="metric-value">' + money(s.todaysRevenue) + '</p>' +
            '<p class="text-xs text-[var(--text-muted)] mt-2">' + A.formatNumber(s.activatedAccounts) + ' activations completed today</p>'
          ) + '</div>' +
          '</div></div>';
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  function activityBlock(title, icon, items) {
    if (!items.length) return '';
    return (
      '<div>' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 inline-flex items-center gap-2">' +
      '<i data-lucide="' + esc(icon) + '" class="h-3.5 w-3.5" aria-hidden="true"></i>' + esc(title) + '</p>' +
      '<ul class="space-y-1">' + items.map(function (item) {
        return (
          '<li class="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[var(--bg-tertiary)] transition-colors">' +
          '<span class="min-w-0"><span class="block text-sm text-[var(--text-primary)] truncate">' + esc(A.truncate(item.title, 40)) + '</span>' +
          '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(item.meta) + '</span></span>' +
          '<span class="shrink-0 font-display text-sm font-bold text-white">' + esc(item.right) + '</span>' +
          '</li>'
        );
      }).join('') + '</ul></div>'
    );
  }

  /* ============================================================
     Users
     ============================================================ */

  var userQuery = { page: 1, limit: 25, search: '', status: '' };

  A.registerPage({
    id: 'users',
    title: 'Users',
    subtitle: 'Accounts, activation state and wallet balances',
    icon: 'users',
    group: 'people',
    permissions: ['users.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Users', 'Search and manage platform accounts',
          A.hasPermission('users.suspend')
            ? ui.button({ action: 'users:export', label: 'Export CSV', icon: 'download', variant: 'ghost' })
            : '') +
          '<div class="card">' + ui.skeleton(5) + '</div>';

        var query = '/api/admin/users?page=' + userQuery.page + '&limit=' + userQuery.limit +
          (userQuery.search ? '&search=' + encodeURIComponent(userQuery.search) : '') +
          (userQuery.status ? '&status=' + encodeURIComponent(userQuery.status) : '');

        return A.api(query).then(function (data) {
          var users = data.users || [];
          var columns = [
            {
              key: 'username', label: 'User', render: function (u) {
                return (
                  '<div class="flex items-center gap-3 min-w-0">' +
                  '<span class="shrink-0 flex items-center justify-center rounded-lg font-bold text-slate-950" style="width:32px;height:32px;background:linear-gradient(135deg,var(--accent-emerald),var(--accent-teal))">' +
                  esc((u.username || '?').charAt(0).toUpperCase()) + '</span>' +
                  '<span class="min-w-0"><span class="block font-semibold text-white truncate">' + esc(u.username) + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email) + '</span></span>' +
                  '</div>'
                );
              }
            },
            { key: 'status', label: 'Status', render: function (u) {
              if (u.role === 'suspended') return A.statusBadge('suspended');
              if (u.activationPaid) return A.statusBadge('activated');
              return A.statusBadge('pending');
            } },
            { key: 'walletBalance', label: 'Wallet', align: true, render: function (u) {
              return '<span class="font-display font-semibold text-white">' + money(u.walletBalance) + '</span>';
            } },
            { key: 'referralCode', label: 'Referral', render: function (u) {
              return '<span class="font-mono text-xs text-[var(--text-secondary)]">' + esc(u.referralCode || '—') + '</span>';
            } },
            { key: 'createdAt', label: 'Joined', render: function (u) { return '<span class="text-xs">' + esc(A.formatDate(u.createdAt)) + '</span>'; } },
            { key: 'actions', label: '', align: true, render: function (u) {
              return (
                ui.button({ action: 'users:view', label: 'View', icon: 'eye', variant: 'ghost', data: { id: u.id } }) +
                (A.hasPermission('wallet.adjust') ? ui.button({ action: 'users:adjust', label: 'Wallet', icon: 'wallet', variant: 'ghost', data: { id: u.id, name: u.username } }) : '') +
                (A.hasPermission('users.suspend') ? ui.button({ action: 'users:suspend', label: u.role === 'suspended' ? 'Restore' : 'Suspend', icon: u.role === 'suspended' ? 'rotate-ccw' : 'ban', variant: u.role === 'suspended' ? 'ghost' : 'danger', data: { id: u.id, name: u.username } }) : '')
              );
            } }
          ];

          var searchValue = userQuery.search;
          var statusValue = userQuery.status;

          container.innerHTML =
            ui.pageHeader('Users', A.formatNumber(data.total) + ' account' + (data.total === 1 ? '' : 's') + ' registered',
              A.hasPermission('users.suspend') ? ui.button({ action: 'users:export', label: 'Export CSV', icon: 'download', variant: 'ghost' }) : '') +
            '<div class="card mb-4"><form data-users-filter class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">' +
            ui.input({ name: 'userSearch', label: 'Search', value: searchValue, placeholder: 'Email, username or name', wrapClass: 'min-w-0', attrs: 'autofocus' }) +
            ui.select({ name: 'userStatus', label: 'Status', value: statusValue, options: [
              { value: '', label: 'All accounts' },
              { value: 'activated', label: 'Activated' },
              { value: 'pending', label: 'Pending activation' },
              { value: 'suspended', label: 'Suspended' }
            ] }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Apply</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, users, 'No users match these filters.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-users-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              userQuery.search = form.userSearch.value.trim();
              userQuery.status = form.userStatus.value;
              userQuery.page = 1;
              load();
            });
          }
          bindPageButtons(container, load, data);
        }).catch(function (err) {
          container.innerHTML = ui.pageHeader('Users', null, '') + ui.errorState(err.message, 'page:retry');
        });
      }
      return load();
    }
  });

  function bindPageButtons(container, reload, data) {
    var prev = container.querySelector('[data-page-prev]');
    var next = container.querySelector('[data-page-next]');
    if (prev) prev.addEventListener('click', function () { userQuery.page = Math.max(1, userQuery.page - 1); reload(); });
    if (next) next.addEventListener('click', function () { userQuery.page = userQuery.page + 1; reload(); });
  }

  A.onAction('users:view', function (payload) {
    return A.api('/api/admin/users/' + encodeURIComponent(payload.id)).then(function (data) {
      var u = data.user;
      A.openModal({
        title: u.username,
        hideConfirm: true,
        body:
          ui.statRow([
            { label: 'Wallet', value: money(u.walletBalance) },
            { label: 'Activation', value: u.activationPaid ? 'Paid' : 'Pending' },
            { label: 'Role', value: u.role },
            { label: 'Referral', value: u.referralCode || '—' }
          ]) +
          '<dl class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">' +
          detailRow('Email', u.email) + detailRow('Name', u.name) +
          detailRow('Phone', u.phoneNumber) + detailRow('Joined', A.formatDate(u.createdAt)) +
          '</dl>' +
          modalSection('Orders', (data.orders || []).slice(0, 10).map(function (o) {
            return { title: o.blueprintId, meta: o.status, right: money(o.amountKES) };
          })) +
          modalSection('Withdrawals', (data.withdrawals || []).slice(0, 10).map(function (w) {
            return { title: w.mpesaPhone, meta: w.status, right: money(w.amountKES) };
          })) +
          modalSection('Module transactions', (data.moduleTransactions || []).slice(0, 10).map(function (t) {
            return { title: (t.moduleKey || '').replace(/_/g, ' '), meta: t.type + ' · ' + t.status, right: money(t.amountKES) };
          })) +
          modalSection('Unlocked modules', (data.moduleAccess || []).filter(function (m) { return m.status === 'active'; }).map(function (m) {
            return { title: m.moduleKey.replace(/_/g, ' '), meta: A.timeAgo(m.unlockedAt || m.createdAt), right: money(m.amountPaid) };
          }))
      });
    });
  });

  function detailRow(label, value) {
    return '<div><dt class="text-xs uppercase tracking-wide text-[var(--text-muted)]">' + esc(label) + '</dt>' +
      '<dd class="text-[var(--text-primary)] mt-0.5 break-all">' + esc(value || '—') + '</dd></div>';
  }

  function modalSection(title, items) {
    if (!items || !items.length) return '';
    return (
      '<div class="mt-5"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">' + esc(title) + '</p>' +
      '<ul class="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)]">' +
      items.map(function (item) {
        return '<li class="flex items-center justify-between gap-3 px-4 py-2.5">' +
          '<span class="min-w-0"><span class="block text-sm text-[var(--text-primary)] truncate">' + esc(item.title) + '</span>' +
          '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(item.meta) + '</span></span>' +
          '<span class="shrink-0 text-sm font-semibold text-white">' + esc(item.right) + '</span></li>';
      }).join('') + '</ul></div>'
    );
  }

  A.onAction('users:adjust', function (payload) {
    A.openModal({
      title: 'Adjust wallet — ' + payload.name,
      confirmLabel: 'Apply adjustment',
      body:
        '<p class="text-sm text-[var(--text-secondary)] mb-4">Adjustments are written to the wallet ledger and the audit log.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        ui.select({ name: 'direction', label: 'Direction', value: 'credit', options: [
          { value: 'credit', label: 'Credit (add funds)' },
          { value: 'debit', label: 'Debit (remove funds)' }
        ] }) +
        ui.input({ name: 'amountKES', label: 'Amount (KES)', type: 'number', value: '0.01', attrs: 'step="0.01" min="0"' }) +
        '</div>' +
        '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Why is this adjustment being made?' }) + '</div>',
      onConfirm: function (modal) {
        var reason = modal.querySelector('[name="reason"]').value.trim();
        var amount = Number(modal.querySelector('[name="amountKES"]').value);
        var direction = modal.querySelector('[name="direction"]').value;
        if (!reason) { A.toast('A reason is required.', 'error'); return false; }
        if (!(amount > 0)) { A.toast('Enter an amount greater than zero.', 'error'); return false; }
        return A.api('/api/admin/wallet/adjust', {
          method: 'POST',
          body: { userId: payload.id, amountKES: Math.round(amount * 100), direction: direction, reason: reason }
        }).then(function (data) {
          A.toast('Wallet updated: ' + money(data.balanceBefore) + ' → ' + money(data.balanceAfter), 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('users:suspend', function (payload) {
    return A.confirmDialog({
      title: 'Change account status',
      messageHtml: 'Change the access status of <strong>' + esc(payload.name) + '</strong>? The action is recorded in the audit log.',
      withReason: true,
      confirmLabel: 'Apply',
      onConfirm: function (reason) {
        return A.api('/api/admin/users/' + encodeURIComponent(payload.id) + '/suspend', {
          method: 'POST',
          body: { reason: reason }
        }).then(function (data) {
          A.toast(data.suspended ? 'Account suspended.' : 'Account restored.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('users:export', function () {
    return A.api('/api/admin/users?limit=1000').then(function (data) {
      var rows = [['id', 'username', 'email', 'name', 'role', 'activationPaid', 'walletBalance', 'referralCode', 'createdAt']];
      (data.users || []).forEach(function (u) {
        rows.push([u.id, u.username, u.email, u.name || '', u.role, String(u.activationPaid), u.walletBalance, u.referralCode || '', u.createdAt]);
      });
      downloadCsv('earnhub-users.csv', rows);
    });
  });

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        var value = cell === null || cell === undefined ? '' : String(cell);
        return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
      }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ============================================================
     Wallet ledger
     ============================================================ */

  var ledgerQuery = { page: 1, limit: 25, userId: '' };

  A.registerPage({
    id: 'wallet',
    title: 'Wallet Ledger',
    subtitle: 'Every balance movement on the platform',
    icon: 'wallet',
    group: 'finance',
    permissions: ['wallet.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Wallet Ledger', 'Loading entries', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        var query = '/api/admin/wallet/ledger?page=' + ledgerQuery.page + '&limit=' + ledgerQuery.limit +
          (ledgerQuery.userId ? '&userId=' + encodeURIComponent(ledgerQuery.userId) : '');
        return A.api(query).then(function (data) {
          var columns = [
            { key: 'user', label: 'User', render: function (t) {
              var u = t.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'type', label: 'Type', render: function (t) { return '<span class="font-mono text-xs">' + esc(t.type) + '</span>'; } },
            { key: 'description', label: 'Description', render: function (t) { return '<span class="text-xs">' + esc(A.truncate(t.description, 48) || '—') + '</span>'; } },
            { key: 'amountKES', label: 'Amount', align: true, render: function (t) {
              var positive = t.amountKES >= 0;
              return '<span class="font-display font-semibold" style="color:' + (positive ? 'var(--accent-emerald)' : 'var(--accent-red)') + '">' +
                (positive ? '+' : '−') + money(Math.abs(t.amountKES)) + '</span>';
            } },
            { key: 'balanceAfter', label: 'Balance', align: true, render: function (t) {
              return '<span class="text-sm text-white">' + money(t.balanceAfter) + '</span>';
            } },
            { key: 'createdAt', label: 'Date', render: function (t) { return '<span class="text-xs">' + esc(A.formatDate(t.createdAt)) + '</span>'; } }
          ];

          container.innerHTML =
            ui.pageHeader('Wallet Ledger', A.formatNumber(data.total) + ' entries') +
            '<div class="card mb-4"><form data-ledger-filter class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">' +
            ui.input({ name: 'ledgerUser', label: 'Filter by user id', value: ledgerQuery.userId, placeholder: 'cuid…' }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Filter</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, data.transactions, 'No ledger entries yet.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-ledger-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              ledgerQuery.userId = form.ledgerUser.value.trim();
              ledgerQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { ledgerQuery.page = Math.max(1, ledgerQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { ledgerQuery.page = ledgerQuery.page + 1; load(); });
        });
      }
      return load();
    }
  });

  /* ============================================================
     Withdrawals
     ============================================================ */

  var withdrawalQuery = { page: 1, limit: 25, status: '' };

  A.registerPage({
    id: 'withdrawals',
    title: 'Withdrawals',
    subtitle: 'Approve or reject M-Pesa B2C requests',
    icon: 'banknote',
    group: 'finance',
    permissions: ['withdrawals.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Withdrawals', 'Loading requests', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        var query = '/api/admin/withdrawals?page=' + withdrawalQuery.page + '&limit=' + withdrawalQuery.limit +
          (withdrawalQuery.status ? '&status=' + encodeURIComponent(withdrawalQuery.status) : '');
        return A.api(query).then(function (data) {
          var canApprove = A.hasPermission('withdrawals.approve');
          var canReject = A.hasPermission('withdrawals.reject');

          var columns = [
            { key: 'user', label: 'User', render: function (w) {
              var u = w.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'mpesaPhone', label: 'M-Pesa', render: function (w) { return '<span class="font-mono text-xs">' + esc(w.mpesaPhone) + '</span>'; } },
            { key: 'amountKES', label: 'Amount', align: true, render: function (w) {
              return '<span class="font-display font-semibold text-white">' + money(w.amountKES) + '</span>';
            } },
            { key: 'feeKES', label: 'Fee', align: true, render: function (w) { return '<span class="text-xs">' + money(w.feeKES) + '</span>'; } },
            { key: 'status', label: 'Status', render: function (w) { return A.statusBadge(w.status); } },
            { key: 'createdAt', label: 'Requested', render: function (w) { return '<span class="text-xs">' + esc(A.formatDate(w.createdAt)) + '</span>'; } },
            { key: 'actions', label: '', align: true, render: function (w) {
              var terminal = ['completed', 'failed', 'rejected'].indexOf(w.status) > -1;
              if (terminal) return '<span class="text-xs text-[var(--text-muted)]">—</span>';
              return (
                (canApprove ? ui.button({ action: 'withdrawals:approve', label: 'Approve', icon: 'check', variant: 'primary', data: { id: w.id, amount: money(w.amountKES) } }) : '') +
                (canReject ? ui.button({ action: 'withdrawals:reject', label: 'Reject', icon: 'x', variant: 'danger', data: { id: w.id } }) : '')
              );
            } }
          ];

          container.innerHTML =
            ui.pageHeader('Withdrawals', A.formatNumber(data.total) + ' request' + (data.total === 1 ? '' : 's')) +
            '<div class="card mb-4"><form data-withdrawal-filter class="grid grid-cols-1 sm:grid-cols-[220px_auto] gap-3 items-end">' +
            ui.select({ name: 'withdrawalStatus', label: 'Status', value: withdrawalQuery.status, options: [
              { value: '', label: 'All statuses' },
              { value: 'queued', label: 'Queued' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'failed', label: 'Failed' }
            ] }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Apply</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, data.withdrawals, 'No withdrawal requests found.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-withdrawal-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              withdrawalQuery.status = form.withdrawalStatus.value;
              withdrawalQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { withdrawalQuery.page = Math.max(1, withdrawalQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { withdrawalQuery.page = withdrawalQuery.page + 1; load(); });
        });
      }
      return load();
    }
  });

  A.onAction('withdrawals:approve', function (payload) {
    return A.confirmDialog({
      title: 'Approve withdrawal',
      messageHtml: 'Approve the withdrawal of <strong>' + esc(payload.amount) + '</strong>? The status becomes <em>processing</em> and the B2C dispatch proceeds.',
      withReason: true,
      confirmLabel: 'Approve',
      onConfirm: function (reason) {
        return A.api('/api/admin/withdrawals/' + encodeURIComponent(payload.id) + '/approve', {
          method: 'POST', body: { reason: reason }
        }).then(function () {
          A.toast('Withdrawal approved.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('withdrawals:reject', function (payload) {
    return A.confirmDialog({
      title: 'Reject withdrawal',
      messageHtml: 'Rejecting refunds the amount back to the user wallet immediately.',
      withReason: true,
      confirmLabel: 'Reject & refund',
      onConfirm: function (reason) {
        return A.api('/api/admin/withdrawals/' + encodeURIComponent(payload.id) + '/reject', {
          method: 'POST', body: { reason: reason }
        }).then(function () {
          A.toast('Withdrawal rejected and refunded.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Payments
     ============================================================ */

  var paymentQuery = { page: 1, limit: 25, status: '', tab: 'module' };

  A.registerPage({
    id: 'payments',
    title: 'Payments',
    subtitle: 'M-Pesa receipts and payment attempts',
    icon: 'credit-card',
    group: 'finance',
    permissions: ['payments.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Payments', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        var endpoint = paymentQuery.tab === 'orders' ? '/api/admin/payments/orders' : '/api/admin/payments';
        var query = endpoint + '?page=' + paymentQuery.page + '&limit=' + paymentQuery.limit +
          (paymentQuery.status ? '&status=' + encodeURIComponent(paymentQuery.status) : '');
        return A.api(query).then(function (data) {
          var rows = paymentQuery.tab === 'orders' ? (data.orders || []) : (data.payments || []);
          var columns = [
            { key: 'user', label: 'User', render: function (r) {
              var u = r.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'moduleKey', label: 'Source', render: function (r) {
              return '<span class="text-xs">' + esc((r.moduleKey || r.blueprintId || 'unknown').replace(/_/g, ' ')) + '</span>';
            } },
            { key: 'amountKES', label: 'Amount', align: true, render: function (r) {
              return '<span class="font-display font-semibold text-white">' + money(r.amountKES) + '</span>';
            } },
            { key: 'status', label: 'Status', render: function (r) { return A.statusBadge(r.status); } },
            { key: 'mpesaReceipt', label: 'Receipt', render: function (r) {
              return '<span class="font-mono text-xs text-[var(--text-secondary)]">' + esc(A.truncate(r.mpesaReceipt || r.checkoutRequestId || '—', 18)) + '</span>';
            } },
            { key: 'paidAt', label: 'Date', render: function (r) { return '<span class="text-xs">' + esc(A.formatDate(r.paidAt || r.createdAt)) + '</span>'; } }
          ];

          container.innerHTML =
            ui.pageHeader('Payments', A.formatNumber(data.total) + ' record' + (data.total === 1 ? '' : 's')) +
            '<div class="card mb-4"><div class="grid grid-cols-1 sm:grid-cols-[auto_220px] gap-3 items-end">' +
            '<div class="flex gap-2">' +
            '<button type="button" data-tab="module" class="h-10 rounded-lg px-4 text-sm font-semibold border transition-colors ' +
            (paymentQuery.tab === 'module' ? 'border-[var(--accent-emerald)]/40 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]') + '">Module payments</button>' +
            '<button type="button" data-tab="orders" class="h-10 rounded-lg px-4 text-sm font-semibold border transition-colors ' +
            (paymentQuery.tab === 'orders' ? 'border-[var(--accent-emerald)]/40 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]') + '">Blueprint orders</button>' +
            '</div>' +
            ui.select({ name: 'paymentStatus', label: 'Status', value: paymentQuery.status, options: [
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' }
            ] }) +
            '</div></div>' +
            ui.tableWrapper(columns, rows, 'No payment records found.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          Array.prototype.forEach.call(container.querySelectorAll('[data-tab]'), function (btn) {
            btn.addEventListener('click', function () {
              paymentQuery.tab = btn.getAttribute('data-tab');
              paymentQuery.page = 1;
              load();
            });
          });
          var select = container.querySelector('[name="paymentStatus"]');
          if (select) {
            select.addEventListener('change', function () {
              paymentQuery.status = select.value;
              paymentQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { paymentQuery.page = Math.max(1, paymentQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { paymentQuery.page = paymentQuery.page + 1; load(); });
        });
      }
      return load();
    }
  });

  /* ============================================================
     Earnings
     ============================================================ */

  var earningsQuery = { page: 1, limit: 25, moduleKey: '' };

  A.registerPage({
    id: 'earnings',
    title: 'Earnings',
    subtitle: 'Per-user earning module balances',
    icon: 'trending-up',
    group: 'finance',
    permissions: ['earnings.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Earnings', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        var query = '/api/admin/earnings?page=' + earningsQuery.page + '&limit=' + earningsQuery.limit +
          (earningsQuery.moduleKey ? '&moduleKey=' + encodeURIComponent(earningsQuery.moduleKey) : '');
        return A.api(query).then(function (data) {
          var columns = [
            { key: 'user', label: 'User', render: function (e) {
              var u = e.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'moduleKey', label: 'Module', render: function (e) { return '<span class="text-xs">' + esc(e.moduleKey.replace(/_/g, ' ')) + '</span>'; } },
            { key: 'amountKES', label: 'Earned', align: true, render: function (e) {
              return '<span class="font-display font-semibold" style="color:var(--accent-emerald)">' + money(e.amountKES) + '</span>';
            } },
            { key: 'pendingKES', label: 'Pending', align: true, render: function (e) {
              return '<span class="font-display" style="color:var(--accent-amber)">' + money(e.pendingKES) + '</span>';
            } },
            { key: 'lastActivity', label: 'Last activity', render: function (e) { return '<span class="text-xs">' + esc(A.timeAgo(e.lastActivity || e.updatedAt)) + '</span>'; } }
          ];

          container.innerHTML =
            ui.pageHeader('Earnings', A.formatNumber(data.total) + ' earning record' + (data.total === 1 ? '' : 's')) +
            '<div class="card mb-4"><form data-earnings-filter class="grid grid-cols-1 sm:grid-cols-[240px_auto] gap-3 items-end">' +
            ui.input({ name: 'earningsModule', label: 'Filter by module key', value: earningsQuery.moduleKey, placeholder: 'e.g. forex' }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Apply</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, data.earnings, 'No earning records found.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-earnings-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              earningsQuery.moduleKey = form.earningsModule.value.trim();
              earningsQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { earningsQuery.page = Math.max(1, earningsQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { earningsQuery.page = earningsQuery.page + 1; load(); });
        });
      }
      return load();
    }
  });

  /* ============================================================
     Shared actions
     ============================================================ */

  A.onAction('page:retry', function () { A.refresh(); });

  A.onAction('go', function (payload) {
    A.navigate(payload.args || 'dashboard');
  });
})();
