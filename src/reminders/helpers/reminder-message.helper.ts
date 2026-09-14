export interface ReminderMessagePayload {
  patientName?: string;
  medicineName: string;
  dosage: string;
  time?: string;
}

export function buildMedicationReminderMessage(
  payload: ReminderMessagePayload,
): string {
  const greeting = payload.patientName ? `Muraho ${payload.patientName}. ` : '';
  return `${greeting}Rwanda E-Pharmacy: Time to take your ${payload.medicineName} (${payload.dosage}). Reply YES once taken.`;
}
