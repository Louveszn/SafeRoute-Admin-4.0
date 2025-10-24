import { Component } from '@angular/core';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

type Role = 'super_admin' | 'barangay_admin';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class LoginPage {
  email = '';
  password = '';
  loading = false;
  showPassword = false;

  // Mapping for your 5 barangay admins
  private EMAIL_TO_BARANGAY: Record<string, string> = {
    'carigsur@gmail.com':   'Carig Sur, Tuguegarao City, Cagayan',
    'carignorte@gmail.com': 'Carig Norte, Tuguegarao City, Cagayan',
    'linaoeast@gmail.com':  'Linao East, Tuguegarao City, Cagayan',
    'linaowest@gmail.com':  'Linao West, Tuguegarao City, Cagayan',
    'linaonorte@gmail.com': 'Linao Norte, Tuguegarao City, Cagayan',
  };

  constructor(
    private auth: Auth,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private router: Router
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private normalizeBarangay(name: string): string {
    const s = (name || '').trim().toLowerCase();
    if (s.startsWith('carig sur')) return 'Carig Sur';
    if (s.startsWith('carig norte')) return 'Carig Norte';
    if (s.startsWith('linao east')) return 'Linao East';
    if (s.startsWith('linao west')) return 'Linao West';
    if (s.startsWith('linao norte')) return 'Linao Norte';
    return (name || '').trim();
  }

  async login() {
    if (!this.email || !this.password) {
      return this.showToast('Please enter email and password', 'warning');
    }

    this.loading = true;
    try {
      const cred = await signInWithEmailAndPassword(
        this.auth,
        this.email.trim().toLowerCase(),
        this.password
      );

      const email = (cred.user.email || '').toLowerCase();

      // 🧩 STEP 1: Super Admin check (not tied to a barangay)
      if (email === 'superadmin@gmail.com') {
        localStorage.setItem('email', email);
        localStorage.setItem('role', 'super_admin');
        localStorage.setItem('barangay', 'all'); // means access to all barangays

        await this.showToast('Welcome Super Admin!', 'success');
        this.router.navigate(['/dashboard']);
        this.loading = false;
        return;
      }

      // 🧩 STEP 2: Regular barangay admin mapping
      const longName = this.EMAIL_TO_BARANGAY[email];
      const normalized = this.normalizeBarangay(longName || '');

      if (!normalized) {
        await this.showToast('This account is not mapped to a barangay.', 'danger');
        this.loading = false;
        return;
      }

      // 🧩 STEP 3: Save login context
      localStorage.setItem('email', email);
      localStorage.setItem('role', 'barangay_admin');
      localStorage.setItem('barangay', normalized);

      console.log('[LOGIN] email:', email, 'barangay(saved):', normalized);

      await this.showToast('Welcome!', 'success');
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      console.error('Login error:', err);
      this.showToast(err?.message || 'Login failed', 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'top'
    });
    await toast.present();
  }
}