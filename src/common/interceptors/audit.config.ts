export interface AuditRouteConfig {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pattern: RegExp;
  entityType: string;
  action: string;
}

export const AUDIT_ROUTE_MAP: AuditRouteConfig[] = [
  // ── Auth ──────────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/auth\/register$/,
    entityType: 'User',
    action: 'REGISTER',
  },
  {
    method: 'POST',
    pattern: /\/auth\/login$/,
    entityType: 'User',
    action: 'LOGIN',
  },
  {
    method: 'POST',
    pattern: /\/auth\/logout$/,
    entityType: 'User',
    action: 'LOGOUT',
  },
  {
    method: 'POST',
    pattern: /\/auth\/refresh$/,
    entityType: 'User',
    action: 'LOGIN',
  },
  {
    method: 'POST',
    pattern: /\/auth\/change-password$/,
    entityType: 'User',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/auth\/reset-password$/,
    entityType: 'User',
    action: 'UPDATE',
  },

  // ── Users ─────────────────────────────────────────────────────────
  {
    method: 'PUT',
    pattern: /\/users\/profile$/,
    entityType: 'User',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/users\/profile$/,
    entityType: 'User',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/users\/profile$/,
    entityType: 'User',
    action: 'DELETE',
  },
  {
    method: 'PATCH',
    pattern: /\/users\/[^/]+\/status$/,
    entityType: 'User',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/users\/[^/]+\/role$/,
    entityType: 'User',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/users\/[^/]+$/,
    entityType: 'User',
    action: 'DELETE',
  },

  // ── Patients ──────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/patients\/profile$/,
    entityType: 'Patient',
    action: 'CREATE',
  },
  {
    method: 'PUT',
    pattern: /\/patients\/profile$/,
    entityType: 'Patient',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/patients\/profile$/,
    entityType: 'Patient',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/patients\/[^/]+$/,
    entityType: 'Patient',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/patients\/[^/]+$/,
    entityType: 'Patient',
    action: 'DELETE',
  },

  // ── Pharmacies ────────────────────────────────────────────────────
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+\/approve$/,
    entityType: 'Pharmacy',
    action: 'APPROVE',
  },
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+\/reject$/,
    entityType: 'Pharmacy',
    action: 'REJECT',
  },
  {
    method: 'POST',
    pattern: /\/pharmacies\/[^/]+\/employees$/,
    entityType: 'Pharmacy',
    action: 'CREATE',
  },
  {
    method: 'DELETE',
    pattern: /\/pharmacies\/[^/]+\/employees\/[^/]+$/,
    entityType: 'Pharmacy',
    action: 'DELETE',
  },
  {
    method: 'POST',
    pattern: /\/pharmacies$/,
    entityType: 'Pharmacy',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+$/,
    entityType: 'Pharmacy',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/pharmacies\/[^/]+$/,
    entityType: 'Pharmacy',
    action: 'DELETE',
  },

  // ── Inventory ─────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/pharmacies\/[^/]+\/inventory$/,
    entityType: 'Inventory',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+\/inventory\/[^/]+$/,
    entityType: 'Inventory',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/pharmacies\/[^/]+\/inventory\/[^/]+$/,
    entityType: 'Inventory',
    action: 'DELETE',
  },

  // ── Medicines ─────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/medicines$/,
    entityType: 'Medicine',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/medicines\/[^/]+$/,
    entityType: 'Medicine',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/medicines\/[^/]+$/,
    entityType: 'Medicine',
    action: 'DELETE',
  },

  // ── Categories & Manufacturers ────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/categories$/,
    entityType: 'Category',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/categories\/[^/]+$/,
    entityType: 'Category',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/categories\/[^/]+$/,
    entityType: 'Category',
    action: 'DELETE',
  },
  {
    method: 'POST',
    pattern: /\/manufacturers$/,
    entityType: 'Manufacturer',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/manufacturers\/[^/]+$/,
    entityType: 'Manufacturer',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/manufacturers\/[^/]+$/,
    entityType: 'Manufacturer',
    action: 'DELETE',
  },

  // ── Reservations ──────────────────────────────────────────────────
  {
    method: 'PATCH',
    pattern: /\/reservations\/[^/]+\/cancel$/,
    entityType: 'Reservation',
    action: 'CANCEL',
  },
  {
    method: 'PATCH',
    pattern: /\/reservations\/[^/]+\/confirm$/,
    entityType: 'Reservation',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/reservations\/[^/]+\/collect$/,
    entityType: 'Reservation',
    action: 'COMPLETE',
  },
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+\/reservations\//,
    entityType: 'Reservation',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/reservations$/,
    entityType: 'Reservation',
    action: 'CREATE',
  },

  // ── Prescriptions ─────────────────────────────────────────────────
  {
    method: 'PATCH',
    pattern: /\/prescriptions\/[^/]+\/approve$/,
    entityType: 'Prescription',
    action: 'APPROVE',
  },
  {
    method: 'PATCH',
    pattern: /\/prescriptions\/[^/]+\/reject$/,
    entityType: 'Prescription',
    action: 'REJECT',
  },
  {
    method: 'PATCH',
    pattern: /\/pharmacies\/[^/]+\/prescriptions\//,
    entityType: 'Prescription',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/prescriptions$/,
    entityType: 'Prescription',
    action: 'CREATE',
  },

  // ── Reminders ─────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/reminders\/schedules$/,
    entityType: 'ReminderSchedule',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/reminders\/logs\/[^/]+\/complete$/,
    entityType: 'ReminderSchedule',
    action: 'COMPLETE',
  },
  {
    method: 'POST',
    pattern: /\/reminders$/,
    entityType: 'ReminderSchedule',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/reminders\/[^/]+$/,
    entityType: 'ReminderSchedule',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/reminders\/[^/]+$/,
    entityType: 'ReminderSchedule',
    action: 'DELETE',
  },

  // ── Notifications ─────────────────────────────────────────────────
  {
    method: 'PATCH',
    pattern: /\/notifications\/read-all$/,
    entityType: 'Notification',
    action: 'MARK_READ',
  },
  {
    method: 'PATCH',
    pattern: /\/notifications\/[^/]+\/read$/,
    entityType: 'Notification',
    action: 'MARK_READ',
  },
  {
    method: 'DELETE',
    pattern: /\/notifications\/[^/]+$/,
    entityType: 'Notification',
    action: 'DELETE',
  },
  {
    method: 'DELETE',
    pattern: /\/notifications$/,
    entityType: 'Notification',
    action: 'DELETE',
  },

  // ── Insurance ─────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/insurance\/claims$/,
    entityType: 'InsuranceClaim',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/insurance\/claims\/[^/]+\/status$/,
    entityType: 'InsuranceClaim',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/claims\/batch-pay$/,
    entityType: 'InsuranceClaim',
    action: 'COMPLETE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/pharmacies\/agreement$/,
    entityType: 'InsuranceAgreement',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/insurance\/pharmacies\/agreements\/[^/]+$/,
    entityType: 'InsuranceAgreement',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/insurance\/pharmacy\/insurances\/[^/]+$/,
    entityType: 'InsuranceAgreement',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/tariffs$/,
    entityType: 'InsuranceTariff',
    action: 'UPDATE',
  },
  {
    method: 'PUT',
    pattern: /\/insurance\/tariffs$/,
    entityType: 'InsuranceTariff',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/tariffs\/batch$/,
    entityType: 'InsuranceTariff',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/insurance\/tariffs\/[^/]+$/,
    entityType: 'InsuranceTariff',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/pharmacies\/sync-tariffs\/[^/]+$/,
    entityType: 'InsuranceTariff',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/insurance\/providers$/,
    entityType: 'InsuranceProvider',
    action: 'CREATE',
  },
  {
    method: 'PATCH',
    pattern: /\/insurance\/providers\/[^/]+$/,
    entityType: 'InsuranceProvider',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: /\/insurance\/providers\/[^/]+$/,
    entityType: 'InsuranceProvider',
    action: 'DELETE',
  },

  // ── Admin Settings & Uploads ──────────────────────────────────────
  {
    method: 'PUT',
    pattern: /\/admin\/settings$/,
    entityType: 'SystemSetting',
    action: 'UPDATE',
  },
  {
    method: 'PATCH',
    pattern: /\/admin\/settings$/,
    entityType: 'SystemSetting',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: /\/admin\/settings$/,
    entityType: 'SystemSetting',
    action: 'CREATE',
  },
  {
    method: 'POST',
    pattern: /\/upload\//,
    entityType: 'User',
    action: 'UPLOAD',
  },

  // ── System Maintenance & Emergency Controls ────────────────────────
  {
    method: 'POST',
    pattern: /\/admin\/system\/maintenance$/,
    entityType: 'SystemStatus',
    action: 'SYSTEM_MAINTENANCE_ENABLED',
  },
  {
    method: 'POST',
    pattern: /\/admin\/system\/lockdown$/,
    entityType: 'SystemStatus',
    action: 'SYSTEM_EMERGENCY_LOCKDOWN',
  },
  {
    method: 'POST',
    pattern: /\/admin\/system\/resume$/,
    entityType: 'SystemStatus',
    action: 'SYSTEM_MAINTENANCE_DISABLED',
  },
];
