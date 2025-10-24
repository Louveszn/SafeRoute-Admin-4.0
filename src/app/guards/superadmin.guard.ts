import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { firstValueFrom, timeout } from 'rxjs';

async function isSuperAdmin(fs: Firestore, uid: string): Promise<boolean> {
  const adminsRef = collection(fs, 'admins');
  const q = query(adminsRef,
    where('uid', '==', uid),
    where('role', '==', 'superadmin')
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export const superAdminCanMatch: CanMatchFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const auth = inject(Auth);
  const fs = inject(Firestore);

  const user = await firstValueFrom(authState(auth).pipe(timeout({ first: 4000 }))).catch(() => null);
  if (!user) return router.parseUrl('/login');

  const ok = await isSuperAdmin(fs, user.uid);
  return ok ? true : router.parseUrl('/zones');
};
