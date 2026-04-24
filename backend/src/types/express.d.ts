import { UserContext } from './index.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}
