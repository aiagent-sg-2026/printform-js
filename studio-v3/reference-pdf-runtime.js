import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import {observePdfWorkerErrors} from './reference-pdf-errors.js';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Dedicated local workers guarantee cancellation; never fall back to main-thread parsing.
export function createPdfRuntime() {
  const port=new PdfWorker(),errors=observePdfWorkerErrors(port);let worker;
  try { worker=new pdfjs.PDFWorker({port,verbosity:0}); } catch(error) {errors.dispose();port.terminate();throw error;}
  return {pdfjs,worker,port,errors,destroy() { errors.dispose();worker.destroy();port.terminate(); }};
}
