import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl =
  process.env.UAT_API_BASE_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? '3000'}/api/v1`;
const adminEmail =
  process.env.E2_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword =
  process.env.E2_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD;
const explicitProjectId = (process.env.E2_PROJECT_ID ?? '').trim();

const personas = [
  { key: 'NANCY', label: 'Nancy', role: 'Accounting Manager', projectActor: true },
  { key: 'BEN', label: 'Ben', role: 'General Manager', projectActor: true },
  { key: 'KHAIMOOK', label: 'Khaimook', role: 'Project Manager / Head of Store', projectActor: true },
  { key: 'JAI', label: 'Jai', role: 'Purchasing Staff', projectActor: true },
  { key: 'STORE_SITE', label: 'Store Site', role: 'Store Staff', projectActor: true },
  { key: 'FOREMAN', label: 'Foreman', role: 'Site Foreman', projectActor: true },
  { key: 'PORN', label: 'Porn', role: 'Accounting Staff', projectActor: true },
  { key: 'KOH', label: 'Koh', role: 'HR Staff', projectActor: false },
];

const requiredApprovalEntityTypes = [
  'PURCHASE_REQUEST',
  'PURCHASE_ORDER',
  'SUPPLIER_INVOICE',
  'PAYMENT',
  'SUBCONTRACT_AGREEMENT',
  'SUBCONTRACT_CERTIFICATION',
  'BUDGET_REVISION',
  'PROJECT_VARIATION',
];

const report = {
  schema: 'construction-erp-v1.1-e2-readiness-v1',
  generatedAt: new Date().toISOString(),
  baseUrl,
  status: 'BLOCKED',
  companyId: null,
  project: null,
  admin: null,
  personas: [],
  approvalWorkflows: [],
  blocked: [],
  warnings: [],
};

function block(code, detail) {
  report.blocked.push({ code, detail });
}

function warn(code, detail) {
  report.warnings.push({ code, detail });
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie');
  if (!raw) throw new Error('Login response did not set a session cookie.');
  const cookie = raw.split(';', 1)[0];
  if (!cookie.startsWith('erp_session=')) {
    throw new Error('Unexpected session cookie returned by API.');
  }
  return cookie;
}

async function readBody(response) {
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json();
  const text = await response.text();
  return text ? { raw: text } : null;
}

async function login(email, password) {
  const response = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Administrator login failed with HTTP ${response.status}.`);
  }
  return {
    cookie: cookieFrom(response),
    csrfToken: body?.data?.csrfToken,
  };
}

async function request(session, path, { method = 'GET', json, expected = 200 } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (session?.cookie) headers.set('Cookie', session.cookie);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (
    session?.csrfToken &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    headers.set('X-CSRF-Token', session.csrfToken);
  }
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const body = await readBody(response);
  if (response.status !== expected) {
    const detail =
      body && typeof body === 'object' ? JSON.stringify(body) : String(body ?? '');
    throw new Error(
      `${method} ${path} expected ${expected}, got ${response.status}: ${detail}`,
    );
  }
  return body;
}

async function logout(session) {
  if (!session?.cookie || !session?.csrfToken) return;
  try {
    await request(session, '/auth/logout', { method: 'POST', expected: 204 });
  } catch {
    warn('ADMIN_LOGOUT_FAILED', 'Readiness checks completed but administrator logout could not be confirmed.');
  }
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function userRoleCodes(user) {
  return (user.userRoles ?? [])
    .map((entry) => entry?.role)
    .filter(Boolean)
    .filter((role) => role.isActive !== false)
    .map((role) => role.roleCode)
    .sort();
}

function rolePermissionCodes(roleIds, rolesById) {
  return [
    ...new Set(
      roleIds.flatMap((roleId) =>
        (rolesById.get(roleId)?.rolePermissions ?? [])
          .map((entry) => entry?.permission?.permissionCode)
          .filter(Boolean),
      ),
    ),
  ].sort();
}

async function persist() {
  const text = JSON.stringify(report, null, 2) + '\n';
  process.stdout.write(text);
  if (process.env.UAT_DATA_ROOT) {
    const evidenceDir = join(process.env.UAT_DATA_ROOT, 'evidence');
    await mkdir(evidenceDir, { recursive: true });
    const outputPath = join(evidenceDir, 'v1.1-e2-readiness.json');
    await writeFile(outputPath, text, { mode: 0o600 });
    process.stderr.write(`E2 readiness evidence written to ${outputPath}\n`);
  }
}

let session;
try {
  if (!adminEmail || !adminPassword) {
    block(
      'ADMIN_CREDENTIALS_MISSING',
      'Set E2_ADMIN_EMAIL/E2_ADMIN_PASSWORD or valid BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD in the ignored local UAT environment.',
    );
    await persist();
    process.exitCode = 2;
  } else {
    session = await login(adminEmail, adminPassword);
    const me = (await request(session, '/auth/me'))?.data;
    if (!me?.id || !me?.companyId) {
      throw new Error('Authenticated administrator identity response is incomplete.');
    }
    report.companyId = me.companyId;
    report.admin = {
      id: me.id,
      email: me.email,
      displayName: me.displayName,
      roleCodes: [...(me.roleCodes ?? [])].sort(),
      permissionCount: (me.permissions ?? []).length,
    };

    const [
      usersBody,
      rolesBody,
      workflowsBody,
      employeesBody,
      projectsBody,
    ] = await Promise.all([
      request(session, '/admin/users'),
      request(session, '/admin/roles'),
      request(session, '/admin/approval-workflows'),
      request(session, '/admin/user-employee-options'),
      request(session, '/projects?active=true'),
    ]);

    const users = usersBody?.data ?? [];
    const roles = rolesBody?.data ?? [];
    const workflows = workflowsBody?.data ?? [];
    const employees = employeesBody?.data ?? [];
    const projects = projectsBody?.data ?? [];

    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    const usersByEmail = new Map(
      users.map((user) => [normalizeEmail(user.email), user]),
    );

    const configuredEmails = new Map();
    const projectActorEmployeeIds = [];

    for (const persona of personas) {
      const envKey = `E2_${persona.key}_EMAIL`;
      const email = normalizeEmail(process.env[envKey]);
      const item = {
        key: persona.key,
        label: persona.label,
        businessRole: persona.role,
        configuredEmail: email || null,
        userId: null,
        active: false,
        employeeId: null,
        employeeCode: null,
        roleCodes: [],
        permissionCodes: [],
        projectActor: persona.projectActor,
      };

      if (!email) {
        block(
          'PERSONA_EMAIL_MISSING',
          `${persona.label}: set ${envKey} in deploy/uat/.env to the exact UAT account email.`,
        );
        report.personas.push(item);
        continue;
      }

      if (configuredEmails.has(email)) {
        block(
          'PERSONA_ACCOUNT_REUSED',
          `${persona.label} and ${configuredEmails.get(email)} map to the same account ${email}; E2 requires eight separate authenticated users.`,
        );
      } else {
        configuredEmails.set(email, persona.label);
      }

      if (email === normalizeEmail(adminEmail)) {
        block(
          'BUSINESS_PERSONA_IS_ADMIN',
          `${persona.label} maps to the E2 administrator account; SYS_ADMIN/technical administration cannot substitute for a business persona.`,
        );
      }

      const user = usersByEmail.get(email);
      if (!user) {
        block('PERSONA_USER_NOT_FOUND', `${persona.label}: no Company user exists for ${email}.`);
        report.personas.push(item);
        continue;
      }

      item.userId = user.id;
      item.active = user.isActive === true;
      item.employeeId = user.employeeId ?? null;
      item.roleCodes = userRoleCodes(user);

      const roleIds = (user.userRoles ?? [])
        .map((entry) => entry?.role)
        .filter((role) => role && role.isActive !== false)
        .map((role) => role.id);
      item.permissionCodes = rolePermissionCodes(roleIds, rolesById);

      if (!item.active) {
        block('PERSONA_USER_INACTIVE', `${persona.label}: user ${email} is inactive.`);
      }
      if (item.roleCodes.length === 0) {
        block('PERSONA_ROLE_MISSING', `${persona.label}: user ${email} has no active Role assignment.`);
      }
      if (item.roleCodes.includes('SYS_ADMIN')) {
        block(
          'BUSINESS_PERSONA_SYS_ADMIN_ROLE',
          `${persona.label}: user ${email} carries SYS_ADMIN; a technical admin role cannot be used as business UAT authority.`,
        );
      }

      if (persona.projectActor) {
        if (!item.employeeId) {
          block(
            'PERSONA_EMPLOYEE_LINK_MISSING',
            `${persona.label}: Project-journey user ${email} is not linked to an active Employee.`,
          );
        } else {
          const employee = employeesById.get(item.employeeId);
          if (!employee) {
            block(
              'PERSONA_EMPLOYEE_INACTIVE_OR_CROSS_COMPANY',
              `${persona.label}: linked Employee ${item.employeeId} is not an active same-Company Employee option.`,
            );
          } else {
            item.employeeCode = employee.employeeCode;
            projectActorEmployeeIds.push({
              label: persona.label,
              employeeId: item.employeeId,
            });
          }
        }
      } else if (item.employeeId) {
        const employee = employeesById.get(item.employeeId);
        item.employeeCode = employee?.employeeCode ?? null;
        if (!employee) {
          warn(
            'OPTIONAL_EMPLOYEE_LINK_NOT_ACTIVE',
            `${persona.label}: linked Employee is not currently an active same-Company option.`,
          );
        }
      }

      report.personas.push(item);
    }

    if (!explicitProjectId) {
      block(
        'E2_PROJECT_ID_MISSING',
        'Set E2_PROJECT_ID in deploy/uat/.env to the exact active Project used for all three canonical UAT journeys.',
      );
      report.project = {
        configuredProjectId: null,
        availableProjects: projects.map((project) => ({
          id: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
        })),
      };
    } else {
      const project = projects.find((item) => item.id === explicitProjectId);
      if (!project) {
        block(
          'E2_PROJECT_NOT_ACCESSIBLE',
          `Configured E2_PROJECT_ID ${explicitProjectId} is not an active accessible Project for the administrator.`,
        );
        report.project = { configuredProjectId: explicitProjectId };
      } else {
        const membersBody = await request(
          session,
          `/projects/${encodeURIComponent(explicitProjectId)}/members`,
        );
        const members = membersBody?.data ?? [];
        const activeMemberEmployeeIds = new Set(
          members
            .filter((member) => member.isActive !== false)
            .map((member) => member.employeeId),
        );
        const missingMembers = projectActorEmployeeIds.filter(
          (actor) => !activeMemberEmployeeIds.has(actor.employeeId),
        );
        for (const actor of missingMembers) {
          block(
            'PROJECT_MEMBERSHIP_MISSING',
            `${actor.label}: linked Employee is not an active member of Project ${project.projectCode ?? explicitProjectId}.`,
          );
        }
        report.project = {
          id: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          activeMemberCount: activeMemberEmployeeIds.size,
          requiredActorMembershipsPresent:
            missingMembers.length === 0 &&
            projectActorEmployeeIds.length ===
              personas.filter((persona) => persona.projectActor).length,
        };
      }
    }

    const activeWorkflows = workflows.filter(
      (workflow) => workflow.isActive !== false,
    );
    for (const entityType of requiredApprovalEntityTypes) {
      const matches = activeWorkflows.filter(
        (workflow) => workflow.entityType === entityType,
      );
      const executable = matches.filter((workflow) => {
        const steps = workflow.steps ?? [];
        return (
          steps.length > 0 &&
          steps.every((step) => {
            const activeRoleCount = new Set(
              (step.stepRoles ?? [])
                .map((entry) => entry?.role)
                .filter((role) => role && role.isActive !== false)
                .map((role) => role.id),
            ).size;
            return (
              Number.isInteger(step.requiredApprovals) &&
              step.requiredApprovals >= 1 &&
              activeRoleCount >= step.requiredApprovals
            );
          })
        );
      });
      report.approvalWorkflows.push({
        entityType,
        configured: executable.length > 0,
        workflowCodes: matches.map((workflow) => workflow.workflowCode).sort(),
        executableWorkflowCodes: executable
          .map((workflow) => workflow.workflowCode)
          .sort(),
      });
      if (matches.length === 0) {
        block(
          'APPROVAL_WORKFLOW_MISSING',
          `No active Approval Matrix workflow is configured for ${entityType}.`,
        );
      } else if (executable.length === 0) {
        block(
          'APPROVAL_WORKFLOW_NOT_EXECUTABLE',
          `Active Approval Matrix workflows for ${entityType} do not have enough active Role assignments on every approval step.`,
        );
      }
    }

    if (report.blocked.length === 0) {
      report.status = 'READY_FOR_INTERACTIVE_UAT';
    }

    await logout(session);
    await persist();
    process.exitCode = report.status === 'READY_FOR_INTERACTIVE_UAT' ? 0 : 2;
  }
} catch (error) {
  block(
    'READINESS_CHECK_ERROR',
    error instanceof Error ? error.message : String(error),
  );
  try {
    await logout(session);
  } catch {}
  await persist();
  process.exitCode = 1;
}
