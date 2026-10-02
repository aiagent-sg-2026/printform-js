import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Dedicated local workers guarantee cancellation; never fall back to main-thread parsing.
export function createPdfRuntime() {
  const port=new PdfWorker(), worker=new pdfjs.PDFWorker({port,verbosity:0});
  return {pdfjs,worker,port,destroy() { worker.destroy(); port.terminate(); }};
}
