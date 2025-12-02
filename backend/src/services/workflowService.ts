import prisma from "../lib/prisma";

export async function getAllWorkflows() {
  return prisma.workflows.findMany({
    orderBy: {
      created_at: "desc",
    },
  });
}

export async function getWorkflowById(id: number) {
  return prisma.workflows.findUnique({
    where: { id },
  });
}
