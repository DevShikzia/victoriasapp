import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'captura',
    loadComponent: () => import('./features/captura/captura').then((m) => m.Captura),
    title: 'Modo captura · Victorias',
  },
  { path: '', pathMatch: 'full', redirectTo: 'captura' },
  { path: '**', redirectTo: 'captura' },
];
