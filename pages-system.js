/* ================================================================
   EarnHub Admin - Platform and security pages
   Providers, risk, admins, roles, settings, audit log, system health.
   ================================================================ */

(function () {
  'use strict';

  var A = window.AdminApp;
  var ui = A.ui;
  var esc = A.esc;

  /* ============================================================
     Providers
     ============================================================ */

  A.registerPage({
    id: 'providers',
    title: 'Providers',
    subtitle: 'External provider configuration and callback events',
    icon: 'plug',
    group: 'platform',
    permissions: ['providers.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Providers', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        return Promise.all([
          A.api('/api/admin/providers/configs'),
          A.api('/api/admin/providers/events?limit=25')
        ]).then(function (results) {
          var configs = results[0].configs || [];
          var events = results[1].events || [];
          var canManage = A.hasPermission('providers.manage');

          container.innerHTML =
            ui.pageHeader('Providers', configs.length + ' provider' + (configs.length === 1 ? '' : 's') + ' configured',
              canManage ? ui.button({ action: 'providers:edit', label: 'Configure', icon: 'settings-2', variant: 'ghost' }) : '') +
            '<div class="space-y-4">' +
            ui.card(ui.sectionTitle('Provider configuration', 'Credentials are stored server-side and never sent to this panel') +
              (configs.length
                ? '<div class="space-y-3">' + configs.map(function (c) {
                  return (
                    '<div class="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">' +
                    '<div class="flex flex-wrap items-center justify-between gap-3">' +
                    '<div class="min-w-0"><p class="font-display font-bold text-white truncate">' + esc(c.displayName) + '</p>' +
                    '<p class="text-xs text-[var(--text-muted)] font-mono">' + esc(c.providerKey) + ' → ' + esc(c.moduleKey) + '</p></div>' +
                    '<div class="flex items-center gap-2">' +
                    A.statusBadge(c.enabled ? 'active' : 'disabled') +
                    '<span class="text-xs ' + (c.credentials ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-amber)]') + '">' +
                    esc(c.credentials || 'no credentials') + '</span>' +
                    '</div></div>' +
                    '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-[var(--text-muted)]">' +
                    '<span>Errors: ' + A.formatNumber(c.errorCount || 0) + '</span>' +
                    '<span>Last success: ' + esc(A.timeAgo(c.lastSuccessfulRequest)) + '</span>' +
                    '<span>Last failure: ' + esc(A.timeAgo(c.lastFailedRequest)) + '</span>' +
                    '<span>Updated: ' + esc(A.timeAgo(c.updatedAt)) + '</span>' +
                    '</div></div>'
                  );
                }).join('') + '</div>'
                : ui.empty('No providers configured yet.', 'plug'))) +
            ui.card(ui.sectionTitle('Recent callback events', 'Webhook deliveries received from providers') +
              ui.tableWrapper([
                { key: 'providerKey', label: 'Provider', render: function (e) { return '<span class="text-xs">' + esc(e.providerKey) + '</span>'; } },
                { key: 'eventType', label: 'Event', render: function (e) { return '<span class="text-xs">' + esc(e.eventType) + '</span>'; } },
                { key: 'processingStatus', label: 'Status', render: function (e) { return A.statusBadge(e.processingStatus); } },
                { key: 'signatureValid', label: 'Signature', render: function (e) {
                  if (e.signatureValid === null || e.signatureValid === undefined) return '<span class="text-[var(--text-muted)]">—</span>';
                  return e.signatureValid ? A.statusBadge('valid') : A.statusBadge('invalid');
                } },
                { key: 'error', label: 'Error', render: function (e) { return '<span class="text-xs text-red-400">' + esc(A.truncate(e.error, 40) || '—') + '</span>'; } },
                { key: 'receivedAt', label: 'Received', render: function (e) { return '<span class="text-xs">' + esc(A.timeAgo(e.receivedAt)) + '</span>'; } }
              ], events, 'No provider events received.')) +
            '</div>';
        });
      }
      return load();
    }
  });

  A.onAction('providers:edit', function () {
    return A.api('/api/admin/providers/configs').then(function (data) {
      var configs = data.configs || [];
      A.openModal({
        title: 'Provider configuration',
        confirmLabel: 'Save provider',
        body:
          '<p class="text-sm text-[var(--text-secondary)] mb-4">Credentials are persisted server-side. Leave the credentials field blank to keep the existing value.</p>' +
          '<div class="space-y-3">' +
          ui.select({ name: 'providerKey', label: 'Existing provider', value: configs.length ? configs[0].providerKey : '', options: configs.length
            ? configs.map(function (c) { return { value: c.providerKey, label: c.providerKey + ' (' + c.displayName + ')' }; })
            : [{ value: '__new__', label: 'Create new provider' }] }) +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          ui.input({ name: 'moduleKey', label: 'Module key', value: configs.length ? configs[0].moduleKey : '', attrs: 'autofocus' }) +
          ui.input({ name: 'displayName', label: 'Display name', value: configs.length ? configs[0].displayName : '' }) +
          '</div>' +
          ui.select({ name: 'enabled', label: 'State', value: configs.length ? (configs[0].enabled ? 'true' : 'false') : 'true', options: [
            { value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }
          ] }) +
          ui.input({ name: 'credentials', label: 'Credentials (JSON)', type: 'textarea', rows: 3, placeholder: '{ "apiKey": "…" }' }) +
          ui.input({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, required: true }) +
          '</div>',
        onConfirm: function (modal) {
          var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
          var providerKey = get('providerKey');
          if (!providerKey || providerKey === '__new__') {
            A.toast('Select an existing provider or extend the server endpoint for new ones.', 'error');
            return false;
          }
          if (!get('reason')) { A.toast('A reason is required.', 'error'); return false; }
          var body = {
            providerKey: providerKey,
            moduleKey: get('moduleKey'),
            displayName: get('displayName'),
            enabled: get('enabled') === 'true'
          };
          if (get('credentials')) {
            try {
              body.credentials = JSON.parse(get('credentials'));
            } catch (err) {
              A.toast('Credentials must be valid JSON.', 'error');
              return false;
            }
          }
          return A.api('/api/admin/providers/configs', { method: 'POST', body: body }).then(function () {
            A.toast('Provider configuration saved.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  /* ============================================================
     Risk events
     ============================================================ */

  var riskFilter = 'false';

  A.registerPage({
    id: 'risk',
    title: 'Risk Events',
    subtitle: 'Fraud and abuse signals',
    icon: 'shield-alert',
    group: 'security',
    permissions: ['fraud.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Risk Events', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        return A.api('/api/admin/risk/events?resolved=' + riskFilter).then(function (data) {
          var events = data.events || [];
          container.innerHTML =
            ui.pageHeader('Risk Events', events.length + ' event' + (events.length === 1 ? '' : 's')) +
            '<div class="card mb-4"><div class="flex flex-wrap gap-2">' +
            [['false', 'Unresolved'], ['true', 'Resolved'], ['', 'All']].map(function (pair) {
              var active = riskFilter === pair[0];
              return '<button type="button" data-risk-filter="' + esc(pair[0]) + '" class="h-9 rounded-lg px-3 text-xs font-semibold border transition-colors ' +
                (active ? 'border-[var(--accent-emerald)]/40 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]') + '">' +
                esc(pair[1]) + '</button>';
            }).join('') +
            '</div></div>' +
            ui.tableWrapper([
              { key: 'type', label: 'Type', render: function (e) { return '<span class="text-sm text-white">' + esc(e.type) + '</span>'; } },
              { key: 'severity', label: 'Severity', render: function (e) { return A.severityBadge(e.severity); } },
              { key: 'source', label: 'Source', render: function (e) { return '<span class="text-xs">' + esc(e.source) + '</span>'; } },
              { key: 'user', label: 'User', render: function (e) {
                var u = e.user || {};
                return '<span class="text-xs">' + esc(u.username || u.email || e.userId || 'System') + '</span>';
              } },
              { key: 'resolved', label: 'State', render: function (e) { return A.statusBadge(e.resolved ? 'resolved' : 'open'); } },
              { key: 'createdAt', label: 'Detected', render: function (e) { return '<span class="text-xs">' + esc(A.timeAgo(e.createdAt)) + '</span>'; } },
              { key: 'actions', label: '', align: true, render: function (e) {
                return ui.button({ action: 'risk:view', label: 'Details', icon: 'eye', variant: 'ghost', data: { id: e.id } });
              } }
            ], events, 'No risk events recorded.');

          Array.prototype.forEach.call(container.querySelectorAll('[data-risk-filter]'), function (btn) {
            btn.addEventListener('click', function () {
              riskFilter = btn.getAttribute('data-risk-filter');
              load();
            });
          });
        });
      }
      return load();
    }
  });

  A.onAction('risk:view', function (payload) {
    return A.api('/api/admin/risk/events?resolved=').then(function (data) {
      var event = (data.events || []).filter(function (e) { return e.id === payload.id; })[0];
      if (!event) { A.toast('Risk event not found.', 'error'); return; }
      A.openModal({
        title: event.type + ' · ' + event.severity,
        hideConfirm: true,
        body:
          '<div class="space-y-3 text-sm">' +
          '<div class="flex items-center justify-between gap-3"><span class="text-[var(--text-muted)]">Source</span><span class="text-white">' + esc(event.source) + '</span></div>' +
          '<div class="flex items-center justify-between gap-3"><span class="text-[var(--text-muted)]">User</span><span class="text-white">' + esc((event.user && event.user.email) || event.userId || 'System') + '</span></div>' +
          '<div class="flex items-center justify-between gap-3"><span class="text-[var(--text-muted)]">Detected</span><span class="text-white">' + esc(A.formatDate(event.createdAt)) + '</span></div>' +
          '<div class="flex items-center justify-between gap-3"><span class="text-[var(--text-muted)]">Resolved</span><span>' + A.statusBadge(event.resolved ? 'resolved' : 'open') + '</span></div>' +
          '</div>' +
          '<pre class="mt-4 max-h-60 overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">' +
          esc(JSON.stringify(event.detail, null, 2)) + '</pre>'
      });
    });
  });

  /* ============================================================
     System health
     ============================================================ */

  A.registerPage({
    id: 'system',
    title: 'System Health',
    subtitle: 'Integration configuration status',
    icon: 'activity',
    group: 'platform',
    permissions: ['system_health.view'],
    render: function (container) {
      return A.api('/api/admin/system/health').then(function (data) {
        var checks = data.checks || [];
        var tone = { online: 'var(--accent-emerald)', configured: 'var(--accent-emerald)', offline: 'var(--accent-red)', not_configured: 'var(--accent-amber)' };
        container.innerHTML =
          ui.pageHeader('System Health', 'Runtime integration status',
            ui.button({ action: 'page:retry', label: 'Re-check', icon: 'refresh-cw', variant: 'ghost' })) +
          (checks.length
            ? '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + checks.map(function (c) {
              var color = tone[c.status] || 'var(--text-muted)';
              return (
                '<div class="card flex items-start gap-4">' +
                '<span class="shrink-0 flex items-center justify-center rounded-xl" style="width:40px;height:40px;background:' + color + '22;color:' + color + '">' +
                '<i data-lucide="server" class="h-5 w-5" aria-hidden="true"></i></span>' +
                '<div class="min-w-0"><p class="font-display font-bold text-white">' + esc(c.component) + '</p>' +
                '<p class="text-sm text-[var(--text-secondary)] mt-0.5 break-words">' + esc(c.message) + '</p>' +
                '<p class="mt-2">' + A.statusBadge(c.status) + '</p></div>' +
                '</div>'
              );
            }).join('') + '</div>'
            : ui.card(ui.empty('No health checks reported.', 'activity')));
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  /* ============================================================
     Admin users
     ============================================================ */

  A.registerPage({
    id: 'admins',
    title: 'Admin Users',
    subtitle: 'Staff accounts and assigned roles',
    icon: 'user-cog',
    group: 'security',
    permissions: ['admins.view'],
    render: function (container) {
      return A.api('/api/admin/admins').then(function (data) {
        var admins = data.admins || [];
        var roles = data.roles || [];
        var canManage = A.hasPermission('admins.manage');

        var columns = [
          { key: 'username', label: 'Admin', render: function (a) {
            var u = A.state.user || {};
            var self = a.id === u.id;
            return '<div class="flex items-center gap-3 min-w-0">' +
              '<span class="shrink-0 flex items-center justify-center rounded-lg font-bold text-slate-950" style="width:32px;height:32px;background:linear-gradient(135deg,var(--accent-emerald),var(--accent-teal))">' +
              esc((a.username || '?').charAt(0).toUpperCase()) + '</span>' +
              '<span class="min-w-0"><span class="block text-white font-semibold truncate">' + esc(a.username) + (self ? ' <span class="text-[10px] text-[var(--accent-emerald)]">you</span>' : '') + '</span>' +
              '<span class="block text-xs text-[var(--text-muted)] truncate">' + esc(a.email) + '</span></span></div>';
          } },
          { key: 'role', label: 'Role', render: function (a) {
            return '<span class="text-xs text-white">' + esc((a.role && a.role.name) || '—') + '</span>';
          } },
          { key: 'isActive', label: 'Status', render: function (a) { return A.statusBadge(a.isActive ? 'active' : 'suspended'); } },
          { key: 'twoFAEnabled', label: '2FA', render: function (a) { return a.twoFAEnabled ? A.statusBadge('enabled') : '<span class="text-[var(--text-muted)]">—</span>'; } },
          { key: 'lastLoginAt', label: 'Last login', render: function (a) { return '<span class="text-xs">' + esc(A.timeAgo(a.lastLoginAt)) + '</span>'; } },
          { key: 'actions', label: '', align: true, render: function (a) {
            if (!canManage) return '';
            return (
              ui.button({ action: 'admins:role', label: 'Role', icon: 'key-round', variant: 'ghost', data: { id: a.id, name: a.username } }) +
              ui.button({ action: 'admins:toggle', label: a.isActive ? 'Suspend' : 'Enable', icon: a.isActive ? 'ban' : 'rotate-ccw', variant: a.isActive ? 'danger' : 'ghost', data: { id: a.id, name: a.username } })
            );
          } }
        ];

        container.innerHTML =
          ui.pageHeader('Admin Users', admins.length + ' admin account' + (admins.length === 1 ? '' : 's'),
            canManage ? ui.button({ action: 'admins:new', label: 'New admin', icon: 'user-plus', variant: 'primary' }) : '') +
          ui.tableWrapper(columns, admins, 'No admin accounts yet.') +
          (canManage ? '' : '<p class="text-xs text-[var(--text-muted)] mt-3">You have read-only access to admin accounts.</p>');
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();

        if (canManage) {
          A.state.cachedRoles = roles;
        }
      });
    }
  });

  A.onAction('admins:new', function () {
    return A.api('/api/admin/admins').then(function (data) {
      var roles = data.roles || [];
      A.openModal({
        title: 'Create admin account',
        confirmLabel: 'Create admin',
        body:
          '<div class="space-y-3">' +
          ui.input({ name: 'name', label: 'Full name', attrs: 'autofocus' }) +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          ui.input({ name: 'email', label: 'Email', type: 'email', required: true }) +
          ui.input({ name: 'username', label: 'Username', required: true }) +
          '</div>' +
          ui.input({ name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'At least 8 characters' }) +
          ui.select({ name: 'roleId', label: 'Role', value: roles.length ? roles[0].id : '', options: roles.map(function (r) {
            return { value: r.id, label: r.name + (r.description ? ' — ' + r.description : '') };
          }) }) +
          '</div>',
        onConfirm: function (modal) {
          var get = function (n) { return modal.querySelector('[name="' + n + '"]').value.trim(); };
          if (!get('email') || !get('username') || !get('password')) { A.toast('Email, username and password are required.', 'error'); return false; }
          return A.api('/api/admin/admins', {
            method: 'POST',
            body: {
              email: get('email'),
              username: get('username'),
              name: get('name') || null,
              password: get('password'),
              roleId: get('roleId')
            }
          }).then(function () {
            A.toast('Admin account created.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('admins:role', function (payload) {
    return A.api('/api/admin/admins').then(function (data) {
      var roles = data.roles || [];
      A.openModal({
        title: 'Change role — ' + payload.name,
        confirmLabel: 'Update role',
        body:
          ui.select({ name: 'roleId', label: 'Role', value: roles.length ? roles[0].id : '', options: roles.map(function (r) {
            return { value: r.id, label: r.name + ' — ' + (r.description || '') };
          }) }) +
          '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, required: true }) + '</div>',
        onConfirm: function (modal) {
          var roleId = modal.querySelector('[name="roleId"]').value;
          var reason = modal.querySelector('[name="reason"]').value.trim();
          if (!reason) { A.toast('A reason is required.', 'error'); return false; }
          return A.api('/api/admin/admins/' + encodeURIComponent(payload.id) + '/role', {
            method: 'POST', body: { roleId: roleId, reason: reason }
          }).then(function (result) {
            A.toast('Role updated to ' + result.role + '.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('admins:toggle', function (payload) {
    return A.confirmDialog({
      title: 'Change admin status',
      messageHtml: 'Toggle the active state of <strong>' + esc(payload.name) + '</strong>. Suspending an admin invalidates their access immediately.',
      withReason: true,
      confirmLabel: 'Apply',
      onConfirm: function (reason) {
        return A.api('/api/admin/admins/' + encodeURIComponent(payload.id) + '/suspend', {
          method: 'POST', body: { reason: reason }
        }).then(function (result) {
          A.toast(result.isActive ? 'Admin enabled.' : 'Admin suspended.', 'success');
          A.refresh();
        });
      }
    });
  });

  /* ============================================================
     Roles and permissions
     ============================================================ */

  A.registerPage({
    id: 'roles',
    title: 'Roles & Permissions',
    subtitle: 'Role definitions and permission grants',
    icon: 'key-round',
    group: 'security',
    permissions: ['admins.view'],
    render: function (container) {
      return A.api('/api/admin/roles').then(function (data) {
        var roles = data.roles || [];
        var permissions = data.permissions || [];
        var canManage = A.hasPermission('admins.manage');

        var byCategory = {};
        permissions.forEach(function (p) {
          if (!byCategory[p.category]) byCategory[p.category] = [];
          byCategory[p.category].push(p);
        });

        var roleCards = roles.map(function (role) {
          var keys = (role.permissions || []).map(function (rp) { return rp.permission.key; });
          return (
            '<div class="card">' +
            '<div class="flex items-start justify-between gap-3">' +
            '<div class="min-w-0"><h3 class="font-display font-bold text-white truncate">' + esc(role.name) + '</h3>' +
            '<p class="text-xs text-[var(--text-muted)] mt-1">' + esc(role.description || 'No description') + '</p></div>' +
            '<div class="shrink-0 flex flex-col items-end gap-1">' + A.statusBadge(role.isSystem ? 'system' : 'custom') +
            '<span class="text-xs text-[var(--text-muted)]">' + keys.length + ' permissions</span></div>' +
            '</div>' +
            '<div class="flex flex-wrap gap-1.5 mt-4">' + keys.slice(0, 8).map(function (k) {
              return '<span class="rounded-md bg-[var(--bg-tertiary)] px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)]">' + esc(k) + '</span>';
            }).join('') + (keys.length > 8 ? '<span class="rounded-md bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] text-[var(--text-muted)]">+' + (keys.length - 8) + ' more</span>' : '') + '</div>' +
            (canManage
              ? '<div class="mt-4 pt-4 border-t border-[var(--border-primary)] flex flex-wrap gap-2">' +
                ui.button({ action: 'roles:permissions', label: 'Permissions', icon: 'sliders-horizontal', variant: 'ghost', data: { id: role.id, name: role.name } }) +
                (!role.isSystem ? ui.button({ action: 'roles:delete-info', label: 'System role', icon: 'lock', variant: 'subtle' }) : '') +
                '</div>'
              : '') +
            '</div>'
          );
        }).join('');

        container.innerHTML =
          ui.pageHeader('Roles & Permissions', roles.length + ' role' + (roles.length === 1 ? '' : 's'),
            canManage ? ui.button({ action: 'roles:new', label: 'New role', icon: 'plus', variant: 'primary' }) : '') +
          (roleCards
            ? '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">' + roleCards + '</div>'
            : ui.card(ui.empty('No roles defined.', 'key-round')));
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  function permissionEditor(modal, permissions, selected) {
    var byCategory = {};
    permissions.forEach(function (p) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });
    return Object.keys(byCategory).map(function (category) {
      return (
        '<fieldset class="mb-4 last:mb-0">' +
        '<legend class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">' + esc(category) + '</legend>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        byCategory[category].map(function (p) {
          var checked = selected.indexOf(p.key) > -1 ? ' checked' : '';
          return (
            '<label class="flex items-start gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 cursor-pointer hover:border-[var(--accent-emerald)]/30 transition-colors">' +
            '<input type="checkbox" name="perm" value="' + esc(p.key) + '"' + checked + ' class="mt-0.5 accent-emerald-500" />' +
            '<span class="min-w-0"><span class="block text-sm text-white">' + esc(p.name) + '</span>' +
            '<span class="block font-mono text-[10px] text-[var(--text-muted)]">' + esc(p.key) + '</span></span></label>'
          );
        }).join('') +
        '</div></fieldset>'
      );
    }).join('');
  }

  function selectedPermissions(modal) {
    return Array.prototype.filter
      .call(modal.querySelectorAll('[name="perm"]:checked'), function (cb) { return true; })
      .map(function (cb) { return cb.value; });
  }

  A.onAction('roles:new', function () {
    return A.api('/api/admin/roles').then(function (data) {
      A.openModal({
        title: 'Create role',
        confirmLabel: 'Create role',
        body:
          '<div class="space-y-4">' +
          ui.input({ name: 'name', label: 'Role name', required: true, attrs: 'autofocus' }) +
          ui.input({ name: 'description', label: 'Description', type: 'textarea', rows: 2 }) +
          '<div><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Permissions</p>' +
          permissionEditor(null, data.permissions || [], []) + '</div></div>',
        onConfirm: function (modal) {
          var name = modal.querySelector('[name="name"]').value.trim();
          if (!name) { A.toast('Role name is required.', 'error'); return false; }
          return A.api('/api/admin/roles', {
            method: 'POST',
            body: {
              name: name,
              description: modal.querySelector('[name="description"]').value.trim() || null,
              permissionKeys: selectedPermissions(modal)
            }
          }).then(function () {
            A.toast('Role created.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  A.onAction('roles:permissions', function (payload) {
    return A.api('/api/admin/roles').then(function (data) {
      var role = (data.roles || []).filter(function (r) { return r.id === payload.id; })[0];
      if (!role) { A.toast('Role not found.', 'error'); return; }
      var selected = (role.permissions || []).map(function (rp) { return rp.permission.key; });
      A.openModal({
        title: 'Permissions — ' + role.name,
        confirmLabel: 'Save permissions',
        body:
          '<div class="mb-4 flex items-center justify-between gap-3">' +
          '<p class="text-sm text-[var(--text-secondary)]">Changes apply the next time an admin with this role signs in.</p>' +
          '<button type="button" data-select-all class="text-xs font-semibold text-[var(--accent-emerald)] hover:underline">Select all</button>' +
          '</div>' +
          permissionEditor(null, data.permissions || [], selected),
        onOpen: function (modal) {
          var selectAll = modal.querySelector('[data-select-all]');
          if (selectAll) {
            selectAll.addEventListener('click', function () {
              Array.prototype.forEach.call(modal.querySelectorAll('[name="perm"]'), function (cb) { cb.checked = true; });
            });
          }
        },
        onConfirm: function (modal) {
          return A.api('/api/admin/roles/' + encodeURIComponent(payload.id) + '/permissions', {
            method: 'POST', body: { permissionKeys: selectedPermissions(modal) }
          }).then(function () {
            A.toast('Permissions updated.', 'success');
            A.refresh();
          });
        }
      });
    });
  });

  /* ============================================================
     Platform settings
     ============================================================ */

  A.registerPage({
    id: 'settings',
    title: 'Platform Settings',
    subtitle: 'Database-backed configuration with change history',
    icon: 'settings',
    group: 'platform',
    permissions: ['settings.view'],
    render: function (container) {
      return A.api('/api/admin/settings').then(function (data) {
        var settings = data.settings || [];
        var canManage = A.hasPermission('settings.manage');
        var byCategory = {};
        settings.forEach(function (s) {
          if (!byCategory[s.category]) byCategory[s.category] = [];
          byCategory[s.category].push(s);
        });
        var categories = Object.keys(byCategory);

        container.innerHTML =
          ui.pageHeader('Platform Settings', settings.length + ' setting' + (settings.length === 1 ? '' : 's')) +
          '<div class="space-y-4">' +
          categories.map(function (category) {
            return ui.card(
              ui.sectionTitle(category.charAt(0).toUpperCase() + category.slice(1), byCategory[category].length + ' entries') +
              '<div class="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)]">' +
              byCategory[category].map(function (s) {
                return (
                  '<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">' +
                  '<div class="min-w-0"><p class="text-sm text-white font-mono truncate">' + esc(s.key) + '</p>' +
                  (s.description ? '<p class="text-xs text-[var(--text-muted)] truncate">' + esc(s.description) + '</p>' : '') + '</div>' +
                  '<div class="flex items-center gap-2">' +
                  '<span class="text-xs rounded-md bg-[var(--bg-tertiary)] px-2 py-1 text-[var(--text-secondary)] font-mono">' + esc(s.value === null || s.value === undefined ? 'null' : s.value) + '</span>' +
                  '<span class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">' + esc(s.type) + '</span>' +
                  (canManage ? ui.button({ action: 'settings:edit', label: 'Edit', icon: 'pencil', variant: 'ghost', data: { key: s.key, type: s.type, value: s.value === null ? '' : s.value } }) : '') +
                  ui.button({ action: 'settings:history', label: 'History', icon: 'history', variant: 'subtle', data: { key: s.key } }) +
                  '</div></div>'
                );
              }).join('') + '</div>'
            );
          }).join('') +
          (categories.length ? '' : ui.card(ui.empty('No settings stored in the database yet.', 'settings'))) +
          '</div>';
        A.bindActions(container);
        if (window.lucide) lucide.createIcons();
      });
    }
  });

  A.onAction('settings:edit', function (payload) {
    A.openModal({
      title: 'Edit setting — ' + payload.key,
      confirmLabel: 'Save setting',
      body:
        '<p class="text-sm text-[var(--text-secondary)] mb-4">Current type: <code>' + esc(payload.type) + '</code>. Values are stored as strings and parsed according to the type.</p>' +
        ui.input({ name: 'value', label: 'Value', value: payload.value, attrs: 'autofocus' }) +
        '<div class="mt-3">' + ui.input({ name: 'reason', label: 'Reason', type: 'textarea', rows: 2, required: true }) + '</div>',
      onConfirm: function (modal) {
        var value = modal.querySelector('[name="value"]').value;
        var reason = modal.querySelector('[name="reason"]').value.trim();
        if (!reason) { A.toast('A reason is required.', 'error'); return false; }
        return A.api('/api/admin/settings/' + encodeURIComponent(payload.key), {
          method: 'POST',
          body: { value: value, type: payload.type, reason: reason }
        }).then(function () {
          A.toast('Setting saved.', 'success');
          A.refresh();
        });
      }
    });
  });

  A.onAction('settings:history', function (payload) {
    return A.api('/api/admin/settings/' + encodeURIComponent(payload.key) + '/history').then(function (data) {
      var history = data.history || [];
      A.openModal({
        title: 'History — ' + payload.key,
        hideConfirm: true,
        body: history.length
          ? '<ul class="divide-y divide-[var(--border-primary)] rounded-xl border border-[var(--border-primary)]">' +
            history.map(function (h) {
              return '<li class="px-4 py-3">' +
                '<div class="flex items-center justify-between gap-3"><span class="text-sm text-white font-mono">' + esc(h.value === null ? 'null' : h.value) + '</span>' +
                '<span class="text-xs text-[var(--text-muted)]">' + esc(A.formatDate(h.createdAt)) + '</span></div>' +
                (h.reason ? '<p class="text-xs text-[var(--text-secondary)] mt-1">' + esc(h.reason) + '</p>' : '') +
                '</li>';
            }).join('') + '</ul>'
          : ui.empty('No changes recorded for this setting.', 'history')
      });
    });
  });

  /* ============================================================
     Audit log
     ============================================================ */

  var auditQuery = { page: 1, limit: 25, action: '' };

  A.registerPage({
    id: 'audit',
    title: 'Audit Log',
    subtitle: 'Every administrative action on the platform',
    icon: 'scroll-text',
    group: 'security',
    permissions: ['audit.view'],
    render: function (container) {
      function load() {
        container.innerHTML = ui.pageHeader('Audit Log', 'Loading', '') + '<div class="card">' + ui.skeleton(5) + '</div>';
        var query = '/api/admin/audit-logs?page=' + auditQuery.page + '&limit=' + auditQuery.limit +
          (auditQuery.action ? '&action=' + encodeURIComponent(auditQuery.action) : '');
        return A.api(query).then(function (data) {
          var columns = [
            { key: 'action', label: 'Action', render: function (l) {
              return '<span class="font-mono text-xs text-white">' + esc(l.action) + '</span>';
            } },
            { key: 'adminUser', label: 'Admin', render: function (l) {
              var a = l.adminUser || {};
              return '<span class="text-xs">' + esc(a.username || a.email || 'system') + '</span>';
            } },
            { key: 'target', label: 'Target', render: function (l) {
              return '<span class="text-xs">' + esc((l.target || '—') + (l.targetId ? ' · ' + A.truncate(l.targetId, 14) : '')) + '</span>';
            } },
            { key: 'reason', label: 'Reason', render: function (l) { return '<span class="text-xs">' + esc(A.truncate(l.reason, 40) || '—') + '</span>'; } },
            { key: 'ipAddress', label: 'IP', render: function (l) { return '<span class="font-mono text-xs">' + esc(l.ipAddress || '—') + '</span>'; } },
            { key: 'createdAt', label: 'When', render: function (l) { return '<span class="text-xs">' + esc(A.formatDate(l.createdAt)) + '</span>'; } },
            { key: 'actions', label: '', align: true, render: function (l) {
              return ui.button({ action: 'audit:view', label: 'Diff', icon: 'git-compare', variant: 'subtle', data: { id: l.id } });
            } }
          ];
          container.innerHTML =
            ui.pageHeader('Audit Log', A.formatNumber(data.total) + ' entries') +
            '<div class="card mb-4"><form data-audit-filter class="grid grid-cols-1 sm:grid-cols-[260px_auto] gap-3 items-end">' +
            ui.input({ name: 'auditAction', label: 'Action filter', value: auditQuery.action, placeholder: 'e.g. WITHDRAWAL_APPROVED' }) +
            '<button type="submit" class="h-10 rounded-lg border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-4 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors">Apply</button>' +
            '</form></div>' +
            ui.tableWrapper(columns, data.logs, 'No audit entries found.') +
            ui.pagination({ page: data.page, total: data.total, limit: data.limit });

          var form = container.querySelector('[data-audit-filter]');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              auditQuery.action = form.auditAction.value.trim();
              auditQuery.page = 1;
              load();
            });
          }
          var prev = container.querySelector('[data-page-prev]');
          var next = container.querySelector('[data-page-next]');
          if (prev) prev.addEventListener('click', function () { auditQuery.page = Math.max(1, auditQuery.page - 1); load(); });
          if (next) next.addEventListener('click', function () { auditQuery.page = auditQuery.page + 1; load(); });
        });
      }
      return load();
    }
  });

  A.onAction('audit:view', function (payload) {
    return A.api('/api/admin/audit-logs?limit=200').then(function (data) {
      var log = (data.logs || []).filter(function (l) { return l.id === payload.id; })[0];
      if (!log) { A.toast('Audit entry not found.', 'error'); return; }
      A.openModal({
        title: log.action,
        hideConfirm: true,
        body:
          '<div class="space-y-3 text-sm">' +
          row('Target', (log.target || '—') + (log.targetId ? ' · ' + log.targetId : '')) +
          row('Admin', (log.adminUser && (log.adminUser.email || log.adminUser.username)) || 'system') +
          row('Reason', log.reason || '—') +
          row('IP', log.ipAddress || '—') +
          row('User agent', log.userAgent || '—') +
          row('When', A.formatDate(log.createdAt)) +
          '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">' +
          '<div><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">Previous value</p>' +
          '<pre class="max-h-48 overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">' +
          esc(log.previousValue ? JSON.stringify(log.previousValue, null, 2) : '—') + '</pre></div>' +
          '<div><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">New value</p>' +
          '<pre class="max-h-48 overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all">' +
          esc(log.newValue ? JSON.stringify(log.newValue, null, 2) : '—') + '</pre></div>' +
          '</div>'
      });
    });
  });

  function row(label, value) {
    return '<div class="flex items-start justify-between gap-3"><span class="text-[var(--text-muted)] shrink-0">' + esc(label) + '</span>' +
      '<span class="text-white text-right break-all">' + esc(value) + '</span></div>';
  }
})();
