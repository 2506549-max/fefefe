/* ================================================================
   EarnHub Admin - Earning engine
   Reward rules and the earning transaction monitor.
   ================================================================ */

(function () {
  'use strict';

  var A = window.AdminApp;
  var ui = A.ui;
  var esc = A.esc;

  function money(value) { return A.formatKES(value || 0); }
  function centsToInput(value) { return ((Number(value) || 0) / 100).toFixed(2); }
  function inputToCents(value) { return Math.round((Number(value) || 0) * 100); }

  var MODULE_KEYS = [
    { value: '', label: 'All modules' },
    { value: 'ai_training', label: 'AI Training' },
    { value: 'academic', label: 'Write & Earn' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'chat', label: 'Chat & Earn' },
    { value: 'forex', label: 'Forex Trading' },
    { value: 'lucky_spin', label: 'Spin the Wheel' },
    { value: 'y99', label: 'Y99' },
    { value: 'hotel_reviews', label: 'Hotel Reviews' }
  ];

  /* ============================================================
     Earning engine overview + transactions
     ============================================================ */

  var txQuery = { page: 1, limit: 25, module: '', status: '', fraudStatus: '', search: '' };

  A.registerPage({
    id: 'earning-transactions',
    title: 'Earning Transactions',
    subtitle: 'Monitor, approve, reject and reverse every earning',
    icon: 'receipt-text',
    group: 'finance',
    permissions: ['earnings.transactions'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Earning Transactions', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';

        var qs = '/api/admin/earnings/transactions?page=' + txQuery.page + '&limit=' + txQuery.limit;
        if (txQuery.module) qs += '&module=' + encodeURIComponent(txQuery.module);
        if (txQuery.status) qs += '&status=' + encodeURIComponent(txQuery.status);
        if (txQuery.fraudStatus) qs += '&fraudStatus=' + encodeURIComponent(txQuery.fraudStatus);
        if (txQuery.search) qs += '&search=' + encodeURIComponent(txQuery.search);

        return Promise.all([A.api(qs), A.api('/api/admin/earnings/stats')]).then(function (results) {
          var data = results[0];
          var stats = results[1].stats || {};

          var columns = [
            { key: 'user', label: 'User', render: function (t) {
              var u = t.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'module', label: 'Module', render: function (t) {
              return '<span class="text-xs">' + esc(String(t.module || '').replace(/_/g, ' ')) + '</span>';
            } },
            { key: 'providerReward', label: 'Provider', render: function (t) {
              return '<div class="min-w-0"><span class="block font-mono text-xs">' + esc(t.provider || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(t.providerTransactionId || '') + '</span></div>';
            } },
            { key: 'earnHubReward', label: 'Reward', align: true, render: function (t) {
              var positive = t.earnHubReward >= 0;
              return '<span class="font-display font-semibold" style="color:' + (positive ? 'var(--accent-emerald)' : 'var(--accent-red)') + '">' +
                (positive ? '+' : '−') + money(Math.abs(t.earnHubReward)) + '</span>';
            } },
            { key: 'status', label: 'Status', render: function (t) {
              return A.statusBadge(String(t.status || '').toLowerCase()) +
                (t.fraudStatus && t.fraudStatus !== 'CLEAR' ? ' ' + A.severityBadge('high') : '');
            } },
            { key: 'createdAt', label: 'Date', render: function (t) { return '<span class="text-xs">' + esc(A.timeAgo(t.createdAt)) + '</span>'; } },
            { key: 'actions', label: '', align: true, render: function (t) {
              return ui.button({ action: 'earnings:detail', label: 'Inspect', icon: 'eye', variant: 'ghost', data: { id: t.id } });
            } }
          ];

          var statCards = [
            { label: 'Total issued', value: money(stats.totalIssuedKES) },
            { label: 'Issued today', value: money(stats.todayIssuedKES) },
            { label: 'Pending review', value: A.formatNumber(stats.pendingCount || 0) },
            { label: 'Approved', value: A.formatNumber(stats.approvedCount || 0) },
            { label: 'Rejected', value: A.formatNumber(stats.rejectedCount || 0) },
            { label: 'Flagged by risk', value: A.formatNumber(stats.flaggedCount || 0) }
          ].map(function (s) {
            return '<div class="card"><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">' + esc(s.label) + '</p>' +
              '<p class="font-display font-bold text-white mt-1">' + esc(s.value) + '</p></div>';
          }).join('');

          container.innerHTML =
            ui.pageHeader('Earning Transactions', A.formatNumber(data.total) + ' transactions',
              ui.button({ action: 'earnings:refresh', label: 'Refresh', icon: 'refresh-cw', variant: 'ghost' })) +
            '<div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">' + statCards + '</div>' +
            '<div class="card mb-4"><form data-tx-filter class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">' +
            ui.select({ name: 'txModule', label: 'Module', value: txQuery.module, options: MODULE_KEYS }) +
            ui.select({ name: 'txStatus', label: 'Status', value: txQuery.status, options: [
              { value: '', label: 'All statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'REVERSED', label: 'Reversed' }
            ] }) +
            ui.select({ name: 'txFraud', label: 'Fraud status', value: txQuery.fraudStatus, options: [
              { value: '', label: 'Any' },
              { value: 'CLEAR', label: 'Clear' },
              { value: 'FLAGGED', label: 'Flagged' },
              { value: 'BLOCKED', label: 'Blocked' }
            ] }) +
            ui.input({ name: 'txSearch', label: 'Search', value: txQuery.search, placeholder: 'user, email or transaction id' }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Filter</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, data.items, 'No earning transactions yet.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-tx-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              txQuery.module = form.txModule.value;
              txQuery.status = form.txStatus.value;
              txQuery.fraudStatus = form.txFraud.value;
              txQuery.search = form.txSearch.value.trim();
              txQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { txQuery.page = Math.max(1, txQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { txQuery.page = txQuery.page + 1; load(); });
          A.bindActions(container);
          if (window.lucide) lucide.createIcons();
        });
      }
      return load();
    }
  });

  A.onAction('earnings:refresh', function () { A.refresh(); });

  A.onAction('earnings:detail', function (payload) {
    return A.api('/api/admin/earnings/transactions/' + encodeURIComponent(payload.id)).then(function (data) {
      var t = data.transaction;
      var user = t.user || {};

      var rows = [
        ['User', (user.username || '') + ' · ' + (user.email || '')],
        ['Module', t.module],
        ['Provider', t.provider + (t.providerTransactionId ? ' · ' + t.providerTransactionId : '')],
        ['Provider reward', t.providerReward === null || t.providerReward === undefined ? '—' : t.providerReward + ' ' + (t.providerCurrency || '')],
        ['EarnHub reward', money(t.earnHubReward)],
        ['Reward rule', t.rewardRule ? t.rewardRule.name : 'Fallback (task reward)'],
        ['Status', t.status + ' · review ' + (t.reviewStatus || '—') + ' · fraud ' + t.fraudStatus],
        ['Created', A.formatDate(t.createdAt)],
        ['Approved', t.approvedAt ? A.formatDate(t.approvedAt) : '—'],
        ['Reversed', t.reversedAt ? A.formatDate(t.reversedAt) : '—']
      ].map(function (r) {
        return '<div class="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-primary)] last:border-0">' +
          '<span class="text-xs uppercase tracking-wide text-[var(--text-muted)] shrink-0">' + esc(r[0]) + '</span>' +
          '<span class="text-sm text-[var(--text-primary)] text-right break-all">' + esc(r[1]) + '</span></div>';
      }).join('');

      var jsonBlock = function (label, value) {
        if (!value) return '';
        return '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">' + esc(label) + '</p>' +
          '<pre class="max-h-56 overflow-auto main-scrollbar rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">' +
          esc(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) + '</pre></div>';
      };

      var actionButtons = '';
      if (A.hasPermission('earnings.approve') && t.status === 'PENDING') {
        actionButtons += ui.button({ action: 'earnings:approve', label: 'Approve', icon: 'check', variant: 'primary', data: { id: t.id } });
        actionButtons += ui.button({ action: 'earnings:reject', label: 'Reject', icon: 'x', variant: 'danger', data: { id: t.id } });
      }
      if (A.hasPermission('earnings.reverse') && t.status === 'APPROVED' && !t.reversalOfId) {
        actionButtons += ui.button({ action: 'earnings:reverse', label: 'Reverse', icon: 'undo-2', variant: 'danger', data: { id: t.id } });
      }
      if (A.hasPermission('earnings.transactions')) {
        actionButtons += ui.button({ action: 'earnings:note', label: 'Add note', icon: 'message-square', variant: 'ghost', data: { id: t.id } });
      }

      A.openModal({
        title: 'Earning transaction',
        hideConfirm: true,
        width: 760,
        body:
          '<div class="rounded-xl border border-[var(--border-primary)]">' + rows + '</div>' +
          jsonBlock('Completion data', t.completionData) +
          jsonBlock('Provider payload', t.providerPayload) +
          (data.ledger && data.ledger.length
            ? '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Wallet ledger</p>' +
              data.ledger.map(function (l) {
                return '<div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-primary)]">' +
                  '<span class="text-xs">' + esc(l.type) + ' · ' + esc(A.formatDate(l.createdAt)) + '</span>' +
                  '<span class="text-sm font-semibold text-white">' + money(l.amountKES) + ' → ' + money(l.balanceAfter) + '</span></div>';
              }).join('') + '</div>'
            : '') +
          (data.audits && data.audits.length
            ? '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Audit trail</p>' +
              data.audits.map(function (a) {
                return '<div class="px-4 py-2.5 border-b border-[var(--border-primary)]">' +
                  '<p class="text-sm text-white">' + esc(a.action) + '</p>' +
                  '<p class="text-xs text-[var(--text-muted)]">' + esc(A.formatDate(a.createdAt)) + (a.reason ? ' · ' + esc(a.reason) : '') + '</p></div>';
              }).join('') + '</div>'
            : '') +
          (actionButtons ? '<div class="flex flex-wrap gap-2 mt-5">' + actionButtons + '</div>' : '')
      });
    });
  });

  A.onAction('earnings:approve', function (payload) {
    return A.confirmDialog({
      title: 'Approve earning',
      messageHtml: 'The reward is credited to the user wallet and a wallet ledger entry is written. The action is audited.',
      withReason: true,
      confirmLabel: 'Approve and pay',
      onConfirm: function (reason) {
        return A.api('/api/admin/earnings/transactions/' + encodeURIComponent(payload.id) + '/approve', {
          method: 'POST',
          body: { reason: reason }
        }).then(function () {
          A.toast('Earning approved and wallet credited.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('earnings:reject', function (payload) {
    return A.confirmDialog({
      title: 'Reject earning',
      messageHtml: 'No wallet movement happens. The earning is marked as rejected.',
      withReason: true,
      confirmLabel: 'Reject',
      onConfirm: function (reason) {
        if (!reason) { A.toast('A reason is required.', 'error'); return false; }
        return A.api('/api/admin/earnings/transactions/' + encodeURIComponent(payload.id) + '/reject', {
          method: 'POST',
          body: { reason: reason }
        }).then(function () {
          A.toast('Earning rejected.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('earnings:reverse', function (payload) {
    return A.confirmDialog({
      title: 'Reverse earning',
      messageHtml: 'A compensating reversal transaction is created, the user wallet is debited and a ledger entry is written. The original earning is preserved.',
      withReason: true,
      confirmLabel: 'Reverse earning',
      onConfirm: function (reason) {
        if (!reason) { A.toast('A reason is required to reverse an earning.', 'error'); return false; }
        return A.api('/api/admin/earnings/transactions/' + encodeURIComponent(payload.id) + '/reverse', {
          method: 'POST',
          body: { reason: reason }
        }).then(function () {
          A.toast('Earning reversed.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('earnings:note', function (payload) {
    A.openModal({
      title: 'Add administrative note',
      confirmLabel: 'Save note',
      body: ui.input({ name: 'note', label: 'Note', type: 'textarea', required: true, attrs: 'autofocus' }),
      onConfirm: function (modal) {
        var note = modal.querySelector('[name="note"]').value.trim();
        if (!note) { A.toast('Note is required.', 'error'); return false; }
        return A.api('/api/admin/earnings/transactions/' + encodeURIComponent(payload.id) + '/note', {
          method: 'POST',
          body: { note: note }
        }).then(function () {
          A.toast('Note added.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Reward rules
     ============================================================ */

  A.registerPage({
    id: 'reward-rules',
    title: 'Reward Rules',
    subtitle: 'The server-side authority for every reward paid to users',
    icon: 'scale',
    group: 'finance',
    permissions: ['earnings.rules'],
    render: function (container) {
      return A.api('/api/admin/earnings/rules').then(function (data) {
        var rules = data.rules || [];

        var cards = rules.map(function (r) {
          var scope = [
            r.module ? 'module: ' + r.module : null,
            r.provider ? 'provider: ' + r.provider : null,
            r.taskCategory ? 'category: ' + r.taskCategory : null,
            r.taskKey ? 'task: ' + String(r.taskKey).slice(0, 8) : null
          ].filter(Boolean).join(' · ') || 'Global default';

          var valueText = r.ruleType === 'percentage'
            ? r.percentage + '% of provider reward'
            : money(r.baseAmount);

          return '<div class="card">' +
            '<div class="flex items-start justify-between gap-3">' +
            '<div class="min-w-0"><p class="font-display font-bold text-white truncate">' + esc(r.name) + '</p>' +
            '<p class="text-xs text-[var(--text-muted)] font-mono truncate">' + esc(scope) + '</p></div>' +
            A.statusBadge(r.enabled ? 'active' : 'disabled') +
            '</div>' +
            '<div class="grid grid-cols-2 gap-3 mt-4">' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Reward</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + esc(valueText) + '</p></div>' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Range</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + esc(money(r.minAmount) + ' – ' + money(r.maxAmount)) + '</p></div>' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Daily cap</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + esc(r.dailyCap ? money(r.dailyCap) : 'None') + '</p></div>' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">User daily cap</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + esc(r.userDailyCap ? money(r.userDailyCap) : 'None') + '</p></div>' +
            '</div>' +
            '<p class="text-xs text-[var(--text-muted)] mt-3">Used by ' + A.formatNumber((r._count && r._count.transactions) || 0) + ' earning transactions</p>' +
            '<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--border-primary)]">' +
            ui.button({ action: 'rules:edit', label: 'Edit', icon: 'pencil', variant: 'ghost', data: { id: r.id } }) +
            ui.button({ action: 'rules:history', label: 'History', icon: 'history', variant: 'ghost', data: { id: r.id } }) +
            ui.button({ action: 'rules:toggle', label: r.enabled ? 'Disable' : 'Enable', icon: r.enabled ? 'power-off' : 'power', variant: r.enabled ? 'danger' : 'primary', data: { id: r.id, enabled: r.enabled ? 'false' : 'true' } }) +
            '</div></div>';
        }).join('');

        container.innerHTML =
          ui.pageHeader('Reward Rules', rules.length + ' configured',
            ui.button({ action: 'rules:new', label: 'New rule', icon: 'plus', variant: 'primary' })) +
          (rules.length
            ? '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">' + cards + '</div>'
            : ui.card(ui.empty('No reward rules yet. Earnings fall back to the task reward.', 'scale'))) +
          '<p class="text-xs text-[var(--text-muted)] mt-4">The most specific enabled rule wins: task &gt; category &gt; provider &gt; module &gt; global. Rewards are always calculated on the server — the browser can never set an amount.</p>';

        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  function ruleFormBody(rule) {
    rule = rule || {};
    return '<div class="space-y-3">' +
      ui.input({ name: 'name', label: 'Rule name', value: rule.name, required: true, attrs: 'autofocus' }) +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.select({ name: 'ruleType', label: 'Rule type', value: rule.ruleType || 'fixed', options: [
        { value: 'fixed', label: 'Fixed amount' },
        { value: 'percentage', label: 'Percentage of provider reward' }
      ] }) +
      ui.input({ name: 'baseAmount', label: 'Fixed amount (KES)', type: 'number', value: centsToInput(rule.baseAmount), attrs: 'step="0.01" min="0"' }) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.input({ name: 'percentage', label: 'Percentage (%)', type: 'number', value: rule.percentage === undefined || rule.percentage === null ? '' : rule.percentage, attrs: 'step="0.01" min="0"' }) +
      ui.select({ name: 'module', label: 'Module', value: rule.module || '', options: MODULE_KEYS }) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.input({ name: 'provider', label: 'Provider key (optional)', value: rule.provider || '', placeholder: 'e.g. earnhub' }) +
      ui.input({ name: 'taskCategory', label: 'Task type / category (optional)', value: rule.taskCategory || '', placeholder: 'e.g. sentiment' }) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.input({ name: 'minAmount', label: 'Minimum reward (KES)', type: 'number', value: rule.minAmount === null || rule.minAmount === undefined ? '' : centsToInput(rule.minAmount), attrs: 'step="0.01" min="0"' }) +
      ui.input({ name: 'maxAmount', label: 'Maximum reward (KES)', type: 'number', value: rule.maxAmount === null || rule.maxAmount === undefined ? '' : centsToInput(rule.maxAmount), attrs: 'step="0.01" min="0"' }) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.input({ name: 'dailyCap', label: 'Platform daily cap (KES)', type: 'number', value: rule.dailyCap ? centsToInput(rule.dailyCap) : '', attrs: 'step="0.01" min="0"' }) +
      ui.input({ name: 'userDailyCap', label: 'Per-user daily cap (KES)', type: 'number', value: rule.userDailyCap ? centsToInput(rule.userDailyCap) : '', attrs: 'step="0.01" min="0"' }) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      ui.input({ name: 'effectiveFrom', label: 'Effective from', type: 'date', value: rule.effectiveFrom ? String(rule.effectiveFrom).slice(0, 10) : '' }) +
      ui.input({ name: 'effectiveTo', label: 'Effective to', type: 'date', value: rule.effectiveTo ? String(rule.effectiveTo).slice(0, 10) : '' }) +
      '</div>' +
      '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason for this change', type: 'textarea', required: true }) + '</div>' +
      '</div>';
  }

  function collectRuleBody(modal) {
    var get = function (n) { var el = modal.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    var body = {
      name: get('name'),
      ruleType: get('ruleType'),
      module: get('module') || null,
      provider: get('provider') || null,
      taskCategory: get('taskCategory') || null,
      minAmount: get('minAmount') === '' ? null : inputToCents(get('minAmount')),
      maxAmount: get('maxAmount') === '' ? null : inputToCents(get('maxAmount')),
      dailyCap: get('dailyCap') === '' ? null : inputToCents(get('dailyCap')),
      userDailyCap: get('userDailyCap') === '' ? null : inputToCents(get('userDailyCap')),
      effectiveFrom: get('effectiveFrom') || null,
      effectiveTo: get('effectiveTo') || null,
      reason: get('reason')
    };
    if (body.ruleType === 'percentage') {
      body.percentage = Number(get('percentage') || 0);
    } else {
      body.baseAmount = inputToCents(get('baseAmount'));
    }
    return body;
  }

  A.onAction('rules:new', function () {
    A.openModal({
      title: 'Create reward rule',
      confirmLabel: 'Create rule',
      width: 720,
      body: ruleFormBody(null),
      onConfirm: function (modal) {
        var body = collectRuleBody(modal);
        if (!body.name) { A.toast('Rule name is required.', 'error'); return false; }
        if (!body.reason) { A.toast('A reason is required.', 'error'); return false; }
        return A.api('/api/admin/earnings/rules', { method: 'POST', body: body }).then(function () {
          A.toast('Reward rule created.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('rules:edit', function (payload) {
    return A.api('/api/admin/earnings/rules').then(function (data) {
      var rule = (data.rules || []).filter(function (r) { return r.id === payload.id; })[0];
      if (!rule) { A.toast('Rule not found.', 'error'); return; }
      A.openModal({
        title: 'Edit reward rule',
        confirmLabel: 'Save changes',
        width: 720,
        body: ruleFormBody(rule),
        onConfirm: function (modal) {
          var body = collectRuleBody(modal);
          if (!body.reason) { A.toast('A reason is required.', 'error'); return false; }
          return A.api('/api/admin/earnings/rules/' + encodeURIComponent(payload.id), { method: 'POST', body: body }).then(function () {
            A.toast('Reward rule updated.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('rules:toggle', function (payload) {
    var enable = payload.enabled === 'true';
    return A.confirmDialog({
      title: enable ? 'Enable reward rule' : 'Disable reward rule',
      messageHtml: enable ? 'This rule will be used for new earnings.' : 'New earnings will fall through to the next matching rule.',
      withReason: true,
      confirmLabel: enable ? 'Enable' : 'Disable',
      onConfirm: function (reason) {
        return A.api('/api/admin/earnings/rules/' + encodeURIComponent(payload.id) + '/toggle', {
          method: 'POST',
          body: { enabled: enable, reason: reason }
        }).then(function () {
          A.toast('Reward rule updated.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('rules:history', function (payload) {
    return A.api('/api/admin/earnings/rules/' + encodeURIComponent(payload.id) + '/changes').then(function (data) {
      var changes = data.changes || [];
      A.openModal({
        title: 'Reward rule change history',
        hideConfirm: true,
        width: 720,
        body: changes.length
          ? '<ul class="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)]">' + changes.map(function (c) {
              return '<li class="px-4 py-3">' +
                '<p class="text-xs text-[var(--text-muted)]">' + esc(A.formatDate(c.createdAt)) + (c.reason ? ' · ' + esc(c.reason) : '') + '</p>' +
                '<p class="text-xs text-[var(--text-secondary)] mt-1 break-all">Old: ' + esc(JSON.stringify(c.oldValues)) + '</p>' +
                '<p class="text-xs text-white mt-0.5 break-all">New: ' + esc(JSON.stringify(c.newValues)) + '</p></li>';
            }).join('') + '</ul>'
          : ui.empty('No changes recorded yet.', 'history')
      });
    });
  });
})();
