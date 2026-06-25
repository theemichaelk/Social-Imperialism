const { prisma } = require('@si/db');

function isLogicalCampaignId(projectId) {
  return !projectId || String(projectId).startsWith('camp_');
}

async function ensureDefaultProject(orgId) {
  let project = await prisma.project.findFirst({
    where: { organizationId: orgId, isActive: true },
  });
  if (!project) {
    project = await prisma.project.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (project) return project;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  project = await prisma.project.create({
    data: {
      organizationId: orgId,
      name: 'Default Campaign',
      brandName: org?.name || 'My Brand',
      isActive: true,
    },
  });
  console.info(`Created default project ${project.id} for org ${orgId}`);
  return project;
}

async function resolveActiveProject(orgId, projectId) {
  if (!isLogicalCampaignId(projectId)) {
    const match = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (match) return match;
    console.warn(`Stale project id ${projectId} for org ${orgId} — using default project`);
  }
  return ensureDefaultProject(orgId);
}

module.exports = { ensureDefaultProject, resolveActiveProject, isLogicalCampaignId };