/* ================================================================
   EarnHub Admin - Core
   State, API client, router, navigation shell, shared UI helpers.
   ================================================================ */

var AdminApp = (function () {
  'use strict';

  var state = {
    user: null,
    permissions: [],
    route: 'dashboard',
    param: null,
    pages: [],
    notifications: [],
    mobileNavOpen: false
  };

  /* ---------------------------------------------------------
     Formatting helpers
     --------------------------------------------------------- */

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Money is stored in integer minor units across the whole platform.
  function formatKES(amount) {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return 'KES 0';
    var shillings = Number(amount) / 100;
    var rounded = Math.round(shillings * 100) / 100;
    if (rounded === Math.floor(rounded)) {
      return 'KES ' + rounded.toLocaleString('en-KE');
    }
    return 'KES ' + rounded.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatNumber(value) {
    if (value === null || value === undefined || isNaN(Number(value))) return '0';
    return Number(value).toLocaleString('en-KE');
  }

  function formatDate(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function timeAgo(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function truncate(value, length) {
    var str = String(value === null || value === undefined ? '' : value);
    if (str.length <= length) return str;
    return str.slice(0, length - 1) + '…';
  }

  function statusBadge(status) {
    var raw = String(status || 'unknown').toLowerCase();
    var cls = 'status-draft';
    if (['paid', 'approved', 'completed', 'active', 'unlocked', 'success', 'online', 'resolved', 'configured', 'enabled'].indexOf(raw) > -1) {
      cls = 'status-active';
    } else if (['pending', 'queued', 'processing', 'submitted', 'not_configured', 'maintenance'].indexOf(raw) > -1) {
      cls = 'status-pending';
    } else if (['failed', 'rejected', 'error', 'offline', 'disabled', 'suspended', 'critical', 'invalid'].indexOf(raw) > -1) {
      cls = 'status-failed';
    } else if (['locked', 'draft', 'resolved', 'medium', 'low'].indexOf(raw) > -1) {
      cls = 'status-locked';
    }
    return '<span class="status-badge ' + cls + '">' + esc(raw.replace(/_/g, ' ')) + '</span>';
  }

  function severityBadge(severity) {
    var raw = String(severity || 'low').toLowerCase();
    var cls = 'status-locked';
    if (raw === 'high' || raw === 'critical') cls = 'status-failed';
    else if (raw === 'medium') cls = 'status-pending';
    return '<span class="status-badge ' + cls + '">' + esc(raw) + '</span>';
  }

  function initials(text) {
    var str = String(text || 'A').trim();
    return str.charAt(0).toUpperCase();
  }

  /* ---------------------------------------------------------
     API client
     --------------------------------------------------------- */

  function api(path, options) {
    var opts = options || {};
    var config = {
      method: opts.method || 'GET',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (opts.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(opts.body);
    }

    return fetch(path, config).then(function (response) {
      return response.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (err) {
          throw { status: response.status, message: 'Unexpected server response', raw: text };
        }
        if (response.status === 401) {
          handleUnauthorized(data.message || 'Session expired');
          throw { status: 401, message: data.message || 'Session expired', handled: true };
        }
        if (!response.ok || data.success === false) {
          throw { status: response.status, message: data.message || 'Request failed' };
        }
        return data;
      });
    }, function () {
      throw { status: 0, message: 'Network error. Check your connection.' };
    });
  }

  var unauthorizedHandler = null;

  function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

  function handleUnauthorized(message) {
    if (unauthorizedHandler) unauthorizedHandler(message);
  }

  /* ---------------------------------------------------------
     Permissions
     --------------------------------------------------------- */

  function hasPermission(key) {
    if (!state.user) return false;
    if (state.user.role === 'Super Admin') return true;
    return state.permissions.indexOf(key) > -1;
  }

  function hasAnyPermission(keys) {
    if (!keys || !keys.length) return true;
    for (var i = 0; i < keys.length; i++) {
      if (hasPermission(keys[i])) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------
     Toasts
     --------------------------------------------------------- */

  function toast(message, type) {
    var kind = type || 'info';
    var el = document.createElement('div');
    el.className = 'notification notification-' + kind;
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="flex items-start gap-3">' +
      '<i data-lucide="' + (kind === 'success' ? 'check-circle-2' : kind === 'error' ? 'alert-circle' : 'info') + '" class="h-5 w-5 shrink-0" aria-hidden="true"></i>' +
      '<span class="flex-1">' + esc(message) + '</span>' +
      '</div>';
    document.body.appendChild(el);
    if (window.lucide) lucide.createIcons();
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 350);
    }, 3800);
  }

  /* ---------------------------------------------------------
     Modals
     --------------------------------------------------------- */

  function openModal(options) {
    var opts = options || {};
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'adminModalBackdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', opts.title || 'Dialog');

    modal.innerHTML =
      '<div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--border-primary)]">' +
      '<h3 class="font-display text-lg font-bold text-white">' + esc(opts.title || '') + '</h3>' +
      '<button type="button" data-modal-close class="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors" aria-label="Close dialog">' +
      '<i data-lucide="x" class="h-5 w-5" aria-hidden="true"></i></button>' +
      '</div>' +
      '<div data-modal-body class="px-6 py-5 max-h-[65vh] overflow-y-auto main-scrollbar">' + (opts.body || '') + '</div>' +
      '<div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-primary)]">' +
      '<button type="button" data-modal-close class="h-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>' +
      '<button type="button" data-modal-confirm class="h-10 rounded-xl border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 px-5 text-sm font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">' + esc(opts.confirmLabel || 'Confirm') + '</button>' +
      '</div>';

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    if (window.lucide) lucide.createIcons();

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (opts.onClose) opts.onClose();
    }

    Array.prototype.forEach.call(modal.querySelectorAll('[data-modal-close]'), function (btn) {
      btn.addEventListener('click', close);
    });

    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop) close();
    });

    var confirmBtn = modal.querySelector('[data-modal-confirm]');
    if (opts.hideConfirm) {
      confirmBtn.parentNode.removeChild(confirmBtn);
    } else {
      confirmBtn.addEventListener('click', function () {
        if (opts.onConfirm) {
          confirmBtn.disabled = true;
          Promise.resolve(opts.onConfirm(modal, close)).then(function (result) {
            confirmBtn.disabled = false;
            if (result !== false) close();
          }, function (err) {
            confirmBtn.disabled = false;
            toast((err && err.message) || 'Something went wrong', 'error');
          });
        } else {
          close();
        }
      });
    }

    if (opts.onOpen) opts.onOpen(modal, close);

    var focusTarget = modal.querySelector('[autofocus]') || modal.querySelector('input, select, textarea');
    if (focusTarget) setTimeout(function () { focusTarget.focus(); }, 50);

    return { close: close, modal: modal };
  }

  function confirmDialog(options) {
    var opts = options || {};
    return openModal({
      title: opts.title || 'Please confirm',
      body:
        '<p class="text-sm text-[var(--text-secondary)] leading-relaxed">' + (opts.messageHtml || esc(opts.message || '')) + '</p>' +
        (opts.withReason
          ? '<div class="mt-4"><label class="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2" for="modalReason">Reason (recorded in audit log)</label>' +
            '<textarea id="modalReason" rows="3" class="w-full rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]" placeholder="Reason"></textarea></div>'
          : ''),
      confirmLabel: opts.confirmLabel || 'Confirm',
      onConfirm: function (modal) {
        var reasonEl = modal.querySelector('#modalReason');
        var reason = reasonEl ? reasonEl.value.trim() : undefined;
        if (opts.withReason && !reason) {
          toast('A reason is required for this action.', 'error');
          return false;
        }
        if (opts.onConfirm) return opts.onConfirm(reason);
        return true;
      }
    });
  }

  /* ---------------------------------------------------------
     Shared UI builders
     --------------------------------------------------------- */

  var ui = {};

  ui.pageHeader = function (title, subtitle, actionsHtml) {
    return (
      '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">' +
      '<div class="min-w-0">' +
      '<h1 class="font-display text-2xl font-bold text-white truncate">' + esc(title) + '</h1>' +
      (subtitle ? '<p class="text-sm text-[var(--text-secondary)] mt-1">' + esc(subtitle) + '</p>' : '') +
      '</div>' +
      (actionsHtml ? '<div class="flex flex-wrap items-center gap-2">' + actionsHtml + '</div>' : '') +
      '</div>'
    );
  };

  ui.card = function (inner, className) {
    return '<section class="card ' + (className || '') + '">' + inner + '</section>';
  };

  ui.sectionTitle = function (title, subtitle) {
    return (
      '<div class="flex items-center justify-between gap-4 mb-4">' +
      '<div><h2 class="font-display text-base font-bold text-white">' + esc(title) + '</h2>' +
      (subtitle ? '<p class="text-xs text-[var(--text-muted)] mt-0.5">' + esc(subtitle) + '</p>' : '') +
      '</div></div>'
    );
  };

  ui.metricCard = function (opts) {
    return (
      '<div class="rounded-2xl border p-5" style="background:' + opts.bg + ';border-color:' + opts.border + '">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="min-w-0">' +
      '<p class="text-xs font-semibold uppercase tracking-wide" style="color:' + opts.color + '">' + esc(opts.label) + '</p>' +
      '<p class="metric-value mt-2 truncate" style="color:var(--text-primary)">' + esc(opts.value) + '</p>' +
      (opts.hint ? '<p class="text-xs text-[var(--text-muted)] mt-1 truncate">' + esc(opts.hint) + '</p>' : '') +
      '</div>' +
      '<span class="shrink-0 flex items-center justify-center rounded-xl" style="width:40px;height:40px;background:' + opts.iconBg + ';color:' + opts.color + '">' +
      '<i data-lucide="' + opts.icon + '" class="h-5 w-5" aria-hidden="true"></i></span>' +
      '</div></div>'
    );
  };

  ui.button = function (opts) {
    var variant = opts.variant || 'ghost';
    var styles = {
      primary: 'border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/25',
      danger: 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20',
      ghost: 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-secondary)]',
      subtle: 'border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
    };
    return '<button type="button" data-action="' + esc(opts.action) + '"' +
      (opts.data ? Object.keys(opts.data).map(function (k) { return ' data-' + k + '="' + esc(opts.data[k]) + '"'; }).join('') : '') +
      ' class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ' + styles[variant] + '">' +
      (opts.icon ? '<i data-lucide="' + opts.icon + '" class="h-4 w-4" aria-hidden="true"></i>' : '') +
      '<span>' + esc(opts.label) + '</span></button>';
  };

  ui.input = function (opts) {
    var cls = 'w-full h-10 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-emerald)] transition-colors';
    var attrs = opts.attrs || '';
    if (opts.type === 'textarea') {
      return '<div class="' + (opts.wrapClass || '') + '">' +
        '<label class="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2" for="' + esc(opts.name) + '">' + esc(opts.label) + '</label>' +
        '<textarea id="' + esc(opts.name) + '" name="' + esc(opts.name) + '" rows="' + (opts.rows || 3) + '" ' + (opts.required ? 'required ' : '') + 'placeholder="' + esc(opts.placeholder || '') + '" class="' + cls + '" ' + attrs + '>' + esc(opts.value || '') + '</textarea>' +
        (opts.hint ? '<p class="text-xs text-[var(--text-muted)] mt-1">' + esc(opts.hint) + '</p>' : '') +
        '</div>';
    }
    return '<div class="' + (opts.wrapClass || '') + '">' +
      '<label class="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2" for="' + esc(opts.name) + '">' + esc(opts.label) + '</label>' +
      '<input id="' + esc(opts.name) + '" name="' + esc(opts.name) + '" type="' + (opts.type || 'text') + '" ' + (opts.required ? 'required ' : '') + 'value="' + esc(opts.value === undefined ? '' : opts.value) + '" placeholder="' + esc(opts.placeholder || '') + '" class="' + cls + '" ' + attrs + ' />' +
      (opts.hint ? '<p class="text-xs text-[var(--text-muted)] mt-1">' + esc(opts.hint) + '</p>' : '') +
      '</div>';
  };

  ui.select = function (opts) {
    var cls = 'w-full h-10 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)] transition-colors';
    var options = (opts.options || []).map(function (o) {
      var val = typeof o === 'string' ? o : o.value;
      var label = typeof o === 'string' ? o : o.label;
      return '<option value="' + esc(val) + '"' + (String(val) === String(opts.value) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<div class="' + (opts.wrapClass || '') + '">' +
      '<label class="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2" for="' + esc(opts.name) + '">' + esc(opts.label) + '</label>' +
      '<select id="' + esc(opts.name) + '" name="' + esc(opts.name) + '" class="' + cls + '">' + options + '</select>' +
      '</div>';
  };

  ui.empty = function (message, icon) {
    return (
      '<div class="flex flex-col items-center justify-center py-14 text-center">' +
      '<span class="flex items-center justify-center rounded-2xl mb-3" style="width:48px;height:48px;background:var(--bg-tertiary);color:var(--text-muted)">' +
      '<i data-lucide="' + (icon || 'inbox') + '" class="h-6 w-6" aria-hidden="true"></i></span>' +
      '<p class="text-sm text-[var(--text-secondary)]">' + esc(message) + '</p>' +
      '</div>'
    );
  };

  ui.errorState = function (message, retryAction) {
    return (
      '<div class="card flex flex-col items-center justify-center text-center py-14">' +
      '<span class="flex items-center justify-center rounded-2xl mb-3" style="width:48px;height:48px;background:rgba(239,68,68,0.12);color:var(--accent-red)">' +
      '<i data-lucide="alert-triangle" class="h-6 w-6" aria-hidden="true"></i></span>' +
      '<p class="text-sm font-semibold text-white">Unable to load data</p>' +
      '<p class="text-sm text-[var(--text-muted)] mt-1 max-w-sm">' + esc(message || 'Please try again.') + '</p>' +
      (retryAction ? '<div class="mt-4">' + ui.button({ action: retryAction, label: 'Retry', icon: 'refresh-cw', variant: 'primary' }) + '</div>' : '') +
      '</div>'
    );
  };

  ui.skeleton = function (rows) {
    var out = '<div class="space-y-3">';
    for (var i = 0; i < (rows || 6); i++) {
      out += '<div class="skeleton" style="height:44px"></div>';
    }
    return out + '</div>';
  };

  ui.toolbar = function (inner) {
    return '<div class="flex flex-wrap items-end gap-3 mb-4">' + inner + '</div>';
  };

  ui.tableWrapper = function (columns, rows, emptyMessage) {
    if (!rows || !rows.length) {
      return '<div class="card">' + ui.empty(emptyMessage || 'Nothing to show yet.') + '</div>';
    }
    var head = columns.map(function (c) {
      return '<th' + (c.align ? ' class="text-right"' : '') + '>' + esc(c.label) + '</th>';
    }).join('');
    var body = rows.map(function (row, index) {
      return '<tr' + (row.__onClick ? ' class="cursor-pointer" data-row-index="' + index + '"' : '') + '>' +
        columns.map(function (c) {
          var content = c.render ? c.render(row, index) : esc(row[c.key]);
          if (content === null || content === undefined) content = '—';
          return '<td' + (c.align ? ' class="text-right"' : '') + '>' + content + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return (
      '<div class="card !p-0 overflow-hidden">' +
      '<div class="overflow-x-auto main-scrollbar"><table class="data-table"><thead class="table-header"><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '</div>'
    );
  };

  ui.pagination = function (opts) {
    var page = opts.page || 1;
    var total = opts.total || 0;
    var limit = opts.limit || 50;
    var pages = Math.max(1, Math.ceil(total / limit));
    if (pages <= 1) {
      return '<div class="flex items-center justify-between mt-4 text-xs text-[var(--text-muted)]">' +
        '<span>' + formatNumber(total) + ' record' + (total === 1 ? '' : 's') + '</span></div>';
    }
    var from = (page - 1) * limit + 1;
    var to = Math.min(page * limit, total);
    return (
      '<div class="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs text-[var(--text-muted)]">' +
      '<span>Showing ' + formatNumber(from) + '–' + formatNumber(to) + ' of ' + formatNumber(total) + '</span>' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" data-page-prev class="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"' + (page <= 1 ? ' disabled' : '') + '>' +
      '<i data-lucide="chevron-left" class="h-4 w-4" aria-hidden="true"></i> Prev</button>' +
      '<span class="px-2">Page ' + page + ' of ' + pages + '</span>' +
      '<button type="button" data-page-next class="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"' + (page >= pages ? ' disabled' : '') + '>' +
      'Next <i data-lucide="chevron-right" class="h-4 w-4" aria-hidden="true"></i></button>' +
      '</div></div>'
    );
  };

  ui.statRow = function (items) {
    return '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' + items.map(function (item) {
      return (
        '<div class="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">' +
        '<p class="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">' + esc(item.label) + '</p>' +
        '<p class="font-display text-lg font-bold text-white mt-1 truncate">' + esc(item.value) + '</p>' +
        '</div>'
      );
    }).join('') + '</div>';
  };

  /* Lightweight dependency-free SVG area chart. */
  ui.sparkline = function (points, opts) {
    var options = opts || {};
    var width = 640;
    var height = options.height || 180;
    if (!points || points.length < 2) {
      return '<div class="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">Not enough data to chart yet.</div>';
    }
    var values = points.map(function (p) { return Number(p.total) || 0; });
    var max = Math.max.apply(null, values);
    var min = Math.min.apply(null, values);
    if (max === min) { max = max + 1; min = 0; }
    var padX = 8;
    var padY = 16;
    var stepX = (width - padX * 2) / (points.length - 1);
    var coords = values.map(function (v, i) {
      var x = padX + i * stepX;
      var y = height - padY - ((v - min) / (max - min)) * (height - padY * 2);
      return [x, y];
    });
    var line = coords.map(function (c, i) { return (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1); }).join(' ');
    var area = line + ' L' + coords[coords.length - 1][0].toFixed(1) + ' ' + (height - padY) + ' L' + coords[0][0].toFixed(1) + ' ' + (height - padY) + ' Z';
    var dots = coords.map(function (c) {
      return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="3" fill="var(--accent-emerald)"><title>' + esc(options.labels ? options.labels[coords.indexOf(c)] : '') + '</title></circle>';
    }).join('');
    var labels = points.map(function (p, i) {
      if (i % Math.ceil(points.length / 7) !== 0 && i !== points.length - 1) return '';
      return '<text x="' + coords[i][0].toFixed(1) + '" y="' + (height - 2) + '" fill="var(--text-muted)" font-size="10" text-anchor="middle">' + esc(formatShortDate(p.day)) + '</text>';
    }).join('');
    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" class="w-full" role="img" aria-label="Trend chart" preserveAspectRatio="none">' +
      '<defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--accent-emerald)" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="var(--accent-emerald)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#chartFill)"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--accent-emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots + labels +
      '</svg>'
    );
  };

  function formatShortDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
  }

  /* ---------------------------------------------------------
     Page registry + router
     --------------------------------------------------------- */

  var NAV_GROUPS = [
    { key: 'overview', label: 'Overview' },
    { key: 'people', label: 'People' },
    { key: 'finance', label: 'Finance' },
    { key: 'modules', label: 'Modules' },
    { key: 'platform', label: 'Platform' },
    { key: 'security', label: 'Security' }
  ];

  function registerPage(page) {
    state.pages.push(page);
  }

  function visiblePages() {
    return state.pages.filter(function (p) {
      return hasAnyPermission(p.permissions);
    });
  }

  function findPage(id) {
    for (var i = 0; i < state.pages.length; i++) {
      if (state.pages[i].id === id) return state.pages[i];
    }
    return null;
  }

  function renderNav() {
    var container = document.getElementById('adminNav');
    if (!container) return;
    var pages = visiblePages();
    var html = '';

    NAV_GROUPS.forEach(function (group) {
      var inGroup = pages.filter(function (p) { return (p.group || 'platform') === group.key; });
      if (!inGroup.length) return;
      html += '<div class="nav-group-label">' + esc(group.label) + '</div>';
      inGroup.forEach(function (page) {
        html += (
          '<a href="#/' + esc(page.id) + '" class="nav-link' + (state.route === page.id ? ' active' : '') + '" data-nav="' + esc(page.id) + '">' +
          '<span class="nav-icon"><i data-lucide="' + esc(page.icon) + '" class="h-4 w-4" aria-hidden="true"></i></span>' +
          '<span class="truncate">' + esc(page.title) + '</span>' +
          '</a>'
        );
      });
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function setActiveNav() {
    Array.prototype.forEach.call(document.querySelectorAll('#adminNav .nav-link'), function (link) {
      link.classList.toggle('active', link.getAttribute('data-nav') === state.route);
    });
  }

  function parseHash() {
    var raw = (window.location.hash || '').replace(/^#\/?/, '');
    if (!raw) return { id: 'dashboard', param: null };
    var parts = raw.split('/');
    return { id: parts[0], param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  var renderToken = 0;

  function renderRoute() {
    var parsed = parseHash();
    state.route = parsed.id;
    state.param = parsed.param;
    setActiveNav();
    closeMobileNav();

    var page = findPage(parsed.id);
    var content = document.getElementById('adminContent');
    if (!content) return;

    if (!page) {
      content.innerHTML = ui.pageHeader('Page not found', null, ui.button({ action: 'go:dashboard', label: 'Back to dashboard', icon: 'arrow-left', variant: 'primary' })) +
        ui.card('<p class="text-sm text-[var(--text-secondary)]">The requested admin section does not exist.</p>');
      bindActions(content);
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (!hasAnyPermission(page.permissions)) {
      content.innerHTML = ui.pageHeader(page.title, null, '') +
        ui.card(
          '<div class="flex flex-col items-center justify-center text-center py-12">' +
          '<span class="flex items-center justify-center rounded-2xl mb-3" style="width:48px;height:48px;background:rgba(245,158,11,0.12);color:var(--accent-amber)">' +
          '<i data-lucide="shield-alert" class="h-6 w-6" aria-hidden="true"></i></span>' +
          '<p class="text-sm font-semibold text-white">Access denied</p>' +
          '<p class="text-sm text-[var(--text-muted)] mt-1">Your role does not include the permission required for this section.</p>' +
          '</div>'
        );
      if (window.lucide) lucide.createIcons();
      return;
    }

    var token = ++renderToken;
    content.innerHTML = '<div class="space-y-4">' + ui.pageHeader(page.title, page.subtitle || '') + ui.skeleton(6) + '</div>';
    if (window.lucide) lucide.createIcons();

    Promise.resolve()
      .then(function () { return page.render(content, state.param); })
      .then(function () {
        if (token !== renderToken) return;
        if (window.lucide) lucide.createIcons();
      })
      .catch(function (err) {
        if (token !== renderToken) return;
        content.innerHTML = ui.pageHeader(page.title, page.subtitle || '') + ui.errorState(err && err.message, 'page:retry');
        bindActions(content);
        if (window.lucide) lucide.createIcons();
      });
  }

  /* ---------------------------------------------------------
     Delegated action handling
     --------------------------------------------------------- */

  var actionHandlers = {};

  function onAction(name, handler) {
    actionHandlers[name] = handler;
  }

  var documentActionsBound = false;

  function bindActions(root) {
    // Actions are delegated on `document` once at startup. That already covers
    // #adminContent and anything appended later (modals live on document.body).
    // Binding the page container as well would make a single click bubble and
    // fire every handler twice, which duplicated modals and duplicated writes.
    // So per-container binds are accepted only as a fallback when no document
    // binding exists yet, and any element is bound at most once.
    var el = root || document;
    var isDocument = el === document;

    if (isDocument) {
      if (documentActionsBound) return;
      documentActionsBound = true;
    } else if (documentActionsBound) {
      return;
    } else if (el.__adminActionsBound) {
      return;
    } else {
      el.__adminActionsBound = true;
    }

    el.addEventListener('click', function (event) {
      var target = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!target) return;
      var name = target.getAttribute('data-action');
      var handler = actionHandlers[name];
      if (!handler && name && name.indexOf(':') > -1) {
        var parts = name.split(':');
        handler = actionHandlers[parts[0]];
        if (handler) target.setAttribute('data-args', parts.slice(1).join(':'));
      }
      if (!handler) return;
      event.preventDefault();
      var payload = {};
      Array.prototype.forEach.call(target.attributes, function (attr) {
        if (attr.name.indexOf('data-') === 0 && attr.name !== 'data-action') {
          var key = attr.name.slice(5);
          key = key.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
          payload[key] = attr.value;
        }
      });
      Promise.resolve(handler(payload, target, event)).catch(function (err) {
        toast((err && err.message) || 'Something went wrong', 'error');
      });
    });
  }

  function refresh() {
    renderRoute();
  }

  /* ---------------------------------------------------------
     Navigation shell
     --------------------------------------------------------- */

  function closeMobileNav() {
    state.mobileNavOpen = false;
    var sidebar = document.getElementById('adminSidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.add('hidden');
  }

  function setupShell() {
    var toggle = document.getElementById('toggleSidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var sidebar = document.getElementById('adminSidebar');
        state.mobileNavOpen = !state.mobileNavOpen;
        if (sidebar) sidebar.classList.toggle('mobile-open', state.mobileNavOpen);
        if (backdrop) backdrop.classList.toggle('hidden', !state.mobileNavOpen);
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeMobileNav);

    var accountBtn = document.getElementById('adminAccountBtn');
    var dropdown = document.getElementById('adminDropdown');
    if (accountBtn && dropdown) {
      accountBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('opacity-0');
        dropdown.classList.toggle('invisible');
        dropdown.classList.toggle('pointer-events-none');
        dropdown.classList.toggle('translate-y-2');
      });
      document.addEventListener('click', function (e) {
        var menu = document.getElementById('adminAccountMenu');
        if (menu && !menu.contains(e.target)) {
          dropdown.classList.add('opacity-0', 'invisible', 'pointer-events-none', 'translate-y-2');
        }
      });
    }

    var notifBtn = document.getElementById('notificationsBtn');
    var notifPanel = document.getElementById('notificationPanel');
    if (notifBtn && notifPanel) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        notifPanel.classList.toggle('hidden');
        notifBtn.setAttribute('aria-expanded', notifPanel.classList.contains('hidden') ? 'false' : 'true');
        if (!notifPanel.classList.contains('hidden')) loadNotifications();
      });
      document.addEventListener('click', function (e) {
        var panel = document.getElementById('notificationPanel');
        if (panel && !panel.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
          panel.classList.add('hidden');
          notifBtn.setAttribute('aria-expanded', 'false');
        }
      });
      var refreshBtn = document.getElementById('notificationsRefresh');
      if (refreshBtn) refreshBtn.addEventListener('click', function (e) { e.stopPropagation(); loadNotifications(); });
    }

    window.addEventListener('hashchange', renderRoute);
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) closeMobileNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMobileNav();
        var panel = document.getElementById('notificationPanel');
        if (panel) panel.classList.add('hidden');
      }
    });
  }

  function loadNotifications() {
    var list = document.getElementById('notificationList');
    if (!list) return;
    if (!list.dataset.loaded) {
      list.innerHTML = '<div class="p-4 text-sm text-[var(--text-muted)]">Loading…</div>';
    }
    api('/api/admin/notifications').then(function (data) {
      state.notifications = data.notifications || [];
      list.dataset.loaded = '1';
      if (!state.notifications.length) {
        list.innerHTML = ui.empty('No notifications yet.', 'bell-off');
      } else {
        list.innerHTML = state.notifications.map(function (n) {
          return (
            '<button type="button" data-notification-id="' + esc(n.id) + '" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors ' + (n.isRead ? 'opacity-60' : '') + '">' +
            '<div class="flex items-start gap-2">' +
            '<span class="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" style="background:' + severityColor(n.severity) + '"></span>' +
            '<span class="min-w-0">' +
            '<span class="block text-sm font-semibold text-white truncate">' + esc(n.title) + '</span>' +
            '<span class="block text-xs text-[var(--text-secondary)] mt-0.5">' + esc(truncate(n.message, 120)) + '</span>' +
            '<span class="block text-[11px] text-[var(--text-muted)] mt-1">' + esc(timeAgo(n.createdAt)) + '</span>' +
            '</span></div></button>'
          );
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('[data-notification-id]'), function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-notification-id');
            btn.classList.add('opacity-60');
            api('/api/admin/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' })
              .then(updateNotificationBadge)
              .catch(function () { /* badge refresh is best effort */ });
          });
        });
      }
      if (window.lucide) lucide.createIcons();
      updateNotificationBadge();
    }).catch(function (err) {
      list.innerHTML = '<div class="p-4 text-sm text-red-400">' + esc(err.message || 'Failed to load notifications') + '</div>';
    });
  }

  function severityColor(severity) {
    var map = { info: 'var(--accent-sky)', success: 'var(--accent-emerald)', warning: 'var(--accent-amber)', error: 'var(--accent-red)', critical: 'var(--accent-red)' };
    return map[String(severity || '').toLowerCase()] || 'var(--accent-sky)';
  }

  function updateNotificationBadge() {
    var badge = document.getElementById('notifBadge');
    if (!badge) return;
    var unread = state.notifications.filter(function (n) { return !n.isRead; }).length;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);
  }

  /* ---------------------------------------------------------
     Session handling
     --------------------------------------------------------- */

  function setAdminUser(payload) {
    // verifySession() can resolve to null when the session check returns 401,
    // which is the normal state on the login screen.
    state.user = (payload && payload.user) || null;
    state.permissions = (state.user && state.user.permissions) || [];
    if (state.user) {
      var nameEl = document.getElementById('adminUsername');
      var avatarEl = document.getElementById('adminAvatar');
      if (nameEl) nameEl.textContent = state.user.username || state.user.email;
      if (avatarEl) avatarEl.textContent = initials(state.user.name || state.user.username || state.user.email);
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('adminPanel').classList.remove('hidden');
      renderNav();
      loadNotifications();
    } else {
      state.permissions = [];
      state.notifications = [];
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('adminPanel').classList.add('hidden');
      document.getElementById('adminNav').innerHTML = '';
    }
  }

  function showLogin(message) {
    setAdminUser(null);
    var error = document.getElementById('loginError');
    if (error) error.textContent = message || '';
  }

  function login(email, password, twoFACode) {
    var payload = { email: email, password: password };
    if (twoFACode) payload.twoFACode = twoFACode;
    return api('/api/admin/login', { method: 'POST', body: payload });
  }

  function logout() {
    return api('/api/admin/logout', { method: 'POST' })
      .catch(function () { /* session is being discarded regardless */ })
      .then(function () {
        showLogin('');
      });
  }

  function verifySession() {
    return api('/api/admin/verify').then(function (data) {
      setAdminUser(data);
      if (!window.location.hash) window.location.hash = '#/dashboard';
      renderRoute();
      return data;
    });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */

  function setupLogin() {
    var form = document.getElementById('loginForm');
    var emailInput = document.getElementById('loginEmail');
    var passwordInput = document.getElementById('loginPassword');
    var errorBox = document.getElementById('loginError');
    var twofaSection = document.getElementById('twofaSection');
    var twofaInput = document.getElementById('login2FA');
    var twofaSubmit = document.getElementById('twofaSubmit');

    function setError(message) {
      errorBox.textContent = message || '';
      errorBox.className = message ? 'text-sm text-red-400 min-h-5' : 'text-sm min-h-5';
    }

    function submit() {
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      if (!email || !password) { setError('Enter your email and password.'); return; }
      setError('');
      passwordInput.value = '';
      login(email, password, twofaInput.value.trim())
        .then(function (data) {
          if (data.requires2FA) {
            twofaSection.classList.remove('hidden');
            twofaInput.focus();
            return;
          }
          twofaSection.classList.add('hidden');
          twofaInput.value = '';
          return verifySession();
        })
        .catch(function (err) { setError(err.message || 'Login failed'); });
    }

    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    if (twofaSubmit) twofaSubmit.addEventListener('click', submit);

    var showBootstrap = document.getElementById('showBootstrap');
    var bootstrapForm = document.getElementById('bootstrapForm');
    if (showBootstrap && bootstrapForm) {
      showBootstrap.addEventListener('click', function () {
        bootstrapForm.classList.toggle('hidden');
      });
      bootstrapForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var error = document.getElementById('bootstrapError');
        error.textContent = '';
        api('/api/admin/bootstrap', {
          method: 'POST',
          body: {
            email: document.getElementById('bsEmail').value.trim(),
            username: document.getElementById('bsUsername').value.trim(),
            name: document.getElementById('bsName').value.trim(),
            password: document.getElementById('bsPassword').value,
            adminSecret: document.getElementById('bsSecret').value
          }
        }).then(function () {
          error.className = 'text-sm text-emerald-400 min-h-5';
          error.textContent = 'Super Admin created. You can sign in now.';
          bootstrapForm.reset();
        }).catch(function (err) { error.textContent = err.message || 'Bootstrap failed'; });
      });
    }

    var profileLink = document.getElementById('adminProfileLink');
    if (profileLink) {
      profileLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.user && state.user.email) {
          window.location.href = 'mailto:' + state.user.email + '?subject=EarnHub%20Admin%20Support';
        }
      });
    }

    var logoutLink = document.getElementById('adminLogout');
    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) { e.preventDefault(); logout(); });
    }
  }

  function init() {
    setupShell();
    setupLogin();
    bindActions(document);
    setUnauthorizedHandler(function (message) {
      showLogin(message || 'Your session expired. Please sign in again.');
    });
    if (window.lucide) lucide.createIcons();
    verifySession().catch(function () {
      showLogin('');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    state: state,
    api: api,
    ui: ui,
    toast: toast,
    openModal: openModal,
    confirmDialog: confirmDialog,
    hasPermission: hasPermission,
    hasAnyPermission: hasAnyPermission,
    registerPage: registerPage,
    onAction: onAction,
    navigate: function (id, param) {
      window.location.hash = '#/' + id + (param ? '/' + encodeURIComponent(param) : '');
    },
    refresh: refresh,
    setAdminUser: setAdminUser,
    showLogin: showLogin,
    logout: logout,
    formatKES: formatKES,
    formatNumber: formatNumber,
    formatDate: formatDate,
    timeAgo: timeAgo,
    statusBadge: statusBadge,
    severityBadge: severityBadge,
    esc: esc,
    truncate: truncate,
    bindActions: bindActions
  };
})();
