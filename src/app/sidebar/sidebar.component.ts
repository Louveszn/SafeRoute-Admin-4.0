import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { getAuth, signOut } from 'firebase/auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnDestroy {
  loggingOut = false;
  private forceNavTimer?: any;

  constructor(
    private router: Router,
    private loadingCtrl: LoadingController,
    private toast: ToastController
  ) {}

  async logout() {
    if (this.loggingOut) return;
    this.loggingOut = true;

    // 2) Kick off signOut (don’t block UI on slow networks)
    const auth = getAuth();
    const signOutPromise = signOut(auth).catch(() => { /* swallow, we hard-fallback */ });

    // 3) Clear local state fast (non-blocking)
    const localCleanup = Promise.resolve().then(() => {
      try {
        const keys = ['barangay', 'userRole', 'email'];
        keys.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch {}
    });

    // 4) Navigate to login right away for snappy UX
    const navPromise = this.router.navigateByUrl('/login', { replaceUrl: true });

    // 5) Cap perceived wait: race all with a short timeout
    await Promise.race([
      Promise.allSettled([signOutPromise, localCleanup, navPromise]),
      new Promise(res => setTimeout(res, 800)), // ~0.8s cap
    ]);

    // 7) Hard fallback in case router didn’t move (rare)
    this.forceNavTimer = setTimeout(() => {
      if (location.pathname !== '/login') {
        // Force a clean state & redirect
        window.location.replace('/login');
      }
    }, 1200);
  }

  ngOnDestroy(): void {
    if (this.forceNavTimer) clearTimeout(this.forceNavTimer);
  }
}
