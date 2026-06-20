// FC28 data is now stored in the FC28Record database table.
// Upload via the FC28 card on the Upload page → /api/fc28/sync
// Export via /api/fc28/history (reads from DB)
// Mapping to FIN14 via /api/fin14/map-fc28 (reads from DB)

export interface FC28Row {
  "FC28 Report Date": string;
  "Child ID": number | string;
  "Child Name": string;
  "Date of Birth": string;
  "Start Date": string;
  "Enroll Date": string;
  "Billing Cycle": string;
  "Child Status": string;
  [key: string]: any;
}
