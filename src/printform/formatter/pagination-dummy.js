/* eslint-disable no-console */

import { DomHelpers } from "../dom.js";
import { appendMeasuredDummyRows } from "../dummy.js";

export function attachPaginationDummyMethods(FormatterClass) {
  FormatterClass.prototype.insertFooterDummyRows = function insertFooterDummyRows(container, pageContext, currentHeight, reservedHeight) {
    if (!this.config.insertDummyRowItemWhileFormatTable) return currentHeight;
    const availableSpace = pageContext.limit - currentHeight - reservedHeight;
    appendMeasuredDummyRows(this.config, container, availableSpace, DomHelpers.measureHeightRaw);
    return this.measureContentHeight(container, pageContext.repeatingHeight);
  };
}
