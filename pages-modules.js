/* ================================================================
   EarnHub Admin - Module management pages
   Modules, AI training, writing, hotel reviews, spin, products.
   ================================================================ */

(function () {
  'use strict';

  var A = window.AdminApp;
  var ui = A.ui;
  var esc = A.esc;

  function money(value) { return A.formatKES(value); }

  var moduleLimitsCache = {};

  /* ============================================================
     Modules
     ============================================================ */

  A.registerPage({
    id: 'modules',
    title: 'Earning Modules',
    subtitle: 'Availability, maintenance and access fees',
    icon: 'blocks',
    group: 'modules',
    permissions: ['modules.view'],
    render: function (container) {
      return A.api('/api/admin/modules').then(function (data) {
        var modules = data.modules || [];
        var canManage = A.hasPermission('modules.manage');

        modules.forEach(function (m) { moduleLimitsCache[m.key] = m.limits || {}; });

        var cards = modules.map(function (m) {
          return (
            '<div class="card">' +
            '<div class="flex items-start justify-between gap-3">' +
            '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="shrink-0 flex items-center justify-center rounded-xl" style="width:40px;height:40px;background:rgba(16,185,129,0.12);color:var(--accent-emerald)">' +
            '<i data-lucide="' + esc(m.icon || 'box') + '" class="h-5 w-5" aria-hidden="true"></i></span>' +
            '<div class="min-w-0"><p class="font-display font-bold text-white truncate">' + esc(m.name) + '</p>' +
            '<p class="text-xs text-[var(--text-muted)] font-mono truncate">' + esc(m.key) + '</p></div>' +
            '</div>' +
            '<div class="shrink-0 flex flex-col items-end gap-1">' + A.statusBadge(m.enabled ? 'active' : 'disabled') +
            (m.maintenanceMode ? A.statusBadge('maintenance') : '') +
            '</div>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-3 mt-4">' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Access fee</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + (m.paid ? money(m.feeKES) : 'Free') + '</p></div>' +
            '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Active users</p>' +
            '<p class="font-display font-bold text-white mt-0.5">' + A.formatNumber(m.activeUsers) + '</p></div>' +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--border-primary)]">' +
            ui.button({ action: 'modules:view', label: 'Details', icon: 'eye', variant: 'ghost', data: { key: m.key, name: m.name } }) +
            (canManage
              ? ui.button({ action: 'modules:toggle', label: m.enabled ? 'Disable' : 'Enable', icon: m.enabled ? 'power-off' : 'power', variant: m.enabled ? 'danger' : 'primary', data: { key: m.key, enabled: m.enabled ? 'true' : 'false' } }) +
                ui.button({ action: 'modules:maintenance', label: 'Maintenance', icon: 'wrench', variant: 'ghost', data: { key: m.key, name: m.name, current: m.maintenanceMode ? 'true' : 'false' } }) +
                ui.button({ action: 'modules:limits', label: 'Earning limits', icon: 'sliders-horizontal', variant: 'ghost', data: { key: m.key, name: m.name } }) +
                (m.paid ? ui.button({ action: 'modules:fee', label: 'Edit fee', icon: 'tag', variant: 'ghost', data: { key: m.key, name: m.name, fee: String(m.feeKES || 0) } }) : '')
              : '') +
            '</div></div>'
          );
        }).join('');

        container.innerHTML =
          ui.pageHeader('Earning Modules', modules.length + ' modules configured') +
          (modules.length
            ? '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">' + cards + '</div>'
            : ui.card(ui.empty('No modules are configured.', 'blocks')));
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  A.onAction('modules:view', function (payload) {
    return A.api('/api/admin/modules/' + encodeURIComponent(payload.key)).then(function (data) {
      var m = data.module;
      var settings = Object.keys(m.settings || {}).sort().map(function (key) {
        var s = m.settings[key];
        return { label: key.replace(/^module_/, '').replace(/_/g, ' '), value: s.value, type: s.type };
      });
      A.openModal({
        title: m.config.name,
        hideConfirm: true,
        body:
          ui.statRow([
            { label: 'Access fee', value: m.config.paid ? money(m.feeKES) : 'Free' },
            { label: 'Unlocks', value: A.formatNumber((m.accessRecords || []).filter(function (r) { return r.status === 'active'; }).length) },
            { label: 'Transactions', value: A.formatNumber((m.transactions || []).length) },
            { label: 'Route', value: m.config.route }
          ]) +
          (settings.length
            ? '<div class="mt-5"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Settings</p>' +
              '<div class="rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">' +
              settings.map(function (s) {
                return '<div class="flex items-center justify-between gap-3 px-4 py-2.5"><span class="text-sm text-[var(--text-secondary)]">' + esc(s.label) + '</span>' +
                  '<span class="font-mono text-xs text-white">' + esc(s.value) + '</span></div>';
              }).join('') + '</div></div>'
            : '') +
          listSection('Access records', (m.accessRecords || []).slice(0, 25).map(function (r) {
            return {
              title: (r.user && (r.user.username || r.user.email)) || 'Unknown user',
              meta: r.status + ' · ' + A.timeAgo(r.unlockedAt || r.createdAt),
              right: money(r.amountPaid)
            };
          })) +
          listSection('Recent transactions', (m.transactions || []).slice(0, 25).map(function (t) {
            return {
              title: (t.user && (t.user.username || t.user.email)) || 'Unknown user',
              meta: t.type + ' · ' + t.status,
              right: money(t.amountKES)
            };
          }))
      });
    });
  });

  function listSection(title, items) {
    if (!items || !items.length) return '';
    return (
      '<div class="mt-5"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">' + esc(title) + '</p>' +
      '<ul class="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)] max-h-64 overflow-y-auto main-scrollbar">' +
      items.map(function (item) {
        return '<li class="flex items-center justify-between gap-3 px-4 py-2.5">' +
          '<span class="min-w-0"><span class="block text-sm text-[var(--text-primary)] truncate">' + esc(item.title) + '</span>' +
          '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(item.meta) + '</span></span>' +
          '<span class="shrink-0 text-sm font-semibold text-white">' + esc(item.right) + '</span></li>';
      }).join('') + '</ul></div>'
    );
  }

  A.onAction('modules:toggle', function (payload) {
    var enable = payload.enabled === 'true';
    return A.confirmDialog({
      title: (enable ? 'Enable' : 'Disable') + ' module',
      messageHtml: (enable
        ? 'Users will be able to access this module again.'
        : 'New access to this module will be blocked. Existing access is preserved.') + '<br /><span class="text-xs text-[var(--text-muted)]">Module key: <code>' + esc(payload.key) + '</code></span>',
      withReason: true,
      confirmLabel: enable ? 'Enable' : 'Disable',
      onConfirm: function (reason) {
        return A.api('/api/admin/modules/' + encodeURIComponent(payload.key) + '/settings', {
          method: 'POST',
          body: { enabled: enable, reason: reason }
        }).then(function () {
          A.toast('Module ' + (enable ? 'enabled' : 'disabled') + '.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('modules:maintenance', function (payload) {
    var target = payload.current === 'true' ? false : true;
    return A.confirmDialog({
      title: (target ? 'Enable' : 'Disable') + ' maintenance mode',
      messageHtml: (target
        ? 'Users will see a maintenance notice for <strong>' + esc(payload.name) + '</strong>.'
        : 'Maintenance mode will be turned off for <strong>' + esc(payload.name) + '</strong>.'),
      withReason: true,
      confirmLabel: target ? 'Enable maintenance' : 'End maintenance',
      onConfirm: function (reason) {
        return A.api('/api/admin/modules/' + encodeURIComponent(payload.key) + '/settings', {
          method: 'POST',
          body: { maintenanceMode: target, reason: reason }
        }).then(function () {
          A.toast('Maintenance mode updated.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('modules:fee', function (payload) {
    var currentShillings = (Number(payload.fee) || 0) / 100;
    A.openModal({
      title: 'Access fee — ' + payload.name,
      confirmLabel: 'Save fee',
      body:
        '<p class="text-sm text-[var(--text-secondary)] mb-4">The access fee is stored in the platform fee table and the settings table, both of which take precedence over environment defaults.</p>' +
        ui.input({ name: 'feeShillings', label: 'Fee (KES)', type: 'number', value: currentShillings.toFixed(2), attrs: 'step="0.01" min="0"' }) +
        '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason', type: 'textarea', required: true }) + '</div>',
      onConfirm: function (modal) {
        var reason = modal.querySelector('[name="reason"]').value.trim();
        var value = Number(modal.querySelector('[name="feeShillings"]').value);
        if (!reason) { A.toast('A reason is required.', 'error'); return false; }
        if (!(value >= 0)) { A.toast('Enter a valid fee.', 'error'); return false; }
        return A.api('/api/admin/modules/' + encodeURIComponent(payload.key) + '/settings', {
          method: 'POST',
          body: { accessFee: Math.round(value * 100), reason: reason }
        }).then(function () {
          A.toast('Access fee updated to ' + A.formatKES(Math.round(value * 100)) + '.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('modules:limits', function (payload) {
    var limits = moduleLimitsCache[payload.key] || {};
    var field = function (name, label, value, hint) {
      return ui.input({ name: name, label: label, type: 'number', value: value === null || value === undefined ? '' : value, attrs: 'step="0.01" min="0"', hint: hint });
    };

    A.openModal({
      title: 'Earning limits — ' + payload.name,
      confirmLabel: 'Save limits',
      body:
        '<p class="text-sm text-[var(--text-secondary)] mb-4">These limits are stored in the database and enforced server-side on every earning. Leave a value empty for no limit.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        field('minRewardKES', 'Minimum reward (KES)', limits.minRewardKES === null || limits.minRewardKES === undefined ? '' : (limits.minRewardKES / 100).toFixed(2)) +
        field('maxRewardKES', 'Maximum reward (KES)', limits.maxRewardKES === null || limits.maxRewardKES === undefined ? '' : (limits.maxRewardKES / 100).toFixed(2)) +
        field('dailyEarningLimit', 'Daily earning limit (KES)', limits.dailyEarningLimitKES ? (limits.dailyEarningLimitKES / 100).toFixed(2) : '') +
        field('dailyTaskLimit', 'Daily task limit', limits.dailyTaskLimit || '') +
        field('cooldownMinutes', 'Cooldown (minutes)', limits.cooldownMinutes || '') +
        field('sessionMinutes', 'Task session length (minutes)', limits.sessionMinutes || 30) +
        field('maxSubmissionsPerHour', 'Max submissions / hour', limits.maxSubmissionsPerHour || 20) +
        ui.select({ name: 'autoApprove', label: 'Auto approve verified earnings', value: limits.autoApprove === false ? 'false' : 'true', options: [
          { value: 'true', label: 'Yes — pay immediately after quality checks' },
          { value: 'false', label: 'No — send every earning to manual review' }
        ] }) +
        '</div>' +
        '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason (recorded in audit log)', type: 'textarea', required: true }) + '</div>',
      onConfirm: function (modal) {
        var get = function (n) { var el = modal.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
        var reason = get('reason');
        if (!reason) { A.toast('A reason is required.', 'error'); return false; }
        var toCents = function (v) { return v === '' ? null : Math.round(Number(v) * 100); };
        return A.api('/api/admin/modules/' + encodeURIComponent(payload.key) + '/settings', {
          method: 'POST',
          body: {
            minReward: toCents(get('minRewardKES')),
            maxReward: toCents(get('maxRewardKES')),
            dailyEarningLimit: get('dailyEarningLimit') === '' ? 0 : Math.round(Number(get('dailyEarningLimit')) * 100),
            dailyTaskLimit: get('dailyTaskLimit') === '' ? 0 : Number(get('dailyTaskLimit')),
            cooldownMinutes: get('cooldownMinutes') === '' ? 0 : Number(get('cooldownMinutes')),
            sessionMinutes: get('sessionMinutes') === '' ? 30 : Number(get('sessionMinutes')),
            maxSubmissionsPerHour: get('maxSubmissionsPerHour') === '' ? 20 : Number(get('maxSubmissionsPerHour')),
            autoApprove: get('autoApprove') === 'true',
            reason: reason
          }
        }).then(function () {
          A.toast('Earning limits updated.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     AI Training
     ============================================================ */

  A.registerPage({
    id: 'ai-training',
    title: 'AI Training',
    subtitle: 'Training tasks and submission review',
    icon: 'brain-circuit',
    group: 'modules',
    permissions: ['tasks.manage', 'tasks.review'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('AI Training', 'Loading', '') + '<div class="card">' + ui.skeleton(4) + '</div>';
        var tasksPromise = A.hasPermission('tasks.manage')
          ? A.api('/api/admin/ai-training/tasks')
          : Promise.resolve({ tasks: [] });
        var subsPromise = A.hasPermission('tasks.review')
          ? A.api('/api/admin/ai-training/submissions')
          : Promise.resolve({ submissions: [] });

        return Promise.all([tasksPromise, subsPromise]).then(function (results) {
          var tasks = results[0].tasks || [];
          var submissions = results[1].submissions || [];
          var pending = submissions.filter(function (s) { return s.status === 'submitted'; });

          container.innerHTML =
            ui.pageHeader('AI Training',
              A.formatNumber(pending.length) + ' submissions awaiting review',
              A.hasPermission('tasks.manage') ? ui.button({ action: 'ai:new-task', label: 'New task', icon: 'plus', variant: 'primary' }) : '') +
            '<div class="space-y-4">' +
            ui.card(ui.sectionTitle('Training tasks', 'Published and draft tasks') + ui.tableWrapper([
              { key: 'title', label: 'Task', render: function (t) {
                return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(t.title) + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(t.description || t.taskType) + '</span></div>';
              } },
              { key: 'rewardKES', label: 'Reward', align: true, render: function (t) { return '<span class="text-sm text-white">' + money(t.rewardKES) + '</span>'; } },
              { key: 'questions', label: 'Questions', align: true, render: function (t) {
                return '<span class="text-sm text-white">' + A.formatNumber((t._count && t._count.questions) || 0) + '</span>';
              } },
              { key: 'deadline', label: 'Deadline', render: function (t) { return '<span class="text-xs">' + esc(t.deadline ? A.formatDate(t.deadline) : 'Open') + '</span>'; } },
              { key: 'status', label: 'Status', render: function (t) { return A.statusBadge(t.status); } },
              { key: '_count', label: 'Submissions', align: true, render: function (t) { return '<span class="text-sm text-white">' + A.formatNumber((t._count && t._count.submissions) || 0) + '</span>'; } },
              { key: 'actions', label: '', align: true, render: function (t) {
                if (!A.hasPermission('tasks.manage')) return '';
                return ui.button({ action: 'ai:questions', label: 'Questions', icon: 'list-checks', variant: 'ghost', data: { id: t.id, title: t.title } }) +
                  ui.button({ action: 'ai:publish', label: t.status === 'published' ? 'Pause' : 'Publish', icon: t.status === 'published' ? 'pause' : 'play', variant: 'ghost', data: { id: t.id, title: t.title, status: t.status } }) +
                  ui.button({ action: 'ai:edit-task', label: 'Edit', icon: 'pencil', variant: 'ghost', data: { id: t.id } });
              } }
            ], tasks, 'No AI training tasks yet.')) +
            ui.card(ui.sectionTitle('Submissions', 'Review answers and release rewards') + ui.tableWrapper([
              { key: 'user', label: 'User', render: function (s) {
                var u = s.user || {};
                return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
              } },
              { key: 'task', label: 'Task', render: function (s) { return '<span class="text-xs">' + esc(s.task ? s.task.title : '—') + '</span>'; } },
              { key: 'score', label: 'Score', align: true, render: function (s) {
                return s.score === null || s.score === undefined ? '<span class="text-[var(--text-muted)]">—</span>' : '<span class="text-sm text-white">' + esc(s.score) + '</span>';
              } },
              { key: 'earningTx', label: 'Reward', align: true, render: function (s) {
                if (!s.earningTx) return '<span class="text-[var(--text-muted)]">—</span>';
                return '<div class="text-right"><span class="block text-sm text-white">' + money(s.earningTx.earnHubReward) + '</span>' +
                  '<span class="block text-[11px] text-[var(--text-muted)]">' + esc(s.earningTx.status) + '</span></div>';
              } },
              { key: 'status', label: 'Status', render: function (s) { return A.statusBadge(s.status); } },
              { key: 'createdAt', label: 'Submitted', render: function (s) { return '<span class="text-xs">' + esc(A.timeAgo(s.createdAt)) + '</span>'; } },
              { key: 'actions', label: '', align: true, render: function (s) {
                return A.hasPermission('tasks.review')
                  ? ui.button({ action: 'ai:review', label: 'Review', icon: 'gavel', variant: 'ghost', data: { id: s.id } })
                  : '';
              } }
            ], submissions, 'No submissions yet.')) +
            '</div>';
        });
      }
      return load();
    }
  });

  A.onAction('ai:new-task', function () {
    A.api('/api/admin/modules').then(function (data) {
      A.openModal({
        title: 'Create AI training task',
        confirmLabel: 'Create task',
        body:
          '<div class="space-y-3">' +
          ui.input({ name: 'title', label: 'Title', required: true, attrs: 'autofocus' }) +
          ui.input({ name: 'description', label: 'Description', type: 'textarea', rows: 2 }) +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          ui.select({ name: 'taskType', label: 'Task type', value: 'text_classification', options: [
            { value: 'text_classification', label: 'Text classification' },
            { value: 'image_classification', label: 'Image classification' },
            { value: 'sentiment', label: 'Sentiment analysis' },
            { value: 'entity_recognition', label: 'Entity recognition' },
            { value: 'custom', label: 'Custom' }
          ] }) +
          ui.input({ name: 'rewardKES', label: 'Reward (KES)', type: 'number', value: '1.00', attrs: 'step="0.01" min="0"' }) +
          '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          ui.input({ name: 'maxParticipants', label: 'Max participants', type: 'number', placeholder: 'Unlimited' }) +
          ui.input({ name: 'deadline', label: 'Deadline', type: 'datetime-local' }) +
          '</div>' +
          ui.select({ name: 'status', label: 'Status', value: 'draft', options: [
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'paused', label: 'Paused' },
            { value: 'closed', label: 'Closed' }
          ] }) +
          '<p class="text-xs text-[var(--text-muted)]">Modules available on this platform: ' + esc((data.modules || []).length) + '.</p>' +
          '</div>',
        onConfirm: function (modal) {
          var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
          if (!get('title')) { A.toast('Title is required.', 'error'); return false; }
          var maxParticipants = get('maxParticipants');
          return A.api('/api/admin/ai-training/tasks', {
            method: 'POST',
            body: {
              title: get('title'),
              description: get('description'),
              taskType: get('taskType'),
              rewardKES: Math.round(Number(get('rewardKES') || 0) * 100),
              maxParticipants: maxParticipants ? Number(maxParticipants) : null,
              deadline: get('deadline') || null,
              status: get('status')
            }
          }).then(function () {
            A.toast('AI training task created.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('ai:review', function (payload) {
    return A.api('/api/admin/ai-training/submissions?limit=100').then(function (data) {
      var submission = (data.submissions || []).filter(function (s) { return s.id === payload.id; })[0];
      if (!submission) { A.toast('Submission not found.', 'error'); return; }
      var earning = submission.earningTx;
      var alreadyPaid = earning && earning.status === 'APPROVED';

      A.openModal({
        title: 'Review AI submission',
        confirmLabel: 'Save review',
        body:
          '<p class="text-sm text-[var(--text-secondary)] mb-4">' + esc((submission.task && submission.task.title) || 'Task') + ' — ' +
          esc((submission.user && (submission.user.username || submission.user.email)) || '') + '</p>' +
          '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">' +
          statChip('Score', submission.score === null || submission.score === undefined ? '—' : submission.score) +
          statChip('Accuracy', submission.accuracy === null || submission.accuracy === undefined ? '—' : submission.accuracy + '%') +
          statChip('Reward', earning ? money(earning.earnHubReward) : 'Not issued') +
          statChip('Earning', earning ? earning.status : '—') +
          '</div>' +
          (submission.flags && submission.flags.length
            ? '<p class="text-xs text-[var(--accent-amber)] mb-3">Quality flags: ' + esc(submission.flags.join(', ')) + '</p>'
            : '') +
          '<pre class="max-h-56 overflow-auto main-scrollbar rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">' +
          esc(JSON.stringify(submission.responses, null, 2)) + '</pre>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">' +
          ui.select({ name: 'decision', label: 'Decision', value: alreadyPaid ? 'none' : (submission.status === 'approved' ? 'none' : 'approve'), options: [
            { value: 'approve', label: 'Approve and pay' },
            { value: 'reject', label: 'Reject (no payment)' },
            { value: 'reverse', label: 'Reverse a paid reward' },
            { value: 'none', label: 'No change' }
          ] }) +
          ui.input({ name: 'score', label: 'Score', type: 'number', value: submission.score === null ? '' : submission.score, attrs: 'step="0.01"' }) +
          '</div>' +
          '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason (recorded in the audit log)', type: 'textarea' }) + '</div>' +
          '<div class="mt-3">' + ui.input({ name: 'feedback', label: 'Feedback to the contributor', type: 'textarea' }) + '</div>' +
          '<p class="text-xs text-[var(--text-muted)] mt-2">Approving credits the contributor wallet and writes a wallet ledger entry. Reversing creates a compensating transaction and debits the wallet.</p>',
        onConfirm: function (modal) {
          var decision = modal.querySelector('[name="decision"]').value;
          var scoreRaw = modal.querySelector('[name="score"]').value;
          var reason = modal.querySelector('[name="reason"]').value.trim();
          var feedback = modal.querySelector('[name="feedback"]').value.trim();
          if (decision === 'none') { A.toast('Select a decision first.', 'error'); return false; }
          if ((decision === 'reject' || decision === 'reverse') && !reason) { A.toast('A reason is required.', 'error'); return false; }
          return A.api('/api/admin/ai-training/submissions/' + encodeURIComponent(payload.id) + '/review', {
            method: 'POST',
            body: {
              action: decision,
              score: scoreRaw === '' ? null : Number(scoreRaw),
              reason: reason || null,
              feedback: feedback || null
            }
          }).then(function () {
            A.toast('Submission reviewed.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  function statChip(label, value) {
    return '<div class="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2">' +
      '<p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">' + esc(label) + '</p>' +
      '<p class="font-display font-bold text-white">' + esc(value) + '</p></div>';
  }

  A.onAction('ai:publish', function (payload) {
    var target = payload.status === 'published' ? 'paused' : 'published';
    return A.confirmDialog({
      title: target === 'published' ? 'Publish task' : 'Pause task',
      messageHtml: target === 'published'
        ? 'Users will immediately be able to find and complete <strong>' + esc(payload.title) + '</strong>.'
        : '<strong>' + esc(payload.title) + '</strong> will be hidden from users. Existing submissions are kept.',
      withReason: true,
      confirmLabel: target === 'published' ? 'Publish' : 'Pause',
      onConfirm: function (reason) {
        return A.api('/api/admin/ai-training/tasks/' + encodeURIComponent(payload.id) + '/status', {
          method: 'POST',
          body: { status: target, reason: reason }
        }).then(function () {
          A.toast('Task ' + target + '.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('ai:edit-task', function (payload) {
    return A.api('/api/admin/ai-training/tasks').then(function (data) {
      var task = (data.tasks || []).filter(function (t) { return t.id === payload.id; })[0];
      if (!task) { A.toast('Task not found.', 'error'); return; }
      A.openModal({
        title: 'Edit AI training task',
        confirmLabel: 'Save task',
        body:
          '<div class="space-y-3">' +
          ui.input({ name: 'title', label: 'Title', value: task.title, required: true }) +
          ui.input({ name: 'description', label: 'Description', type: 'textarea', rows: 2, value: task.description || '' }) +
          '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
          ui.select({ name: 'taskType', label: 'Task type', value: task.taskType, options: [
            { value: 'text_classification', label: 'Text classification' },
            { value: 'image_classification', label: 'Image classification' },
            { value: 'sentiment', label: 'Sentiment analysis' },
            { value: 'entity_recognition', label: 'Entity recognition' },
            { value: 'quality_rating', label: 'Quality rating' },
            { value: 'safety_evaluation', label: 'Safety evaluation' },
            { value: 'custom', label: 'Custom' }
          ] }) +
          ui.input({ name: 'rewardKES', label: 'Reward (KES)', type: 'number', value: ((task.rewardKES || 0) / 100).toFixed(2), attrs: 'step="0.01" min="0"' }) +
          ui.input({ name: 'accuracyReq', label: 'Min accuracy (%)', type: 'number', value: task.accuracyReq === null || task.accuracyReq === undefined ? '' : task.accuracyReq, attrs: 'step="0.01" min="0" max="100"' }) +
          '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          ui.input({ name: 'maxParticipants', label: 'Max participants', type: 'number', value: task.maxParticipants || '' }) +
          ui.input({ name: 'deadline', label: 'Deadline', type: 'datetime-local', value: task.deadline ? String(task.deadline).slice(0, 16) : '' }) +
          '</div>' +
          '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason (audited)', type: 'textarea' }) + '</div>' +
          '</div>',
        onConfirm: function (modal) {
          var get = function (n) { var el = modal.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
          var accuracy = get('accuracyReq');
          return A.api('/api/admin/ai-training/tasks/' + encodeURIComponent(payload.id), {
            method: 'POST',
            body: {
              title: get('title'),
              description: get('description'),
              taskType: get('taskType'),
              rewardKES: Math.round(Number(get('rewardKES') || 0) * 100),
              accuracyReq: accuracy === '' ? null : Number(accuracy),
              maxParticipants: get('maxParticipants') ? Number(get('maxParticipants')) : null,
              deadline: get('deadline') || null,
              reason: get('reason') || null
            }
          }).then(function () {
            A.toast('Task updated.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('ai:questions', function (payload) {
    return A.api('/api/admin/ai-training/tasks/' + encodeURIComponent(payload.id) + '/questions').then(function (data) {
      var questions = data.questions || [];
      var locked = payload.status && payload.status !== 'draft' && payload.status !== 'paused';

      var rows = questions.map(function (q) {
        var options = q.options;
        if (options && typeof options === 'string') { try { options = JSON.parse(options); } catch (e) { options = null; } }
        return '<div class="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--border-primary)] last:border-0">' +
          '<div class="min-w-0"><p class="text-sm text-white">' + esc(q.questionIndex + 1 + '. ' + q.questionText) + '</p>' +
          '<p class="text-xs text-[var(--text-muted)] mt-0.5">' + esc(q.questionType) +
          (options && options.length ? ' · ' + esc(options.join(' | ')) : '') + '</p></div>' +
          '<div class="shrink-0 flex items-center gap-2">' +
          (q.isGold ? A.statusBadge('gold') : '') +
          '<span class="text-xs font-mono text-[var(--accent-emerald)]">' + esc(q.correctAnswer) + '</span>' +
          (locked ? '' :
            ui.button({ action: 'ai:question-up', label: '', icon: 'chevron-up', variant: 'subtle', data: { 'question-id': q.id, 'task-id': payload.id } }) +
            ui.button({ action: 'ai:question-delete', label: '', icon: 'trash-2', variant: 'subtle', data: { 'question-id': q.id } })) +
          '</div></div>';
      }).join('');

      A.openModal({
        title: 'Questions — ' + payload.title,
        hideConfirm: true,
        body:
          (locked ? '<p class="text-xs text-[var(--accent-amber)] mb-3">This task is published. Pause it before editing questions.</p>' : '') +
          (rows ? '<div class="rounded-xl border border-[var(--border-primary)]">' + rows + '</div>' : ui.empty('No questions yet.', 'list-checks')) +
          (locked ? '' :
            '<div class="mt-4">' + ui.button({ action: 'ai:question-add', label: 'Add question', icon: 'plus', variant: 'primary', data: { 'task-id': payload.id } }) + '</div>')
      });
    });
  });

  A.onAction('ai:question-add', function (payload) {
    A.openModal({
      title: 'Add question',
      confirmLabel: 'Add question',
      body:
        '<div class="space-y-3">' +
        ui.input({ name: 'questionText', label: 'Question', type: 'textarea', rows: 2, required: true }) +
        ui.select({ name: 'questionType', label: 'Answer type', value: 'multiple_choice', options: [
          { value: 'multiple_choice', label: 'Multiple choice' },
          { value: 'short_text', label: 'Short text' },
          { value: 'boolean', label: 'True / False' }
        ] }) +
        ui.input({ name: 'options', label: 'Options (comma separated)', value: '', placeholder: 'Yes, No' }) +
        ui.input({ name: 'correctAnswer', label: 'Correct answer', required: true }) +
        ui.input({ name: 'explanation', label: 'Explanation (optional)' }) +
        '<label class="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" name="isGold" class="h-4 w-4" /> Gold standard question (used for quality checks)</label>' +
        '</div>',
      onConfirm: function (modal) {
        var get = function (n) { var el = modal.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
        var options = get('options');
        if (!get('questionText') || !get('correctAnswer')) { A.toast('Question and correct answer are required.', 'error'); return false; }
        return A.api('/api/admin/ai-training/tasks/' + encodeURIComponent(payload.taskId) + '/questions', {
          method: 'POST',
          body: {
            questionText: get('questionText'),
            questionType: get('questionType'),
            options: options ? options.split(',').map(function (o) { return o.trim(); }).filter(Boolean) : null,
            correctAnswer: get('correctAnswer'),
            explanation: get('explanation') || null,
            isGold: modal.querySelector('[name="isGold"]').checked === true
          }
        }).then(function () {
          A.toast('Question added.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('ai:question-up', function (payload) {
    return A.api('/api/admin/ai-training/questions/' + encodeURIComponent(payload.questionId) + '/reorder', {
      method: 'POST',
      body: { direction: 'up' }
    }).then(function () {
      A.toast('Question moved.', 'success');
      A.refresh();
    });
  });

  A.onAction('ai:question-delete', function (payload) {
    return A.confirmDialog({
      title: 'Delete question',
      messageHtml: 'Existing submissions keep their stored answers. This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: function () {
        return fetch('/api/admin/ai-training/questions/' + encodeURIComponent(payload.questionId), {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (response) { return response.json(); }).then(function (res) {
          if (res.success === false) throw new Error(res.message || 'Failed to delete question');
          A.toast('Question deleted.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Write & Earn
     ============================================================ */

  A.registerPage({
    id: 'writing',
    title: 'Write & Earn',
    subtitle: 'Writing tasks, reviews and wallet rewards',
    icon: 'pen-line',
    group: 'modules',
    permissions: ['tasks.manage', 'tasks.review'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Write & Earn', 'Loading', '') + '<div class="card">' + ui.skeleton(4) + '</div>';
        var tasksPromise = A.hasPermission('tasks.manage')
          ? A.api('/api/admin/writing/tasks') : Promise.resolve({ tasks: [] });
        var subsPromise = A.hasPermission('tasks.review')
          ? A.api('/api/admin/writing/submissions') : Promise.resolve({ submissions: [] });
        return Promise.all([tasksPromise, subsPromise]).then(function (results) {
          var tasks = results[0].tasks || [];
          var submissions = results[1].submissions || [];
          var pending = submissions.filter(function (s) { return s.status === 'submitted'; });

          container.innerHTML =
            ui.pageHeader('Write & Earn',
              A.formatNumber(pending.length) + ' submissions awaiting review',
              A.hasPermission('tasks.manage') ? ui.button({ action: 'writing:new-task', label: 'New task', icon: 'plus', variant: 'primary' }) : '') +
            '<div class="space-y-4">' +
            ui.card(ui.sectionTitle('Writing tasks', 'Prompts open to contributors') + ui.tableWrapper([
              { key: 'title', label: 'Task', render: function (t) {
                return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(t.title) + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(t.description || t.instructions) + '</span></div>';
              } },
              { key: 'rewardKES', label: 'Reward', align: true, render: function (t) { return '<span class="text-sm text-white">' + money(t.rewardKES) + '</span>'; } },
              { key: 'wordCount', label: 'Words', align: true, render: function (t) {
                return '<span class="text-xs">' + A.formatNumber(t.minWords) + (t.maxWords ? '–' + A.formatNumber(t.maxWords) : '+') + '</span>';
              } },
              { key: 'status', label: 'Status', render: function (t) { return A.statusBadge(t.status); } },
               { key: '_count', label: 'Submissions', align: true, render: function (t) { return '<span class="text-sm text-white">' + A.formatNumber((t._count && t._count.submissions) || 0) + '</span>'; } },
               { key: 'actions', label: '', align: true, render: function (t) {
                 if (!A.hasPermission('tasks.manage')) return '';
                 return ui.button({ action: 'writing:delete-task', label: '', icon: 'trash-2', variant: 'subtle', data: { id: t.id, title: t.title } });
               } }
             ], tasks, 'No writing tasks yet.')) +
            ui.card(ui.sectionTitle('Submissions', 'Approving credits the contributor wallet') + ui.tableWrapper([
              { key: 'user', label: 'User', render: function (s) {
                var u = s.user || {};
                return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
              } },
              { key: 'title', label: 'Article', render: function (s) {
                return '<span class="text-xs">' + esc(s.title || (s.task && s.task.title) || '—') + '</span>';
              } },
              { key: 'wordCount', label: 'Words', align: true, render: function (s) { return '<span class="text-sm text-white">' + A.formatNumber(s.wordCount) + '</span>'; } },
              { key: 'status', label: 'Status', render: function (s) { return A.statusBadge(s.status); } },
              { key: 'actions', label: '', align: true, render: function (s) {
                return A.hasPermission('tasks.review')
                  ? ui.button({ action: 'writing:review', label: 'Review', icon: 'gavel', variant: 'ghost', data: { id: s.id } })
                  : '';
              } }
            ], submissions, 'No submissions yet.')) +
            '</div>';
        });
      }
      return load();
    }
  });

  A.onAction('writing:new-task', function () {
    A.openModal({
      title: 'Create writing task',
      confirmLabel: 'Create task',
      body:
        '<div class="space-y-3">' +
        ui.input({ name: 'title', label: 'Title', required: true, attrs: 'autofocus' }) +
        ui.input({ name: 'description', label: 'Summary', type: 'textarea', rows: 2 }) +
        ui.input({ name: 'instructions', label: 'Instructions', type: 'textarea', rows: 3, required: true }) +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
        ui.input({ name: 'minWords', label: 'Min words', type: 'number', value: '100' }) +
        ui.input({ name: 'maxWords', label: 'Max words', type: 'number', placeholder: 'None' }) +
        ui.input({ name: 'rewardKES', label: 'Reward (KES)', type: 'number', value: '1.00', attrs: 'step="0.01" min="0"' }) +
        ui.select({ name: 'status', label: 'Status', value: 'draft', options: [
          { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }
        ] }) +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        ui.input({ name: 'maxParticipants', label: 'Max participants', type: 'number', placeholder: 'Unlimited' }) +
        ui.input({ name: 'deadline', label: 'Deadline', type: 'datetime-local' }) +
        '</div></div>',
      onConfirm: function (modal) {
        var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
        if (!get('title') || !get('instructions')) { A.toast('Title and instructions are required.', 'error'); return false; }
        return A.api('/api/admin/writing/tasks', {
          method: 'POST',
          body: {
            title: get('title'),
            description: get('description'),
            instructions: get('instructions'),
            minWords: Number(get('minWords') || 100),
            maxWords: get('maxWords') ? Number(get('maxWords')) : null,
            rewardKES: Math.round(Number(get('rewardKES') || 0) * 100),
            maxParticipants: get('maxParticipants') ? Number(get('maxParticipants')) : null,
            deadline: get('deadline') || null,
            status: get('status')
          }
        }).then(function () {
          A.toast('Writing task created.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('writing:review', function (payload) {
    return A.api('/api/admin/writing/submissions').then(function (data) {
      var submission = (data.submissions || []).filter(function (s) { return s.id === payload.id; })[0];
      if (!submission) { A.toast('Submission not found.', 'error'); return; }
      A.openModal({
        title: 'Review writing submission',
        confirmLabel: 'Save review',
        body:
          '<p class="text-sm text-[var(--text-secondary)] mb-4">' + esc((submission.task && submission.task.title) || 'Task') + ' — ' +
          esc((submission.user && (submission.user.username || submission.user.email)) || '') + ' · ' + A.formatNumber(submission.wordCount) + ' words</p>' +
          '<pre class="max-h-64 overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">' +
          esc(submission.content) + '</pre>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">' +
          ui.select({ name: 'status', label: 'Decision', value: submission.status === 'submitted' ? 'approved' : submission.status, options: [
            { value: 'approved', label: 'Approve and pay' },
            { value: 'rejected', label: 'Reject' },
            { value: 'pending', label: 'Keep pending' }
          ] }) +
          ui.input({ name: 'rewardKES', label: 'Reward to credit (KES)', type: 'number', value: ((submission.rewardKES || 0) / 100).toFixed(2), attrs: 'step="0.01" min="0"' }) +
          '</div>' +
          '<div class="mt-3">' + ui.input({ name: 'feedback', label: 'Feedback', type: 'textarea' }) + '</div>' +
          '<p class="text-xs text-[var(--text-muted)] mt-2">Approving credits the contributor wallet and writes a wallet ledger entry.</p>',
        onConfirm: function (modal) {
          var status = modal.querySelector('[name="status"]').value;
          var reward = Number(modal.querySelector('[name="rewardKES"]').value || 0);
          return A.api('/api/admin/writing/submissions/' + encodeURIComponent(payload.id) + '/review', {
            method: 'POST',
            body: {
              status: status,
              rewardKES: Math.round(reward * 100),
              feedback: modal.querySelector('[name="feedback"]').value.trim() || null
            }
          }).then(function () {
            A.toast('Submission reviewed.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('writing:delete-task', function (payload) {
    return A.confirmDialog({
      title: 'Delete writing task',
      messageHtml: 'Are you sure you want to delete <strong>' + esc(payload.title) + '</strong>? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: function () {
        return fetch('/api/admin/writing/tasks/' + encodeURIComponent(payload.id), {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (response) { return response.json(); }).then(function (res) {
          if (res.success === false) throw new Error(res.message || 'Failed to delete task');
          A.toast('Writing task deleted.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Hotel reviews
     ============================================================ */

  var reviewStatus = '';

  A.registerPage({
    id: 'hotel-reviews',
    title: 'Hotel Reviews',
    subtitle: 'Moderate submitted hotel reviews',
    icon: 'building-2',
    group: 'modules',
    permissions: ['reviews.manage'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Hotel Reviews', 'Loading', '') + '<div class="card">' + ui.skeleton(4) + '</div>';
        var query = '/api/admin/reviews' + (reviewStatus ? '?status=' + encodeURIComponent(reviewStatus) : '');
        return A.api(query).then(function (data) {
          var reviews = data.reviews || [];
          var pending = reviews.filter(function (r) { return r.status === 'pending'; });

          container.innerHTML =
            ui.pageHeader('Hotel Reviews', A.formatNumber(pending.length) + ' awaiting moderation') +
            '<div class="card mb-4"><div class="flex flex-wrap gap-2">' +
            ['', 'pending', 'approved', 'rejected'].map(function (value) {
              var active = reviewStatus === value;
              return '<button type="button" data-review-status="' + esc(value) + '" class="h-9 rounded-lg px-3 text-xs font-semibold border transition-colors ' +
                (active ? 'border-[var(--accent-emerald)]/40 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]') + '">' +
                esc(value || 'All') + '</button>';
            }).join('') +
            '</div></div>' +
            ui.tableWrapper([
              { key: 'user', label: 'Contributor', render: function (r) {
                var u = r.user || {};
                return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
              } },
              { key: 'hotelName', label: 'Hotel', render: function (r) {
                return '<div class="min-w-0"><span class="block text-white truncate">' + esc(r.hotelName) + '</span>' +
                  '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(r.hotelLocation || '—') + '</span></div>';
              } },
              { key: 'rating', label: 'Rating', align: true, render: function (r) {
                if (r.rating === null || r.rating === undefined) return '<span class="text-[var(--text-muted)]">—</span>';
                return '<span class="text-sm text-white">' + '★'.repeat(Math.max(0, Math.min(5, r.rating))) + '</span>';
              } },
              { key: 'status', label: 'Status', render: function (r) { return A.statusBadge(r.status); } },
              { key: 'createdAt', label: 'Submitted', render: function (r) { return '<span class="text-xs">' + esc(A.timeAgo(r.createdAt)) + '</span>'; } },
              { key: 'actions', label: '', align: true, render: function (r) {
                return ui.button({ action: 'reviews:view', label: 'Open', icon: 'eye', variant: 'ghost', data: { id: r.id } });
              } }
            ], reviews, 'No reviews to moderate.');

          Array.prototype.forEach.call(container.querySelectorAll('[data-review-status]'), function (btn) {
            btn.addEventListener('click', function () {
              reviewStatus = btn.getAttribute('data-review-status');
              load();
            });
          });
        });
      }
      return load();
    }
  });

  A.onAction('reviews:view', function (payload) {
    return A.api('/api/admin/reviews').then(function (data) {
      var review = (data.reviews || []).filter(function (r) { return r.id === payload.id; })[0];
      if (!review) { A.toast('Review not found.', 'error'); return; }
      A.openModal({
        title: review.hotelName,
        confirmLabel: 'Save decision',
        body:
          '<p class="text-sm text-[var(--text-secondary)] mb-4">' + esc((review.user && (review.user.username || review.user.email)) || '') + ' · ' +
          esc(A.formatDate(review.createdAt)) + (review.hotelLocation ? ' · ' + esc(review.hotelLocation) : '') + '</p>' +
          '<div class="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">' +
          esc(review.reviewText) + '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">' +
          ui.select({ name: 'status', label: 'Decision', value: review.status === 'pending' ? 'approved' : review.status, options: [
            { value: 'approved', label: 'Approve and pay' },
            { value: 'rejected', label: 'Reject' },
            { value: 'pending', label: 'Keep pending' }
          ] }) +
          ui.input({ name: 'rewardKES', label: 'Reward to credit (KES)', type: 'number', value: ((review.rewardKES || 0) / 100).toFixed(2), attrs: 'step="0.01" min="0"' }) +
          '</div>' +
          '<div class="mt-3">' + ui.input({ name: 'feedback', label: 'Moderator note', type: 'textarea', value: review.rejectionReason || '' }) + '</div>',
        onConfirm: function (modal) {
          var status = modal.querySelector('[name="status"]').value;
          var reward = Number(modal.querySelector('[name="rewardKES"]').value || 0);
          return A.api('/api/admin/reviews/' + encodeURIComponent(payload.id) + '/review', {
            method: 'POST',
            body: {
              status: status,
              rewardKES: Math.round(reward * 100),
              feedback: modal.querySelector('[name="feedback"]').value.trim() || null
            }
          }).then(function () {
            A.toast('Review ' + status + '.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  /* ============================================================
     Spin wheel
     ============================================================ */

  A.registerPage({
    id: 'spin',
    title: 'Spin Wheel',
    subtitle: 'Spin packages and reward tables',
    icon: 'circle-dot',
    group: 'modules',
    permissions: ['spin.manage'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Spin Wheel', 'Loading', '') + '<div class="card">' + ui.skeleton(4) + '</div>';
        return A.api('/api/admin/spin/packages').then(function (data) {
          var packages = data.packages || [];
          container.innerHTML =
            ui.pageHeader('Spin Wheel', packages.length + ' package' + (packages.length === 1 ? '' : 's'),
              ui.button({ action: 'spin:new-package', label: 'New package', icon: 'plus', variant: 'primary' })) +
            (packages.length
              ? '<div class="space-y-4">' + packages.map(function (p) {
                return ui.card(
                  '<div class="flex flex-wrap items-start justify-between gap-3">' +
                  '<div class="min-w-0"><h3 class="font-display font-bold text-white">' + esc(p.name) + '</h3>' +
                  '<p class="text-xs text-[var(--text-muted)] mt-1">' + esc(p.description || 'No description') + '</p></div>' +
                  A.statusBadge(p.isActive ? 'active' : 'disabled') +
                  '</div>' +
                  '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">' +
                  '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Price</p><p class="font-display font-bold text-white">' + money(p.priceKES) + '</p></div>' +
                  '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Spins</p><p class="font-display font-bold text-white">' + A.formatNumber(p.spinCount) + '</p></div>' +
                  '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Orders</p><p class="font-display font-bold text-white">' + A.formatNumber((p._count && p._count.orders) || 0) + '</p></div>' +
                  '<div><p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Rewards</p><p class="font-display font-bold text-white">' + A.formatNumber((p.rewards || []).length) + '</p></div>' +
                  '</div>' +
                  ((p.rewards || []).length
                    ? '<div class="mt-4 overflow-x-auto main-scrollbar"><table class="data-table" style="min-width:480px"><thead class="table-header"><tr><th>Label</th><th class="text-right">Value</th><th>Type</th><th class="text-right">Probability</th><th>Jackpot</th></tr></thead><tbody>' +
                      p.rewards.map(function (r) {
                        return '<tr><td class="text-white">' + esc(r.label) + '</td>' +
                          '<td class="text-right font-mono text-xs">' + esc(r.value) + '</td>' +
                          '<td>' + esc(r.valueType) + '</td>' +
                          '<td class="text-right font-mono text-xs">' + esc(r.probability) + '</td>' +
                          '<td>' + (r.isJackpot ? '<span class="status-badge status-pending">jackpot</span>' : '<span class="text-[var(--text-muted)]">—</span>') + '</td></tr>';
                      }).join('') + '</tbody></table></div>'
                    : '')
                );
              }).join('') + '</div>'
              : ui.card(ui.empty('No spin packages configured.', 'circle-dot')));
        });
      }
      return load();
    }
  });

  A.onAction('spin:new-package', function () {
    A.openModal({
      title: 'Create spin package',
      confirmLabel: 'Create package',
      body:
        '<div class="space-y-3">' +
        ui.input({ name: 'name', label: 'Package name', required: true, attrs: 'autofocus' }) +
        ui.input({ name: 'description', label: 'Description', type: 'textarea', rows: 2 }) +
        '<div class="grid grid-cols-2 gap-3">' +
        ui.input({ name: 'priceKES', label: 'Price (KES)', type: 'number', value: '1.00', attrs: 'step="0.01" min="0"' }) +
        ui.input({ name: 'spinCount', label: 'Spin count', type: 'number', value: '1', attrs: 'min="1"' }) +
        '</div>' +
        '<p class="text-xs text-[var(--text-muted)]">Rewards are defined as JSON. Each entry needs <code>label</code>, <code>value</code>, <code>valueType</code> and <code>probability</code>.</p>' +
        ui.input({ name: 'rewards', label: 'Rewards (JSON)', type: 'textarea', rows: 6, value: '[\n  { "label": "KES 0.50", "value": 50, "valueType": "wallet", "probability": 0.4, "isJackpot": false }\n]' }) +
        '</div>',
      onConfirm: function (modal) {
        var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
        if (!get('name')) { A.toast('Package name is required.', 'error'); return false; }
        var rewards;
        try {
          rewards = JSON.parse(get('rewards') || '[]');
        } catch (err) {
          A.toast('Rewards must be valid JSON.', 'error');
          return false;
        }
        if (!Array.isArray(rewards) || !rewards.length) { A.toast('Add at least one reward.', 'error'); return false; }
        return A.api('/api/admin/spin/packages', {
          method: 'POST',
          body: {
            name: get('name'),
            description: get('description'),
            priceKES: Math.round(Number(get('priceKES') || 0) * 100),
            spinCount: Number(get('spinCount') || 1),
            rewards: rewards
          }
        }).then(function () {
          A.toast('Spin package created.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Digital products
     ============================================================ */

  A.registerPage({
    id: 'products',
    title: 'Digital Products',
    subtitle: 'Downloadable product catalogue',
    icon: 'shopping-bag',
    group: 'modules',
    permissions: ['digital_products.manage'],
    render: function (container) {
      return A.api('/api/admin/products').then(function (data) {
        var products = data.products || [];
        container.innerHTML =
          ui.pageHeader('Digital Products', products.length + ' product' + (products.length === 1 ? '' : 's'),
            ui.button({ action: 'products:new', label: 'New product', icon: 'plus', variant: 'primary' })) +
          ui.tableWrapper([
            { key: 'title', label: 'Product', render: function (p) {
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(p.title) + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] font-mono truncate">' + esc(p.slug) + '</span></div>';
            } },
            { key: 'category', label: 'Category', render: function (p) { return '<span class="text-xs">' + esc(p.category || '—') + '</span>'; } },
            { key: 'priceKES', label: 'Price', align: true, render: function (p) { return '<span class="font-display font-semibold text-white">' + money(p.priceKES) + '</span>'; } },
            { key: 'downloadCount', label: 'Orders', align: true, render: function (p) { return '<span class="text-sm text-white">' + A.formatNumber((p._count && p._count.orders) || 0) + '</span>'; } },
            { key: 'isActive', label: 'Status', render: function (p) { return A.statusBadge(p.isActive ? 'active' : 'disabled'); } },
            { key: 'createdAt', label: 'Created', render: function (p) { return '<span class="text-xs">' + esc(A.formatDate(p.createdAt)) + '</span>'; } }
          ], products, 'No digital products yet.');
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  A.onAction('products:new', function () {
    A.openModal({
      title: 'Create digital product',
      confirmLabel: 'Create product',
      body:
        '<div class="space-y-3">' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        ui.input({ name: 'slug', label: 'Slug', required: true, placeholder: 'my-product' }) +
        ui.input({ name: 'title', label: 'Title', required: true }) +
        '</div>' +
        ui.input({ name: 'description', label: 'Description', type: 'textarea', rows: 2 }) +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        ui.input({ name: 'priceKES', label: 'Price (KES)', type: 'number', value: '1.00', attrs: 'step="0.01" min="0"' }) +
        ui.input({ name: 'category', label: 'Category', placeholder: 'ebook' }) +
        '</div>' +
        ui.input({ name: 'fileUrl', label: 'File URL', placeholder: '/downloads/file.pdf' }) +
        ui.input({ name: 'thumbnailUrl', label: 'Thumbnail URL', placeholder: '/img/thumb.png' }) +
        '</div>',
      onConfirm: function (modal) {
        var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
        if (!get('slug') || !get('title')) { A.toast('Slug and title are required.', 'error'); return false; }
        return A.api('/api/admin/products', {
          method: 'POST',
          body: {
            slug: get('slug'),
            title: get('title'),
            description: get('description'),
            priceKES: Math.round(Number(get('priceKES') || 0) * 100),
            category: get('category') || null,
            fileUrl: get('fileUrl') || null,
            thumbnailUrl: get('thumbnailUrl') || null
          }
        }).then(function () {
          A.toast('Product created.', 'success');
          A.refresh();
        });
      }
    });
  });
})();
