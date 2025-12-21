import { Request, Response } from 'express';
import { login, getUserById, verifyToken } from '../services/authService';
import * as auditService from '../services/auditService';
import { isRateLimited, getRemainingAttempts, getTimeUntilReset, resetRateLimit } from '../middleware/rateLimiter';

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { user: AuthUser, token: string }
 * Rate limited: 5 attempts per minute per IP/email
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check rate limit
    if (isRateLimited(clientIp, email)) {
      const retryAfter = getTimeUntilReset(clientIp, email);
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retryAfter: retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      });
    }

    const result = await login(email, password);
    if (!result) {
      const remaining = getRemainingAttempts(clientIp, email);
      return res.status(401).json({
        error: 'Invalid email or password',
        remainingAttempts: remaining
      });
    }

    // Reset rate limit on successful login
    resetRateLimit(clientIp, email);

    // Audit log successful login
    await auditService.logAuditEvent({
      eventType: 'login',
      userId: result.user.id,
      targetType: 'user',
      targetId: result.user.id,
      details: { email: result.user.email },
      ipAddress: clientIp,
      userAgent: req.get('user-agent'),
    });

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
