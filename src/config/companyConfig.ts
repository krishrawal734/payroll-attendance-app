// Company details printed on payslips and reports. Set these in .env:
// EXPO_PUBLIC_COMPANY_NAME, EXPO_PUBLIC_COMPANY_ADDRESS, EXPO_PUBLIC_COMPANY_GSTIN
export const COMPANY = {
  name: process.env.EXPO_PUBLIC_COMPANY_NAME || 'WorkPulse',
  address: process.env.EXPO_PUBLIC_COMPANY_ADDRESS || '',
  gstin: process.env.EXPO_PUBLIC_COMPANY_GSTIN || '',
};

// "Address • GSTIN: X", leaving out whichever parts are not set.
export function companySubline(): string {
  return [COMPANY.address, COMPANY.gstin && `GSTIN: ${COMPANY.gstin}`].filter(Boolean).join(' • ');
}
