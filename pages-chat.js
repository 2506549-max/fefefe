/* ================================================================
   EarnHub Admin - Chat & Earn
   Task authoring plus the conversation review queue.

   Every approve / reject / reverse here posts to the same review endpoint the
   service owns. The browser never computes a reward or decides whether a
   conversation passed: it renders what the server returns.
   ================================================================ */

(function () {
  'use strict';

  var A = window.AdminApp;
  var ui = A.ui;
  var esc = A.esc;

  function money(value) { return A.formatKES(value || 0); }
  function centsToInput(value) { return ((Number(value) || 0) / 100).toFixed(2); }
  function inputToCents(value) { return Math.round((Number(value) || 0) * 100); }

  function duration(seconds) {
    var s = Math.max(0, Number(seconds) || 0);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + 'm ' + (r < 10 ? '0' : '') + r + 's';
  }

  var TASK_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' }
  ];

  /* ============================================================
     Task management
     ============================================================ */

  A.registerPage({
    id: 'chat-tasks',
    title: 'Chat Tasks',
    subtitle: 'Author and control the conversation tasks users can earn from',
    icon: 'messages-square',
    group: 'modules',
    permissions: ['tasks.manage'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Chat Tasks', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';

        return A.api('/api/admin/chat/tasks').then(function (data) {
          var tasks = data.tasks || [];

          var columns = [
            { key: 'title', label: 'Task', render: function (t) {
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(t.title) + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(t.category || '—') + ' · ' + esc(t.difficulty || 'standard') + '</span></div>';
            } },
            { key: 'status', label: 'Status', render: function (t) {
              return A.statusBadge(String(t.status || '').toLowerCase()) +
                (t.active ? '' : ' ' + A.statusBadge('inactive'));
            } },
            { key: 'rewardKES', label: 'Reward', align: true, render: function (t) {
              return '<span class="font-display font-semibold text-white">' + money(t.rewardKES) + '</span>';
            } },
            { key: 'slots', label: 'Slots', align: true, render: function (t) {
              return '<span class="text-xs">' + A.formatNumber(t.currentCompletions || 0) + ' / ' +
                (t.maxCompletions === null || t.maxCompletions === undefined ? '∞' : A.formatNumber(t.maxCompletions)) + '</span>';
            } },
            { key: 'conversationCount', label: 'Chats', align: true, render: function (t) {
              return '<span class="text-xs">' + A.formatNumber(t.conversationCount || 0) + '</span>';
            } },
            { key: 'createdAt', label: 'Created', render: function (t) {
              return '<span class="text-xs">' + esc(A.timeAgo(t.createdAt)) + '</span>';
            } },
            { key: 'actions', label: '', align: true, render: function (t) {
              var out = ui.button({ action: 'chat:edit', label: 'Edit', icon: 'pencil', variant: 'ghost', data: { id: t.id } });
              if (t.status === 'published') {
                out += ui.button({ action: 'chat:status', label: 'Pause', icon: 'pause', variant: 'ghost', data: { id: t.id, status: 'paused' } });
              } else {
                out += ui.button({ action: 'chat:status', label: 'Publish', icon: 'play', variant: 'ghost', data: { id: t.id, status: 'published' } });
              }
              out += ui.button({ action: 'chat:delete', label: 'Delete', icon: 'trash-2', variant: 'danger', data: { id: t.id } });
              return out;
            } }
          ];

          container.innerHTML =
            ui.pageHeader('Chat Tasks', A.formatNumber(tasks.length) + ' task' + (tasks.length === 1 ? '' : 's'),
              ui.button({ action: 'chat:new', label: 'New task', icon: 'plus', variant: 'primary' })) +
            ui.tableWrapper(columns, tasks, 'No chat tasks yet. Create one to start offering earning opportunities.');

          A.bindActions(container);
          if (window.lucide) lucide.createIcons();
        }).catch(function (err) {
          container.innerHTML = ui.pageHeader('Chat Tasks', null, '') +
            ui.errorState(err && err.message, 'chat-tasks:refresh');
          A.bindActions(container);
        });
      }
      return load();
    }
  });

  A.onAction('chat-tasks:refresh', function () { A.refresh(); });

  A.onAction('chat:new', function () { openTaskForm(null); });
  A.onAction('chat:edit', function (payload) {
    A.api('/api/admin/chat/tasks').then(function (data) {
      var task = (data.tasks || []).filter(function (t) { return t.id === payload.id; })[0];
      if (task) openTaskForm(task);
    });
  });

  A.onAction('chat:status', function (payload) {
    return A.api('/api/admin/chat/tasks/' + encodeURIComponent(payload.id) + '/status', {
      method: 'POST',
      body: { status: payload.status }
    }).then(function () {
      A.toast('Task is now ' + payload.status + '.', 'success');
      A.refresh();
    });
  });

  A.onAction('chat:delete', function (payload) {
    return A.confirmDialog({
      title: 'Delete chat task',
      messageHtml: 'The task is removed from the user-facing list. Conversations and ledger entries already created for it are kept for audit purposes.',
      withReason: true,
      confirmLabel: 'Delete task',
      onConfirm: function (reason) {
        return A.api('/api/admin/chat/tasks/' + encodeURIComponent(payload.id), {
          method: 'DELETE',
          body: { reason: reason }
        }).then(function () {
          A.toast('Task deleted.', 'success');
          A.refresh();
        });
      }
    });
  });

  function openTaskForm(task) {
    var editing = !!task;
    var rules = (task && task.validationRules) || {};
    var scenario = (task && task.scenario) || {};

    var dialog = A.openModal({
      title: editing ? 'Edit chat task' : 'New chat task',
      width: 820,
      hideConfirm: true,
      body:
        '<form id="chatTaskForm" class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        (editing ? '<input type="hidden" name="taskId" value="' + esc(task.id) + '">' : '') +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctTitle', label: 'Title', value: task ? task.title : '', required: true, placeholder: 'e.g. Handle a billing enquiry' }) +
        '</div>' +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctDescription', label: 'Description', type: 'textarea', rows: 2, value: task ? task.description : '' }) +
        '</div>' +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctInstructions', label: 'Instructions for the user', type: 'textarea', rows: 3, value: task ? task.instructions : '' }) +
        '</div>' +
        ui.input({ name: 'ctCategory', label: 'Category', value: task ? task.category : 'customer_support' }) +
        ui.select({ name: 'ctDifficulty', label: 'Difficulty', value: task ? task.difficulty : 'standard', options: [
          { value: 'standard', label: 'Standard' },
          { value: 'easy', label: 'Easy' },
          { value: 'hard', label: 'Hard' }
        ] }) +
        ui.input({ name: 'ctReward', label: 'Reward (KES)', type: 'number', value: centsToInput(task ? task.rewardKES : 1000), required: true, attrs: 'step="0.01" min="0"', hint: 'Whole shillings. Stored as cents.' }) +
        ui.input({ name: 'ctMinutes', label: 'Estimated minutes', type: 'number', value: task ? task.estimatedMinutes : 5 }) +
        ui.input({ name: 'ctMax', label: 'Max completions', type: 'number', value: task && task.maxCompletions ? task.maxCompletions : 100, hint: '0 means unlimited.' }) +
        ui.select({ name: 'ctStatus', label: 'Status', value: task ? task.status : 'draft', options: TASK_STATUSES }) +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctOpening', label: 'Opening message', value: scenario.openingMessage || '', hint: 'The first message the simulated customer sends.' }) +
        '</div>' +
        ui.input({ name: 'ctMinMessages', label: 'Minimum messages', type: 'number', value: rules.minMessages === undefined ? 3 : rules.minMessages }) +
        ui.input({ name: 'ctMinDuration', label: 'Minimum seconds', type: 'number', value: rules.minDurationSeconds === undefined ? 45 : rules.minDurationSeconds }) +
        ui.input({ name: 'ctMinUser', label: 'Minimum user messages', type: 'number', value: rules.minUserMessages === undefined ? 2 : rules.minUserMessages }) +
        ui.input({ name: 'ctUnique', label: 'Minimum unique ratio (0-1)', type: 'number', value: rules.minUniqueRatio === undefined ? 0.6 : rules.minUniqueRatio, hint: 'Detects copy-pasted replies.' }) +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctTopics', label: 'Required topics', value: Array.isArray(rules.requiredTopics) ? rules.requiredTopics.join(', ') : '', hint: 'Comma separated. Each becomes a keyword the reply must cover.' }) +
        '</div>' +
        '<div class="sm:col-span-2">' +
        ui.input({ name: 'ctProhibited', label: 'Prohibited terms', value: Array.isArray(rules.prohibitedTerms) ? rules.prohibitedTerms.join(', ') : '', hint: 'Comma separated. A submission using any of these fails review.' }) +
        '</div>' +
        '<div class="sm:col-span-2 flex items-center gap-2">' +
        '<button type="submit" class="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25">' +
        '<i data-lucide="save" class="h-4 w-4" aria-hidden="true"></i>' + (editing ? 'Save changes' : 'Create task') + '</button>' +
        '<button type="button" data-action="chat:new-cancel" class="inline-flex h-10 items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 text-sm font-semibold text-[var(--text-secondary)]">Cancel</button>' +
        '</div></form>',
      onOpen: function (root) {
        if (window.lucide) lucide.createIcons();
        var cancelBtn = root.querySelector('[data-action="chat:new-cancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { dialog.close(); });
        var form = root.querySelector('#chatTaskForm');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var payload = {
            title: form.ctTitle.value.trim(),
            description: form.ctDescription.value,
            instructions: form.ctInstructions.value,
            category: form.ctCategory.value.trim(),
            difficulty: form.ctDifficulty.value,
            rewardKES: inputToCents(form.ctReward.value),
            estimatedMinutes: Number(form.ctMinutes.value) || 5,
            maxCompletions: Number(form.ctMax.value) || 0,
            status: form.ctStatus.value,
            scenario: form.ctOpening.value.trim() ? { openingMessage: form.ctOpening.value.trim() } : null,
            validationRules: {
              minMessages: Number(form.ctMinMessages.value) || 0,
              minDurationSeconds: Number(form.ctMinDuration.value) || 0,
              minUserMessages: Number(form.ctMinUser.value) || 0,
              minUniqueRatio: Number(form.ctUnique.value) || 0,
              requiredTopics: form.ctTopics.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
              prohibitedTerms: form.ctProhibited.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
            }
          };

          var request;
          if (editing) {
            request = A.api('/api/admin/chat/tasks/' + encodeURIComponent(task.id), { method: 'POST', body: payload });
          } else {
            request = A.api('/api/admin/chat/tasks', { method: 'POST', body: payload });
          }

          return request.then(function () {
            A.toast(editing ? 'Task updated.' : 'Task created.', 'success');
            dialog.close();
            A.refresh();
          }).catch(function (err) {
            A.toast((err && err.message) || 'Could not save the task.', 'error');
          });
        });
      }
    });
  }

  /* ============================================================
     Review queue
     ============================================================ */

  var subQuery = { page: 1, limit: 25, status: '', search: '' };

  A.registerPage({
    id: 'chat-submissions',
    title: 'Chat Submissions',
    subtitle: 'Review conversations, pay rewards and reverse mistakes',
    icon: 'message-square-check',
    group: 'modules',
    permissions: ['tasks.review'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Chat Submissions', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';

        var qs = '/api/admin/chat/submissions?page=' + subQuery.page + '&limit=' + subQuery.limit;
        if (subQuery.status) qs += '&status=' + encodeURIComponent(subQuery.status);
        if (subQuery.search) qs += '&search=' + encodeURIComponent(subQuery.search);

        return A.api(qs).then(function (data) {
          var rows = data.submissions || [];

          var columns = [
            { key: 'user', label: 'User', render: function (s) {
              var u = s.user || {};
              return '<div class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(u.username || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(u.email || '') + '</span></div>';
            } },
            { key: 'task', label: 'Task', render: function (s) {
              return '<div class="min-w-0"><span class="block text-sm truncate">' + esc((s.task && s.task.title) || '—') + '</span>' +
                '<span class="block text-xs text-[var(--text-muted)]">' + s.messageCount + ' msgs · ' + esc(duration(s.durationSeconds)) + '</span></div>';
            } },
            { key: 'status', label: 'Status', render: function (s) {
              return A.statusBadge(String(s.status || '').toLowerCase()) +
                (s.validationStatus ? ' ' + A.statusBadge(String(s.validationStatus).toLowerCase()) : '') +
                (s.flags && s.flags.length ? ' ' + A.severityBadge('high') : '');
            } },
            { key: 'reward', label: 'Reward', align: true, render: function (s) {
              return '<span class="font-display font-semibold text-white">' + money(s.task && s.task.rewardKES) + '</span>';
            } },
            { key: 'submittedAt', label: 'Submitted', render: function (s) {
              return '<span class="text-xs">' + esc(s.submittedAt ? A.timeAgo(s.submittedAt) : '—') + '</span>';
            } },
            { key: 'actions', label: '', align: true, render: function (s) {
              return ui.button({ action: 'chat:review', label: 'Review', icon: 'eye', variant: 'ghost', data: { id: s.id } });
            } }
          ];

          container.innerHTML =
            ui.pageHeader('Chat Submissions', A.formatNumber(data.total) + ' submission' + (data.total === 1 ? '' : 's'),
              ui.button({ action: 'chat-subs:refresh', label: 'Refresh', icon: 'refresh-cw', variant: 'ghost' })) +
            '<div class="card mb-4"><form data-sub-filter class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">' +
            ui.select({ name: 'subStatus', label: 'Status', value: subQuery.status, options: [
              { value: '', label: 'All statuses' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'under_review', label: 'Under review' },
              { value: 'rewarded', label: 'Rewarded' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'reversed', label: 'Reversed' },
              { value: 'expired', label: 'Expired' }
            ] }) +
            ui.input({ name: 'subSearch', label: 'Search', value: subQuery.search, placeholder: 'username or email' }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)]">Filter</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, rows, 'No submissions match this filter.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-sub-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              subQuery.status = form.subStatus.value;
              subQuery.search = form.subSearch.value.trim();
              subQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { subQuery.page = Math.max(1, subQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { subQuery.page = subQuery.page + 1; load(); });
          A.bindActions(container);
          if (window.lucide) lucide.createIcons();
        }).catch(function (err) {
          container.innerHTML = ui.pageHeader('Chat Submissions', null, '') +
            ui.errorState(err && err.message, 'chat-subs:refresh');
          A.bindActions(container);
        });
      }
      return load();
    }
  });

  A.onAction('chat-subs:refresh', function () { A.refresh(); });

  A.onAction('chat:review', function (payload) {
    return A.api('/api/admin/chat/submissions/' + encodeURIComponent(payload.id)).then(function (data) {
      var s = data.submission;
      var u = s.user || {};
      var v = s.validation || {};

      var facts = [
        ['User', (u.username || '') + ' · ' + (u.email || '')],
        ['Task', (s.task && s.task.title) || '—'],
        ['Task reward', money(s.task && s.task.rewardKES)],
        ['Status', s.status + (s.validationStatus ? ' · validation ' + s.validationStatus : '')],
        ['Messages', s.messageCount + ' · ' + duration(s.durationSeconds) + ' · attempt ' + s.attemptNumber],
        ['Submitted', s.submittedAt ? A.formatDate(s.submittedAt) : '—'],
        ['Reviewed', s.reviewedAt ? A.formatDate(s.reviewedAt) : '—'],
        ['Earning', s.earning ? s.earning.status + ' · ' + money(s.earning.earnHubReward) : 'None yet'],
        ['IP', s.ipAddress || '—']
      ].map(function (r) {
        return '<div class="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-primary)] last:border-0">' +
          '<span class="text-xs uppercase tracking-wide text-[var(--text-muted)] shrink-0">' + esc(r[0]) + '</span>' +
          '<span class="text-sm text-[var(--text-primary)] text-right break-all">' + esc(r[1]) + '</span></div>';
      }).join('');

      // The internal scoring detail is exactly what a reviewer needs, and is
      // only ever returned by the admin-gated endpoint.
      var checks = (v.checks || []).map(function (c) {
        var ok = c.passed !== false;
        return '<div class="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--border-primary)] last:border-0">' +
          '<span class="text-sm text-[var(--text-primary)]">' + esc(c.label || c.key) + '</span>' +
          '<span class="text-xs font-semibold" style="color:' + (ok ? 'var(--accent-emerald)' : 'var(--accent-red)') + '">' +
          (ok ? 'pass' : 'fail') + '</span></div>';
      }).join('');

      var transcript = (s.messages || []).map(function (m) {
        var mine = m.senderType === 'user';
        return '<div class="flex ' + (mine ? 'justify-end' : 'justify-start') + ' mb-2">' +
          '<div class="max-w-[85%] rounded-lg border px-3 py-2 text-sm ' +
          (mine ? 'bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)]/25' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]') + '">' +
          '<div class="whitespace-pre-wrap break-words">' + esc(m.message) + '</div>' +
          '<div class="mt-1 text-right text-[10px] text-[var(--text-muted)]">' + esc(A.formatDate(m.createdAt)) + '</div></div></div>';
      }).join('');

      var actions = '';
      var canApprove = ['submitted', 'under_review'].indexOf(s.status) !== -1;
      var canReverse = s.earning && !s.earning.reversedAt && s.earning.status === 'APPROVED';

      if (canApprove) {
        actions += ui.button({ action: 'chat:approve', label: 'Approve and pay', icon: 'check', variant: 'primary', data: { id: s.id } });
        actions += ui.button({ action: 'chat:reject', label: 'Reject', icon: 'x', variant: 'danger', data: { id: s.id } });
      }
      if (canReverse) {
        actions += ui.button({ action: 'chat:reverse', label: 'Reverse reward', icon: 'undo-2', variant: 'danger', data: { id: s.id } });
      }

      reviewDialog = A.openModal({
        title: 'Review chat submission',
        width: 860,
        hideConfirm: true,
        body:
          '<div class="rounded-xl border border-[var(--border-primary)]">' + facts + '</div>' +
          (s.task && s.task.instructions
            ? '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Task instructions</p>' +
              '<p class="text-sm text-[var(--text-secondary)]">' + esc(s.task.instructions) + '</p></div>'
            : '') +
          (checks
            ? '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Automated checks</p>' +
              '<div class="rounded-xl border border-[var(--border-primary)]">' + checks + '</div></div>'
            : '') +
          '<div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Transcript</p>' +
          '<div class="max-h-80 overflow-y-auto main-scrollbar rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">' +
          (transcript || '<p class="text-sm text-[var(--text-muted)]">No messages.</p>') + '</div></div>' +
          (actions ? '<div class="flex flex-wrap gap-2 mt-5">' + actions + '</div>'
                   : '<p class="mt-5 text-sm text-[var(--text-muted)]">This submission is closed and has no further actions.</p>')
      });
    });
  });

  // The review modal stays open behind the confirm dialog, so hold on to it
  // and close it once the action succeeds, returning the reviewer to the queue.
  var reviewDialog = null;

  function review(id, action, opts) {
    return A.confirmDialog({
      title: opts.title,
      messageHtml: opts.messageHtml,
      withReason: true,
      confirmLabel: opts.confirmLabel,
      onConfirm: function (reason) {
        if (opts.requireReason && !reason) {
          A.toast('A reason is required.', 'error');
          return false;
        }
        return A.api('/api/admin/chat/submissions/' + encodeURIComponent(id) + '/review', {
          method: 'POST',
          body: { action: action, reason: reason }
        }).then(function (res) {
          // The backend is idempotent, so a double click can never pay twice.
          if (res && res.alreadyApproved) {
            A.toast('Already approved. No second payment was made.', 'warn');
          } else {
            A.toast(opts.successMessage, 'success');
          }
          if (reviewDialog) {
            reviewDialog.close();
            reviewDialog = null;
          }
          A.refresh();
        }).catch(function (err) {
          A.toast((err && err.message) || 'The review action failed.', 'error');
          return false;
        });
      }
    });
  }

  A.onAction('chat:approve', function (payload) {
    return review(payload.id, 'approve', {
      title: 'Approve chat submission',
      messageHtml: 'The reward is credited to the user wallet and a ledger entry is written. Approving twice is safe: the second attempt is ignored rather than paying again.',
      confirmLabel: 'Approve and pay',
      successMessage: 'Submission approved and wallet credited.'
    });
  });

  A.onAction('chat:reject', function (payload) {
    return review(payload.id, 'reject', {
      title: 'Reject chat submission',
      messageHtml: 'No wallet movement happens. The user sees your reason so they know what to improve.',
      confirmLabel: 'Reject submission',
      requireReason: true,
      successMessage: 'Submission rejected.'
    });
  });

  A.onAction('chat:reverse', function (payload) {
    return review(payload.id, 'reverse', {
      title: 'Reverse chat reward',
      messageHtml: 'A compensating transaction is created, the user wallet is debited and a ledger entry is written. The original earning is preserved for audit.',
      confirmLabel: 'Reverse reward',
      requireReason: true,
      successMessage: 'Reward reversed with a compensating entry.'
    });
  });
})();
