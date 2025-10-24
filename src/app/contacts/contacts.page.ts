import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ needed for [(ngModel)]
import { SidebarComponent } from '../sidebar/sidebar.component';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, startWith, BehaviorSubject } from 'rxjs';

interface EmergencyContact {
  id: string;
  name: string;
  hotline: string;
}

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, SidebarComponent],
})
export class ContactsPage implements OnInit {
  contacts$!: Observable<EmergencyContact[]>;
  filteredContacts$!: Observable<EmergencyContact[]>;
  private searchTermSubject = new BehaviorSubject<string>(''); // holds search text
  searchTerm = '';

  constructor(private firestore: Firestore, private alertCtrl: AlertController) {}

  ngOnInit() {
    const contactsRef = collection(this.firestore, 'emergency_hotlines');
    this.contacts$ = collectionData(contactsRef, {
      idField: 'id',
    }) as Observable<EmergencyContact[]>;

    // filter contacts whenever search term changes
    this.filteredContacts$ = combineLatest([
      this.contacts$,
      this.searchTermSubject.asObservable().pipe(startWith('')),
    ]).pipe(
      map(([contacts, searchTerm]) =>
        contacts.filter((c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.hotline.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }

  // called whenever input changes
  onSearchChange(term: string) {
    this.searchTermSubject.next(term);
  }

  // ➕ Add new contact
  async addContact() {
    const alert = await this.alertCtrl.create({
      header: 'Add New Contact',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Name',
        },
        {
          name: 'hotline',
          type: 'text',
          placeholder: 'Hotline',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Save',
          handler: async (data) => {
            if (data.name.trim() && data.hotline.trim()) {
              const contactsRef = collection(this.firestore, 'emergency_hotlines');
              await addDoc(contactsRef, {
                name: data.name,
                hotline: data.hotline,
              });
            }
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  // Edit contact
  async editContact(contact: EmergencyContact) {
    const alert = await this.alertCtrl.create({
      header: 'Edit Contact',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Name',
          value: contact.name,
        },
        {
          name: 'hotline',
          type: 'text',
          placeholder: 'Hotline',
          value: contact.hotline,
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Update',
          handler: async (data) => {
            if (data.name.trim() && data.hotline.trim()) {
              const contactDoc = doc(this.firestore, `emergency_hotlines/${contact.id}`);
              await updateDoc(contactDoc, {
                name: data.name,
                hotline: data.hotline,
              });
            }
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  // Confirm delete
  async confirmDelete(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this hotline?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: async () => {
            await this.deleteContact(id);
          },
        },
      ],
    });

    await alert.present();
  }

  // Delete contact
  private async deleteContact(id: string) {
    const contactDoc = doc(this.firestore, `emergency_hotlines/${id}`);
    await deleteDoc(contactDoc);
  }
}
