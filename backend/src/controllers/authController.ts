import { Request, Response } from 'express';
import { login, getUserById, verifyToken } from '../services/authService';

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { user: AuthUser, token: string }
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await login(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/auth/me
 * Requires authentication
 * Response: { user: AuthUser }
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    // The user is set by the auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/verify
 * Body: { token: string }
 * Response: { valid: boolean, payload?: JwtPayload }
 */
export async function verifyTokenHandler(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    try {
      const payload = verifyToken(token);
      return res.json({ valid: true, payload });
    } catch {
      return res.json({ valid: false });
    }
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
