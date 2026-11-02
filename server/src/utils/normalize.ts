import { AppError } from '../middleware/errorHandler.js';
export function normalizePhone(input: string): string { const s=input.trim().replace(/[\s()-]/g,''); let n=s; if(/^09\d{8}$/.test(n)) n=`+251${n.slice(1)}`; else if(/^9\d{8}$/.test(n)) n=`+251${n}`; else if(/^07\d{8}$/.test(n)) n=`+251${n.slice(1)}`; else if(/^2519\d{8}$/.test(n)) n=`+${n}`; else if(/^\+2519\d{8}$/.test(n)) n=s; else throw new AppError(400,'VALIDATION_ERROR','Invalid Ethiopian phone number.'); return n; }
export const normalizeEmail = (input: string) => input.trim().toLowerCase();
