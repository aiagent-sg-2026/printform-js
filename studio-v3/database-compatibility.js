import { validateDataset } from './database-model.js';

export function legacyDatasetStatus(data) {
  try { validateDataset(data); return {supported:true,message:''}; }
  catch (error) {
    return {supported:false,message:`Legacy dataset storage and dataset JSON export require the invoice-compatible /items contract. This general form is supported by Save form / Open, Undo / Redo and Export HTML instead. ${error.message}`};
  }
}
export function assertLegacyDataset(data) {
  const status = legacyDatasetStatus(data);
  if (!status.supported) throw new Error(status.message);
}
