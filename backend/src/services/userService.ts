import prisma from "../lib/prisma";


type UserFilters = {
  isActive?: boolean;
  roleName?: string;
  query?: string; // for "q" search
};

/**
 * Get all users with optional filters:
 * - isActive: filter by is_active (true/false)
 * - roleName: filter by role name (e.g., "Admin")
 * - query: text search on email OR full_name
 */
export async function getAllUsers(filters: UserFilters = {}) {
  const { isActive, roleName, query } = filters;

  // We'll collect conditions here and then AND them together.
  const whereClauses: any[] = [];

  if (typeof isActive === "boolean") {
    whereClauses.push({ is_active: isActive });
  }

  if (roleName) {
    whereClauses.push({
      roles: {
        is: {
          name: roleName,
        },
      },
    });
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();

    // OR condition: match email OR full_name, case-insensitive.
    whereClauses.push({
      OR: [
        {
          email: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          full_name: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // If we have any conditions, wrap them in AND; otherwise, use an empty object.
  const where = whereClauses.length > 0 ? { AND: whereClauses } : {};

  const users = await prisma.users.findMany({
    where,
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return users;
}

/**
 * Get a single user by ID with their role.
 */
export async function getUserById(id: number) {
  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return user;
}