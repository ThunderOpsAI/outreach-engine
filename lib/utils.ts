import type { GenerateOutput } from '../backend/src/types/index.js';

export function convertToCSV(output: GenerateOutput): string {
  const rows = [];
  rows.push(['Type', 'Subject/Detail', 'Body']);

  // Email
  output.email.subjects.forEach((subj, i) => {
    rows.push(['Email Subject', `Variant ${i + 1}`, subj]);
  });
  rows.push(['Email Body', 'Short', output.email.body_short]);
  rows.push(['Email Body', 'Long', output.email.body_long]);

  // LinkedIn
  rows.push(['LinkedIn', 'Connect', output.linkedin.connect]);
  rows.push(['LinkedIn', 'Follow-up 1', output.linkedin.followup_1]);
  rows.push(['LinkedIn', 'Follow-up 2', output.linkedin.followup_2]);
  rows.push(['LinkedIn', 'Follow-up 3', output.linkedin.followup_3]);

  // Follow-ups
  output.followups.forEach((fu) => {
    rows.push([`Follow-up Day ${fu.day}`, fu.subject, fu.body]);
  });

  const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;
  
  return rows.map(row => row.map(cell => escapeCSV(cell)).join(',')).join('\n');
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
