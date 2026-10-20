import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';

export function useConnection(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    const unsub = onValue(ref(db, '.info/connected'), (s) => setConnected(s.val() === true), () => setConnected(false));
    return unsub;
  }, []);
  return connected;
}
