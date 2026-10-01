/* ================================================================
   EarnHub Admin System - Module
   ================================================================ */

import crypto from 'node:crypto';

// Admin permission definitions
const ADMIN_PERMISSIONS = [
  { key: 'users.view', name: 'View Users', category: 'users', description: 'Can view all users' },
  { key: 'users.edit', name: 'Edit Users', category: 'users', description: 'Can edit user accounts' },
  { key: 'users.suspend', name: 'Suspend Users', category: 'users', description: 'Can suspend/unsuspend users' },
  { key: 'users.delete', name: 'Delete Users', category: 'users', description: 'Can delete users' },
  { key: 'wallet.view', name: 'View Wallet', category: 'finance', description: 'Can view wallet balances' },
  { key: 'wallet.adjust', name: 'Adjust Wallet', category: 'finance', description: 'Can adjust wallet balances' },
  { key: 'earnings.view', name: 'View Earnings', category: 'finance', description: 'Can view earning transactions' },
  { key: 'earnings.approve', name: 'Approve Earnings', category: 'finance', description: 'Can approve earnings' },
  { key: 'earnings.reverse', name: 'Reverse Earnings', category: 'finance', description: 'Can reverse earnings' },
  { key: 'payments.view', name: 'View Payments', category: 'payments', description: 'Can view all payments' },
  { key: 'payments.manage', name: 'Manage Payments', category: 'payments', description: 'Can manage payment configuration' },
  { key: 'withdrawals.view', name: 'View Withdrawals', category: 'finance', description: 'Can view all withdrawals' },
  { key: 'withdrawals.approve', name: 'Approve Withdrawals', category: 'finance', description: 'Can approve withdrawals' },
  { key: 'withdrawals.reject', name: 'Reject Withdrawals', category: 'finance', description: 'Can reject withdrawals' },
  { key: 'modules.view', name: 'View Modules', category: 'modules', description: 'Can view module configuration' },
  { key: 'modules.manage', name: 'Manage Modules', category: 'modules', description: 'Can manage module configuration' },
  { key: 'settings.view', name: 'View Settings', category: 'settings', description: 'Can view platform settings' },
  { key: 'settings.manage', name: 'Manage Settings', category: 'settings', description: 'Can manage platform settings' },
  { key: 'providers.view', name: 'View Providers', category: 'providers', description: 'Can view provider config' },
  { key: 'providers.manage', name: 'Manage Providers', category: 'providers', description: 'Can manage providers' },
  { key: 'fraud.view', name: 'View Fraud Alerts', category: 'fraud', description: 'Can view fraud alerts' },
  { key: 'fraud.manage', name: 'Manage Fraud', category: 'fraud', description: 'Can resolve fraud alerts' },
  { key: 'admins.view', name: 'View Admins', category: 'admins', description: 'Can view admin users' },
  { key: 'admins.manage', name: 'Manage Admins', category: 'admins', description: 'Can manage admins and roles' },
  { key: 'audit.view', name: 'View Audit Logs', category: 'system', description: 'Can view audit logs' },
  { key: 'dashboard.view', name: 'View Dashboard', category: 'system', description: 'Can access admin dashboard' },
  { key: 'tasks.manage', name: 'Manage Tasks', category: 'modules', description: 'Create and manage AI/writing tasks' },
  { key: 'tasks.review', name: 'Review Submissions', category: 'modules', description: 'Review task submissions' },
  { key: 'reviews.manage', name: 'Manage Reviews', category: 'modules', description: 'Moderate hotel reviews' },
  { key: 'spin.manage', name: 'Manage Spin Wheel', category: 'modules', description: 'Configure spin packages and rewards' },
  { key: 'digital_products.manage', name: 'Manage Products', category: 'modules', description: 'Manage digital products' },
  { key: 'earnings.rules', name: 'Manage Reward Rules', category: 'finance', description: 'Create and configure reward rules' },
  { key: 'earnings.transactions', name: 'View Earning Transactions', category: 'finance', description: 'View detailed earning transactions' },
];

// Role definitions
const ADMIN_ROLES = [
  { code: 'super_admin', name: 'Super Admin', description: 'Full access to all admin functions', permissions: ADMIN_PERMISSIONS.map(p => p.key) },
  { code: 'platform_admin', name: 'Platform Admin', description: 'Manages platform operations and settings', permissions: [
    'dashboard.view', 'users.view', 'users.edit', 'users.suspend', 'wallet.view', 'earnings.view',
    'earnings.rules', 'earnings.transactions', 'earnings.approve', 'earnings.reverse',
    'payments.view', 'withdrawals.view', 'withdrawals.approve', 'withdrawals.reject', 'modules.view',
    'settings.view', 'settings.manage', 'providers.view', 'fraud.view', 'admins.view', 'audit.view',
    'tasks.manage', 'tasks.review', 'reviews.manage', 'spin.manage', 'digital_products.manage',
  ]},
  { code: 'finance_admin', name: 'Finance Admin', description: 'Handles wallet, payments, and withdrawals', permissions: [
    'dashboard.view', 'wallet.view', 'wallet.adjust', 'earnings.view', 'earnings.rules',
    'earnings.transactions', 'earnings.approve', 'earnings.reverse',
    'payments.view', 'withdrawals.view', 'withdrawals.approve', 'withdrawals.reject', 'audit.view',
  ]},
  { code: 'earning_manager', name: 'Earning Manager', description: 'Manages earning modules and tasks', permissions: [
    'dashboard.view', 'users.view', 'earnings.view', 'earnings.rules', 'earnings.transactions',
    'earnings.approve', 'payments.view', 'modules.view', 'modules.manage',
    'tasks.manage', 'tasks.review', 'reviews.manage', 'spin.manage', 'digital_products.manage', 'audit.view',
  ]},
  { code: 'moderator', name: 'Moderator', description: 'Reviews content and handles moderation', permissions: [
    'dashboard.view', 'users.view', 'reviews.manage', 'tasks.review', 'fraud.view', 'audit.view',
  ]},
  { code: 'support_admin', name: 'Support Admin', description: 'Handles user support and account issues', permissions: [
    'dashboard.view', 'users.view', 'users.edit', 'wallet.view', 'earnings.view',
    'earnings.transactions', 'payments.view', 'withdrawals.view', 'audit.view',
  ]},
  { code: 'risk_admin', name: 'Risk/Fraud Admin', description: 'Handles fraud detection and risk management', permissions: [
    'dashboard.view', 'fraud.view', 'fraud.manage', 'users.view', 'wallet.view', 'risk.view', 'risk.manage',
    'audit.view', 'providers.view', 'earnings.transactions',
  ]},
  { code: 'developer', name: 'Developer', description: 'System maintenance and technical operations', permissions: [
    'dashboard.view', 'settings.view', 'settings.manage', 'providers.view', 'providers.manage',
    'audit.view', 'system_health.view',
  ]},
];

// Add risk permissions
ADMIN_PERMISSIONS.push(
  { key: 'risk.view', name: 'View Risk Events', category: 'fraud', description: 'Can view risk events' },
  { key: 'risk.manage', name: 'Manage Risk', category: 'fraud', description: 'Can manage risk events' },
  { key: 'system_health.view', name: 'View System Health', category: 'system', description: 'Can view system health' },
);

async function seedAdminSystem(prisma) {
  // Seed roles
  for (const roleDef of ADMIN_ROLES) {
    const existing = await prisma.adminRole.findUnique({ where: { name: roleDef.name } });
    if (!existing) {
      const role = await prisma.adminRole.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        }
      });
      // Seed permissions for this role
      for (const permKey of roleDef.permissions) {
        const perm = ADMIN_PERMISSIONS.find(p => p.key === permKey);
        if (perm) {
          await prisma.adminPermission.upsert({
            where: { key: perm.key },
            update: {},
            create: {
              key: perm.key,
              name: perm.name,
              description: perm.description,
              category: perm.category,
            }
          });
          await prisma.adminRolePermission.create({
            data: {
              roleId: role.id,
              permissionId: (await prisma.adminPermission.findUnique({ where: { key: perm.key } })).id,
            }
          });
        }
      }
    }
  }

  // Seed all permissions
  for (const perm of ADMIN_PERMISSIONS) {
    await prisma.adminPermission.upsert({
      where: { key: perm.key },
      update: {},
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description,
        category: perm.category,
      }
    });
  }
}

// Admin authentication helpers
function adminToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(req) {
  var cookies = {};
  var cookieHeader = req.headers.cookie;
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(function (c) {
    c = c.trim();
    if (!c) return;
    var idx = c.indexOf('=');
    if (idx > 0) {
      cookies[c.slice(0, idx)] = decodeURIComponent(c.slice(idx + 1));
    }
  });
  return cookies;
}

function getAdminSessionToken(req) {
  var cookies = parseCookies(req);
  return cookies.admin_session || req.headers['x-admin-token'];
}

async function getAdminUser(prisma, req) {
  var token = getAdminSessionToken(req);
  if (!token) return null;

  try {
    var session = await prisma.adminSession.findUnique({
      where: { id: token },
      include: { adminUser: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.adminSession.delete({ where: { id: session.id } });
      return null;
    }

    // Update last active
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return session.adminUser;
  } catch (err) {
    return null;
  }
}

// Get admin user with permissions
async function getAdminUserWithPermissions(prisma, req) {
  var adminUser = await getAdminUser(prisma, req);
  if (!adminUser) return null;

  // Fetch role and permissions
  var role = await prisma.adminRole.findUnique({
    where: { id: adminUser.roleId },
    include: { permissions: { include: { permission: true } } },
  });

  var permissions = [];
  if (role) {
    permissions = role.permissions.map(rp => rp.permission.key);
  }

  // Super Admin gets all permissions
  if (role && role.name === 'Super Admin') {
    permissions = ADMIN_PERMISSIONS.map(p => p.key);
  }

  return { ...adminUser, role: role?.name || null, permissions };
}

function hasPermission(adminUser, permissionKey) {
  if (!adminUser) return false;
  if (adminUser.role === 'Super Admin') return true;
  return adminUser.permissions && adminUser.permissions.includes(permissionKey);
}

// Middleware: Require admin authentication
function requireAdmin(prisma) {
  return async function (req, res, next) {
    var adminUser = await getAdminUserWithPermissions(prisma, req);
    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }
    if (!adminUser.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is suspended' });
    }
    req.adminUser = adminUser;
    next();
  };
}

// Middleware: Require specific permission
function requirePermission(prisma, permissionKey) {
  return async function (req, res, next) {
    var adminUser = await getAdminUserWithPermissions(prisma, req);
    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }
    if (!adminUser.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is suspended' });
    }
    if (!hasPermission(adminUser, permissionKey)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions: ' + permissionKey });
    }
    req.adminUser = adminUser;
    next();
  };
}

// Settings helpers - database is authoritative
async function getSetting(prisma, key, defaultValue = null) {
  try {
    var setting = await prisma.platformSetting.findUnique({ where: { key: key } });
    if (setting) {
      // Parse value based on type
      if (setting.type === 'int') return parseInt(setting.value) || 0;
      if (setting.type === 'float') return parseFloat(setting.value) || 0;
      if (setting.type === 'boolean') return setting.value === 'true';
      if (setting.type === 'json') return setting.value ? JSON.parse(setting.value) : null;
      return setting.value !== null ? setting.value : defaultValue;
    }
  } catch (err) {
    console.error('getSetting error:', err.message);
  }
  return defaultValue;
}

async function getAllSettings(prisma) {
  var settings = await prisma.platformSetting.findMany();
  var result = {};
  settings.forEach(s => {
    if (s.type === 'int') result[s.key] = parseInt(s.value) || 0;
    else if (s.type === 'float') result[s.key] = parseFloat(s.value) || 0;
    else if (s.type === 'boolean') result[s.key] = s.value === 'true';
    else if (s.type === 'json') result[s.key] = s.value ? JSON.parse(s.value) : null;
    else result[s.key] = s.value;
  });
  return result;
}

async function setSetting(prisma, key, value, type = 'string', category = 'general', description = null, adminUserId = null, reason = null) {
  var serialized = value;
  if (type === 'json') {
    serialized = typeof value === 'string' ? value : JSON.stringify(value);
  } else if (type === 'boolean') {
    serialized = String(value);
  } else if (type === 'int') {
    serialized = String(value);
  } else if (type === 'float') {
    serialized = String(value);
  }

  var result = await prisma.platformSetting.upsert({
    where: { key: key },
    update: {
      value: serialized,
      type: type,
      category: category,
      description: description || undefined,
      updatedBy: adminUserId || undefined,
      updatedAt: new Date(),
    },
    create: {
      key: key,
      value: serialized,
      type: type,
      category: category,
      description: description || undefined,
      defaultValue: serialized,
      updatedBy: adminUserId || undefined,
    }
  });

  // Record history
  await prisma.settingHistory.create({
    data: {
      settingId: result.id,
      value: serialized,
      updatedBy: adminUserId || null,
      reason: reason || null,
    }
  });

  return result;
}

// Audit logging
async function auditLog(prisma, action, target = null, targetId = null, previousValue = null, newValue = null, reason = null, req = null) {
  try {
    var adminUserId = req?.adminUser?.id || null;
    var ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
    var userAgent = req ? (req.headers['user-agent'] || null) : null;

    await prisma.auditLog.create({
      data: {
        adminUserId: adminUserId,
        action: action,
        target: target,
        targetId: targetId,
        previousValue: previousValue ? (typeof previousValue === 'string' ? previousValue : JSON.stringify(previousValue)) : undefined,
        newValue: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : undefined,
        reason: reason,
        ipAddress: ipAddress,
        userAgent: userAgent,
      }
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// Hash admin password
function hashAdminPassword(password) {
  var salt = crypto.randomBytes(16);
  var hash = crypto.scryptSync(password, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

function verifyAdminPassword(password, stored) {
  if (!stored) return false;
  var parts = stored.split(':');
  if (parts.length !== 2) return false;
  var salt = Buffer.from(parts[0], 'hex');
  var hash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(parts[1], 'hex'));
}

export {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  seedAdminSystem,
  adminToken,
  getAdminSessionToken,
  getAdminUser,
  getAdminUserWithPermissions,
  hasPermission,
  requireAdmin,
  requirePermission,
  getSetting,
  getAllSettings,
  setSetting,
  auditLog,
  hashAdminPassword,
  verifyAdminPassword,
};