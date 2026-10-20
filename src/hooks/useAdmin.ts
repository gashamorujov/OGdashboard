import { useEffect, useState } from 'react';
import { subscribeAdmin } from '../lib/auth';

export function useAdminSession(): { isAdmin: boolean; ready: boolean } {
  const [state, setState] = useState({ isAdmin: false, ready: false });
  useEffect(() => subscribeAdmin((isAdmin) => setState({ isAdmin, ready: true })), []);
  return state;
}
