import prisma from "../lib/prisma";
import { hashPassword } from "./authService";


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

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  is_active?: boolean;
}

/**
 * Create a new user with hashed password
 */
export async function createUser(input: CreateUserInput) {
  const password_hash = await hashPassword(input.password);

  const user = await prisma.users.create({
    data: {
      email: input.email,
      password_hash,
      full_name: input.full_name,
      role_id: input.role_id,
      is_active: input.is_active ?? true
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      is_active: true,
      created_at: true,
      roles: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return user;
}

/**
 * Update a user's password (with hashing)
 */
export async function updateUserPassword(userId: number, newPassword: string) {
  const password_hash = await hashPassword(newPassword);

  const user = await prisma.users.update({
    where: { id: userId },
    data: { password_hash },
    select: {
      id: true,
      email: true,
      full_name: true
    }
  });

  return user;
}

/**
 * Check if an email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true }
  });
  return user !== null;
}