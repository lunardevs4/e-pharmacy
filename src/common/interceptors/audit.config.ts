/**
 * Maps HTTP method + route path patterns to (entityType, action) pairs.
 * Patterns are tested against req.route.path (the registered route template,
 * e.g. "/api/v1/users/profile" — NOT the resolved URL with param values).
 * Rules are evaluated in order — first match wins, so put specific patterns
 * before generic ones.
 */
export interface AuditRouteConfig {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pattern: RegExp;
  entityType: string;
  action: string;
}

export const AUDIT_ROUTE_MAP: AuditRouteConfig[] = [
  // ── Auth ────────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /\/auth\/register$/,                       entityType: 'User',             action: 'REGISTER'  },
  { method: 'POST',   pattern: /\/auth\/login$/,                          entityType: 'User',             action: 'LOGIN'     },
  { method: 'POST',   pattern: /\/auth\/logout$/,                         entityType: 'User',             action: 'LOGOUT'    },
  { method: 'POST',   pattern: /\/auth\/refresh$/,                        entityType: 'User',             action: 'LOGIN'     },

  // ── Users  (PUT /api/v1/users/profile, DELETE /api/v1/users/profile) ──
  { method: 'PUT',    pattern: /\/users\/profile$/,                       entityType: 'User',             action: 'UPDATE'    },
  { method: 'PATCH',  pattern: /\/users\/profile$/,                       entityType: 'User',             action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/users\/profile$/,                       entityType: 'User',             action: 'DELETE'    },

  // ── Patients  (POST /api/v1/patients/profile, PUT /api/v1/patients/profile) ──
  { method: 'POST',   pattern: /\/patients\/profile$/,                    entityType: 'Patient',          action: 'CREATE'    },
  { method: 'PUT',    pattern: /\/patients\/profile$/,                    entityType: 'Patient',          action: 'UPDATE'    },
  { method: 'PATCH',  pattern: /\/patients\/profile$/,                    entityType: 'Patient',          action: 'UPDATE'    },

  // ── Pharmacies ──────────────────────────────────────────────────────────
  // Specific sub-routes before the generic /:id catch-all
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+\/approve$/,           entityType: 'Pharmacy',         action: 'APPROVE'   },
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+\/reject$/,            entityType: 'Pharmacy',         action: 'REJECT'    },
  { method: 'POST',   pattern: /\/pharmacies\/[^/]+\/employees$/,         entityType: 'Pharmacy',         action: 'CREATE'    },
  { method: 'DELETE', pattern: /\/pharmacies\/[^/]+\/employees\/[^/]+$/,  entityType: 'Pharmacy',         action: 'DELETE'    },
  { method: 'POST',   pattern: /\/pharmacies$/,                           entityType: 'Pharmacy',         action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+$/,                    entityType: 'Pharmacy',         action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/pharmacies\/[^/]+$/,                    entityType: 'Pharmacy',         action: 'DELETE'    },

  // ── Inventory  (base: /api/v1/pharmacies/:pharmacyId/inventory) ─────────
  { method: 'POST',   pattern: /\/pharmacies\/[^/]+\/inventory$/,         entityType: 'Inventory',        action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+\/inventory\/[^/]+$/,  entityType: 'Inventory',        action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/pharmacies\/[^/]+\/inventory\/[^/]+$/,  entityType: 'Inventory',        action: 'DELETE'    },

  // ── Medicines ───────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /\/medicines$/,                            entityType: 'Medicine',         action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/medicines\/[^/]+$/,                     entityType: 'Medicine',         action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/medicines\/[^/]+$/,                     entityType: 'Medicine',         action: 'DELETE'    },

  // ── Categories ──────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /\/categories$/,                           entityType: 'Category',         action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/categories\/[^/]+$/,                    entityType: 'Category',         action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/categories\/[^/]+$/,                    entityType: 'Category',         action: 'DELETE'    },

  // ── Manufacturers ───────────────────────────────────────────────────────
  { method: 'POST',   pattern: /\/manufacturers$/,                        entityType: 'Manufacturer',     action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/manufacturers\/[^/]+$/,                 entityType: 'Manufacturer',     action: 'UPDATE'    },
  { method: 'DELETE', pattern: /\/manufacturers\/[^/]+$/,                 entityType: 'Manufacturer',     action: 'DELETE'    },

  // ── Reservations  (base: /api/v1) ───────────────────────────────────────
  { method: 'PATCH',  pattern: /\/reservations\/[^/]+\/cancel$/,          entityType: 'Reservation',      action: 'CANCEL'    },
  { method: 'PATCH',  pattern: /\/reservations\/[^/]+\/confirm$/,         entityType: 'Reservation',      action: 'UPDATE'    },
  { method: 'PATCH',  pattern: /\/reservations\/[^/]+\/collect$/,         entityType: 'Reservation',      action: 'COMPLETE'  },
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+\/reservations\//,     entityType: 'Reservation',      action: 'UPDATE'    },
  { method: 'POST',   pattern: /\/reservations$/,                         entityType: 'Reservation',      action: 'CREATE'    },

  // ── Prescriptions  (base: /api/v1) ──────────────────────────────────────
  { method: 'PATCH',  pattern: /\/prescriptions\/[^/]+\/approve$/,        entityType: 'Prescription',     action: 'APPROVE'   },
  { method: 'PATCH',  pattern: /\/prescriptions\/[^/]+\/reject$/,         entityType: 'Prescription',     action: 'REJECT'    },
  { method: 'PATCH',  pattern: /\/pharmacies\/[^/]+\/prescriptions\//,    entityType: 'Prescription',     action: 'UPDATE'    },
  { method: 'POST',   pattern: /\/prescriptions$/,                        entityType: 'Prescription',     action: 'CREATE'    },

  // ── Reminders ───────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /\/reminders\/schedules$/,                 entityType: 'ReminderSchedule', action: 'CREATE'    },
  { method: 'PATCH',  pattern: /\/reminders\/logs\/[^/]+\/complete$/,     entityType: 'ReminderSchedule', action: 'COMPLETE'  },

  // ── Notifications ───────────────────────────────────────────────────────
  { method: 'PATCH',  pattern: /\/notifications\/read-all$/,              entityType: 'Notification',     action: 'MARK_READ' },
  { method: 'PATCH',  pattern: /\/notifications\/[^/]+\/read$/,           entityType: 'Notification',     action: 'MARK_READ' },

  // ── File uploads  (base: /api/v1/upload) ────────────────────────────────
  { method: 'POST',   pattern: /\/upload\//,                              entityType: 'User',             action: 'UPLOAD'    },
];
