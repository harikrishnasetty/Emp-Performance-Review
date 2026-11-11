// `@next/env` is CJS without statically-analyzable named exports, so import
// the whole module and destructure rather than `import { loadEnvConfig }`.
import nextEnv from "@next/env";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  competencies,
  departments,
  goals,
  ratingScaleLevels,
  ratingScales,
  reviewCycles,
  reviewTemplates,
  templateCompetencies,
  users,
} from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/password";

nextEnv.loadEnvConfig(process.cwd());

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://meridian:meridian@localhost:5432/meridian";

// Fixed identifiers so the seed is idempotent.
const DEPTS = {
  engineering: "10000000-0000-4000-8000-000000000001",
  product: "10000000-0000-4000-8000-000000000002",
  people: "10000000-0000-4000-8000-000000000003",
  sales: "10000000-0000-4000-8000-000000000004",
};

const USERS = {
  admin: "20000000-0000-4000-8000-000000000001",
  hr: "20000000-0000-4000-8000-000000000002",
  exec: "20000000-0000-4000-8000-000000000003",
  manager1: "20000000-0000-4000-8000-000000000004",
  manager2: "20000000-0000-4000-8000-000000000005",
  ic1: "20000000-0000-4000-8000-000000000006",
  ic2: "20000000-0000-4000-8000-000000000007",
  ic3: "20000000-0000-4000-8000-000000000008",
  ic4: "20000000-0000-4000-8000-000000000009",
  ic5: "20000000-0000-4000-8000-000000000010",
};

// Local (non-SSO) test accounts — see docs/setup.md. Manager → IC hierarchy
// exists entirely among these so role-based flows (team view, reviews,
// peer feedback, 1:1s) can be exercised without touching the SSO accounts.
const LOCAL_USERS = {
  admin: "20000000-0000-4000-8000-000000000011",
  hr: "20000000-0000-4000-8000-000000000012",
  manager: "20000000-0000-4000-8000-000000000013",
  exec: "20000000-0000-4000-8000-000000000014",
  ic1: "20000000-0000-4000-8000-000000000015",
  ic2: "20000000-0000-4000-8000-000000000016",
};

const RATING_SCALE_ID = "30000000-0000-4000-8000-000000000001";
const TEMPLATE_ID = "40000000-0000-4000-8000-000000000001";
const CYCLE_ID = "50000000-0000-4000-8000-000000000001";

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  // Departments
  await db
    .insert(departments)
    .values([
      { id: DEPTS.engineering, name: "Engineering", code: "ENG", costCenter: "CC-100" },
      { id: DEPTS.product, name: "Product", code: "PRD", costCenter: "CC-200" },
      { id: DEPTS.people, name: "People & Culture", code: "PPL", costCenter: "CC-300" },
      { id: DEPTS.sales, name: "Sales & Success", code: "SLS", costCenter: "CC-400" },
    ])
    .onConflictDoNothing();

  // Users
  await db
    .insert(users)
    .values([
      {
        id: USERS.admin,
        email: "hari.setty@metricstream.com",
        displayName: "Hari Setty",
        jobTitle: "Director of Engineering",
        departmentId: DEPTS.engineering,
        systemRole: "ADMIN",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0001",
      },
      {
        id: USERS.hr,
        email: "hr.partner@metricstream.com",
        displayName: "Priya Sharma",
        jobTitle: "HR Business Partner",
        departmentId: DEPTS.people,
        systemRole: "HR",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0002",
      },
      {
        id: USERS.exec,
        email: "vp.engineering@metricstream.com",
        displayName: "Anil Rao",
        jobTitle: "VP of Engineering",
        departmentId: DEPTS.engineering,
        systemRole: "EXEC",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0003",
        managerId: null,
      },
      {
        id: USERS.manager1,
        email: "alex.manager@metricstream.com",
        displayName: "Alex Morgan",
        jobTitle: "Engineering Manager",
        departmentId: DEPTS.engineering,
        managerId: USERS.exec,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0101",
      },
      {
        id: USERS.manager2,
        email: "sam.lead@metricstream.com",
        displayName: "Sam Patel",
        jobTitle: "Tech Lead",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager1,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Pune",
        employeeCode: "MS-0102",
      },
      {
        id: USERS.ic1,
        email: "ravi.kumar@metricstream.com",
        displayName: "Ravi Kumar",
        jobTitle: "Senior Software Engineer",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager1,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0201",
      },
      {
        id: USERS.ic2,
        email: "neha.singh@metricstream.com",
        displayName: "Neha Singh",
        jobTitle: "Software Engineer",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager1,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0202",
      },
      {
        id: USERS.ic3,
        email: "arjun.mehta@metricstream.com",
        displayName: "Arjun Mehta",
        jobTitle: "Software Engineer",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager1,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Hyderabad",
        employeeCode: "MS-0203",
      },
      {
        id: USERS.ic4,
        email: "divya.rao@metricstream.com",
        displayName: "Divya Rao",
        jobTitle: "QA Engineer",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager2,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-0204",
      },
      {
        id: USERS.ic5,
        email: "karan.joshi@metricstream.com",
        displayName: "Karan Joshi",
        jobTitle: "DevOps Engineer",
        departmentId: DEPTS.engineering,
        managerId: USERS.manager2,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Pune",
        employeeCode: "MS-0205",
      },
      {
        id: LOCAL_USERS.admin,
        email: "local.admin@metricstream.com",
        displayName: "Local Admin",
        jobTitle: "Local Administrator",
        departmentId: DEPTS.engineering,
        systemRole: "ADMIN",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9001",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
      {
        id: LOCAL_USERS.hr,
        email: "local.hr@metricstream.com",
        displayName: "Local HR",
        jobTitle: "HR Business Partner (Local)",
        departmentId: DEPTS.people,
        systemRole: "HR",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9002",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
      {
        id: LOCAL_USERS.manager,
        email: "local.manager@metricstream.com",
        displayName: "Local Manager",
        jobTitle: "Engineering Manager (Local)",
        departmentId: DEPTS.engineering,
        managerId: LOCAL_USERS.exec,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9003",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
      {
        id: LOCAL_USERS.exec,
        email: "local.exec@metricstream.com",
        displayName: "Local Executive",
        jobTitle: "VP of Engineering (Local)",
        departmentId: DEPTS.engineering,
        systemRole: "EXEC",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9004",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
      {
        id: LOCAL_USERS.ic1,
        email: "local.ic1@metricstream.com",
        displayName: "Local IC One",
        jobTitle: "Software Engineer (Local)",
        departmentId: DEPTS.engineering,
        managerId: LOCAL_USERS.manager,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9005",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
      {
        id: LOCAL_USERS.ic2,
        email: "local.ic2@metricstream.com",
        displayName: "Local IC Two",
        jobTitle: "Senior Software Engineer (Local)",
        departmentId: DEPTS.engineering,
        managerId: LOCAL_USERS.manager,
        systemRole: "USER",
        status: "ACTIVE",
        location: "Bengaluru",
        employeeCode: "MS-9006",
        authProvider: "LOCAL",
        passwordHash: hashPassword("Meridian#2026!"),
        passwordChangedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // Rating scale
  await db
    .insert(ratingScales)
    .values({
      id: RATING_SCALE_ID,
      name: "5-point",
      description: "Standard five-point rating scale.",
      minValue: 1,
      maxValue: 5,
    })
    .onConflictDoNothing();

  await db
    .insert(ratingScaleLevels)
    .values([
      { scaleId: RATING_SCALE_ID, value: 1, label: "Needs improvement", description: "Below expectations", color: "#f43f5e" },
      { scaleId: RATING_SCALE_ID, value: 2, label: "Developing", description: "Partially meets expectations", color: "#fb7185" },
      { scaleId: RATING_SCALE_ID, value: 3, label: "Meets expectations", description: "Solid, reliable performance", color: "#fbbf24" },
      { scaleId: RATING_SCALE_ID, value: 4, label: "Exceeds expectations", description: "Consistently strong", color: "#4ade9b" },
      { scaleId: RATING_SCALE_ID, value: 5, label: "Outstanding", description: "Exceptional impact", color: "#22d3ee" },
    ])
    .onConflictDoNothing();

  // Competencies
  const competencyRows = [
    { name: "Delivery & execution", category: "CORE" as const, description: "Ships high-quality work on time." },
    { name: "Technical depth", category: "CORE" as const, description: "Mastery of the relevant technical domain." },
    { name: "Collaboration", category: "CORE" as const, description: "Works effectively across teams." },
    { name: "Communication", category: "CORE" as const, description: "Clear, timely and audience-aware communication." },
    { name: "Quality & craftsmanship", category: "FUNCTIONAL" as const, description: "Attention to detail and sustainable solutions." },
    { name: "Problem solving", category: "FUNCTIONAL" as const, description: "Diagnoses root causes and proposes robust fixes." },
    { name: "Customer focus", category: "FUNCTIONAL" as const, description: "Keeps the end user at the centre of decisions." },
    { name: "Mentorship", category: "LEADERSHIP" as const, description: "Grows the capability of teammates." },
    { name: "Ownership", category: "LEADERSHIP" as const, description: "Takes end-to-end responsibility for outcomes." },
    { name: "Strategic thinking", category: "LEADERSHIP" as const, description: "Connects work to broader business goals." },
    { name: "Integrity", category: "VALUES" as const, description: "Acts with honesty and accountability." },
    { name: "Inclusion", category: "VALUES" as const, description: "Fosters a respectful, diverse environment." },
  ];
  await db
    .insert(competencies)
    .values(competencyRows.map((c) => ({ ...c, isActive: true })))
    .onConflictDoNothing();

  // Resolve competency ids (either freshly inserted or existing).
  const allCompetencies = await db
    .select({ id: competencies.id, name: competencies.name })
    .from(competencies);
  const competencyIdByName = new Map(allCompetencies.map((c) => [c.name, c.id]));

  // Template
  await db
    .insert(reviewTemplates)
    .values({
      id: TEMPLATE_ID,
      name: "Standard IC review",
      description: "Balanced framework for individual contributors across engineering.",
      version: 1,
      status: "PUBLISHED",
      createdBy: USERS.hr,
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  const templateCompetencyValues = competencyRows.map((c, index) => {
    const competencyId = competencyIdByName.get(c.name);
    return {
      templateId: TEMPLATE_ID,
      competencyId: competencyId ?? null,
      name: c.name,
      description: c.description,
      category: c.category,
      weight: "1.00",
      sortOrder: index,
    };
  });
  // `template_competencies` has no natural unique key (duplicate names are
  // legal per template), so guard the insert explicitly. Without this a second
  // `db:seed` doubles every row and the template shows duplicate competencies.
  const existingTemplateCompetencies = await db
    .select({ id: templateCompetencies.id })
    .from(templateCompetencies)
    .where(eq(templateCompetencies.templateId, TEMPLATE_ID))
    .limit(1);

  if (existingTemplateCompetencies.length === 0) {
    await db.insert(templateCompetencies).values(templateCompetencyValues);
  }

  // Review cycle (draft)
  await db
    .insert(reviewCycles)
    .values({
      id: CYCLE_ID,
      name: "FY26 Annual Performance Review",
      slug: "fy26-annual-performance-review",
      type: "ANNUAL",
      status: "DRAFT",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      selfReviewDue: "2026-10-15",
      managerReviewDue: "2026-10-31",
      templateId: TEMPLATE_ID,
      ratingScaleId: RATING_SCALE_ID,
      selfReviewEnabled: true,
      peerReviewEnabled: true,
      peerReviewCount: 3,
      goalsWeight: "50.00",
      competenciesWeight: "50.00",
      departmentIds: [DEPTS.engineering],
      createdBy: USERS.hr,
    })
    .onConflictDoNothing();

  // Goals
  const goalRows = [
    { ownerId: USERS.ic1, createdBy: USERS.manager1, title: "Ship the new reporting module", category: "BUSINESS" as const, progress: 72 },
    { ownerId: USERS.ic1, createdBy: USERS.manager1, title: "Mentor two junior engineers", category: "PEOPLE" as const, progress: 40 },
    { ownerId: USERS.ic2, createdBy: USERS.manager1, title: "Reduce API latency by 30%", category: "BUSINESS" as const, progress: 85 },
    { ownerId: USERS.ic3, createdBy: USERS.manager1, title: "Complete AWS certification", category: "DEVELOPMENT" as const, progress: 60 },
    { ownerId: USERS.ic4, createdBy: USERS.manager1, title: "Automate regression suite", category: "COMPLIANCE" as const, progress: 30 },
    { ownerId: USERS.ic5, createdBy: USERS.manager1, title: "Improve deployment frequency", category: "BUSINESS" as const, progress: 90 },
    { ownerId: USERS.manager1, createdBy: USERS.exec, title: "Grow team delivery capacity", category: "PEOPLE" as const, progress: 55 },
    { ownerId: USERS.manager2, createdBy: USERS.exec, title: "Stabilise CI/CD pipeline", category: "BUSINESS" as const, progress: 78 },
    // Local (non-SSO) test accounts — give them something to see on first login.
    { ownerId: LOCAL_USERS.manager, createdBy: LOCAL_USERS.exec, title: "Grow the local team's delivery capacity", category: "PEOPLE" as const, progress: 50 },
    { ownerId: LOCAL_USERS.ic1, createdBy: LOCAL_USERS.manager, title: "Ship the onboarding revamp", category: "BUSINESS" as const, progress: 65 },
    { ownerId: LOCAL_USERS.ic2, createdBy: LOCAL_USERS.manager, title: "Reduce flaky test rate", category: "BUSINESS" as const, progress: 35 },
  ];
  await db
    .insert(goals)
    .values(
      goalRows.map((g, index) => ({
        // Fixed ids keep the seed idempotent — goals have no natural unique key,
        // so without this every `db:seed` run duplicates the whole list.
        id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        ownerId: g.ownerId,
        createdBy: g.createdBy,
        // Attach seeded goals to the demo cycle so review scoring has something
        // to weigh. `goalScoreFor()` only counts goals linked to the cycle, so
        // unlinked goals would silently score every participant at 0%.
        cycleId: CYCLE_ID,
        title: g.title,
        category: g.category,
        metricType: "PERCENT" as const,
        // Seeded goals represent a cycle already in flight: they have progress
        // and check-ins, which only makes sense once a manager has signed off.
        approvalStatus: "APPROVED" as const,
        approvalSubmittedAt: new Date("2026-01-05T09:00:00Z"),
        approvalDecidedAt: new Date("2026-01-06T09:00:00Z"),
        approvedBy: g.createdBy,
        startValue: "0",
        targetValue: "100",
        unit: "%",
        weight: "20",
        priority: "MEDIUM" as const,
        visibility: "MANAGER" as const,
        status:
          g.progress >= 80
            ? ("ON_TRACK" as const)
            : g.progress >= 50
              ? ("AT_RISK" as const)
              : ("OFF_TRACK" as const),
        progress: g.progress,
        startDate: "2026-01-01",
        dueDate: "2026-12-15",
      })),
    )
    .onConflictDoNothing();

  console.log("[seed] done");
  await pool.end();
}

main().catch((error) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
