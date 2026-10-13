/* eslint-disable no-console */

import { parseBooleanFlag, parseNumber, parseString, resolvePaperDimensions } from "./helpers.js";

  /**
   * @typedef {Object} ConfigDescriptor
   * @property {string} key Canonical configuration key used within the formatter.
   * @property {string} datasetKey Matching `data-*` attribute converted to camelCase.
   * @property {string} legacyKey Historical global variable name supported for backwards compatibility.
   * @property {*} defaultValue Fallback value when no overrides are supplied.
   * @property {Function} parser Normalizer that validates incoming values.
   */

  // Every config option lives here to unify defaults, legacy globals, and dataset parsing.
  export const CONFIG_DESCRIPTORS = [
    { key: "papersizeWidth", datasetKey: "papersizeWidth", legacyKey: "papersize_width", defaultValue: 750, parser: parseNumber },
    { key: "papersizeHeight", datasetKey: "papersizeHeight", legacyKey: "papersize_height", defaultValue: 1050, parser: parseNumber },
    { key: "paperSize", datasetKey: "paperSize", legacyKey: "paper_size", defaultValue: "", parser: parseString },
    { key: "orientation", datasetKey: "orientation", legacyKey: "orientation", defaultValue: "portrait", parser: parseString },
    { key: "dpi", datasetKey: "dpi", legacyKey: "dpi", defaultValue: 96, parser: parseNumber },
    { key: "nUp", datasetKey: "nUp", legacyKey: "n_up", defaultValue: 1, parser: parseNumber },
    {
      key: "showLogicalPageNumber",
      datasetKey: "showLogicalPageNumber",
      legacyKey: "show_logical_page_number",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "showPhysicalPageNumber",
      datasetKey: "showPhysicalPageNumber",
      legacyKey: "show_physical_page_number",
      defaultValue: false,
      parser: parseBooleanFlag
    },
    {
      key: "heightOfDummyRowItem",
      datasetKey: "heightOfDummyRowItem",
      legacyKey: "height_of_dummy_row_item",
      defaultValue: 18,
      parser: parseNumber
    },
    { key: "repeatHeader", datasetKey: "repeatHeader", legacyKey: "repeat_header", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatDocinfo", datasetKey: "repeatDocinfo", legacyKey: "repeat_docinfo", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatDocinfo002", datasetKey: "repeatDocinfo002", legacyKey: "repeat_docinfo002", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatDocinfo003", datasetKey: "repeatDocinfo003", legacyKey: "repeat_docinfo003", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatDocinfo004", datasetKey: "repeatDocinfo004", legacyKey: "repeat_docinfo004", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatDocinfo005", datasetKey: "repeatDocinfo005", legacyKey: "repeat_docinfo005", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatRowheader", datasetKey: "repeatRowheader", legacyKey: "repeat_rowheader", defaultValue: true, parser: parseBooleanFlag },
    {
      key: "repeatPtacRowheader",
      datasetKey: "repeatPtacRowheader",
      legacyKey: "repeat_ptac_rowheader",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    { key: "repeatFooter", datasetKey: "repeatFooter", legacyKey: "repeat_footer", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooter002", datasetKey: "repeatFooter002", legacyKey: "repeat_footer002", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooter003", datasetKey: "repeatFooter003", legacyKey: "repeat_footer003", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooter004", datasetKey: "repeatFooter004", legacyKey: "repeat_footer004", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooter005", datasetKey: "repeatFooter005", legacyKey: "repeat_footer005", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooterLogo", datasetKey: "repeatFooterLogo", legacyKey: "repeat_footer_logo", defaultValue: false, parser: parseBooleanFlag },
    { key: "repeatFooterPagenum", datasetKey: "repeatFooterPagenum", legacyKey: "repeat_footer_pagenum", defaultValue: false, parser: parseBooleanFlag },
    {
      key: "fillPageHeightAfterFooter",
      datasetKey: "fillPageHeightAfterFooter",
      legacyKey: "fill_page_height_after_footer",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "insertDummyRowItemWhileFormatTable",
      datasetKey: "insertDummyRowItemWhileFormatTable",
      legacyKey: "insert_dummy_row_item_while_format_table",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "insertPtacDummyRowItems",
      datasetKey: "insertPtacDummyRowItems",
      legacyKey: "insert_ptac_dummy_row_items",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "insertDummyRowWhileFormatTable",
      datasetKey: "insertDummyRowWhileFormatTable",
      legacyKey: "insert_dummy_row_while_format_table",
      defaultValue: false,
      parser: parseBooleanFlag
    },
    {
      key: "insertFooterSpacerWhileFormatTable",
      datasetKey: "insertFooterSpacerWhileFormatTable",
      legacyKey: "insert_footer_spacer_while_format_table",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "insertFooterSpacerWithDummyRowItemWhileFormatTable",
      datasetKey: "insertFooterSpacerWithDummyRowItemWhileFormatTable",
      legacyKey: "insert_footer_spacer_with_dummy_row_item_while_format_table",
      defaultValue: true,
      parser: parseBooleanFlag
    },
    {
      key: "customDummyRowItemContent",
      datasetKey: "customDummyRowItemContent",
      legacyKey: "custom_dummy_row_item_content",
      defaultValue: "",
      parser: parseString
    },
    {
      key: "customDummySpacerContent",
      datasetKey: "customDummySpacerContent",
      legacyKey: "custom_dummy_spacer_content",
      defaultValue: "",
      parser: parseString
    },
    { key: "debug", datasetKey: "debug", legacyKey: "debug_printform", defaultValue: false, parser: parseBooleanFlag }
  ];

  export const DOCINFO_VARIANTS = [
    { key: "docInfo", className: "pdocinfo", repeatFlag: "repeatDocinfo" },
    { key: "docInfo002", className: "pdocinfo002", repeatFlag: "repeatDocinfo002" },
    { key: "docInfo003", className: "pdocinfo003", repeatFlag: "repeatDocinfo003" },
    { key: "docInfo004", className: "pdocinfo004", repeatFlag: "repeatDocinfo004" },
    { key: "docInfo005", className: "pdocinfo005", repeatFlag: "repeatDocinfo005" }
  ];

  export const FOOTER_VARIANTS = [
    { key: "footer", className: "pfooter", repeatFlag: "repeatFooter" },
    { key: "footer002", className: "pfooter002", repeatFlag: "repeatFooter002" },
    { key: "footer003", className: "pfooter003", repeatFlag: "repeatFooter003" },
    { key: "footer004", className: "pfooter004", repeatFlag: "repeatFooter004" },
    { key: "footer005", className: "pfooter005", repeatFlag: "repeatFooter005" }
  ];

  export const FOOTER_LOGO_VARIANT = { key: "footerLogo", className: "pfooter_logo", repeatFlag: "repeatFooterLogo" };
  export const FOOTER_PAGENUM_VARIANT = { key: "footerPagenum", className: "pfooter_pagenum", repeatFlag: "repeatFooterPagenum" };

  export const DEFAULT_CONFIG = CONFIG_DESCRIPTORS.reduce((accumulator, descriptor) => {
    accumulator[descriptor.key] = descriptor.defaultValue;
    return accumulator;
  }, {});

  function readConfigFromLegacy(descriptors) {
    const source = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {});
    return descriptors.reduce((config, descriptor) => {
      if (!descriptor.legacyKey) return config;
      const value = source[descriptor.legacyKey];
      if (value === undefined || value === null || value === "") return config;
      config[descriptor.key] = descriptor.parser(value, descriptor.defaultValue);
      return config;
    }, {});
  }

  function readConfigFromDataset(descriptors, dataset) {
    const source = dataset || {};
    return descriptors.reduce((config, descriptor) => {
      if (!descriptor.datasetKey) return config;
      if (!Object.prototype.hasOwnProperty.call(source, descriptor.datasetKey)) return config;
      const value = source[descriptor.datasetKey];
      if (value === undefined || value === null || value === "") return config;
      config[descriptor.key] = descriptor.parser(value, descriptor.defaultValue);
      return config;
    }, {});
  }

  function getLegacyConfig() {
    return readConfigFromLegacy(CONFIG_DESCRIPTORS);
  }

  function getDatasetConfig(dataset) {
    return readConfigFromDataset(CONFIG_DESCRIPTORS, dataset);
  }

  function resolveTemplateOverride(formEl, className, fallback) {
    const template = formEl.querySelector(`template.${className}`);
    if (template) {
      return template.innerHTML.trim();
    }
    return fallback;
  }

  export function getPrintformConfig(formEl, overrides = {}) {
    const legacy = getLegacyConfig();
    const datasetConfig = getDatasetConfig(formEl.dataset || {});
    const merged = {
      ...DEFAULT_CONFIG,
      ...legacy,
      ...datasetConfig,
      ...overrides
    };
    CONFIG_DESCRIPTORS.forEach(({ key, parser, defaultValue }) => {
      merged[key] = parser(merged[key], defaultValue);
    });
    merged.customDummyRowItemContent = resolveTemplateOverride(
      formEl,
      "custom-dummy-row-item-content",
      overrides.customDummyRowItemContent !== undefined
        ? overrides.customDummyRowItemContent
        : merged.customDummyRowItemContent
    );
    merged.customDummySpacerContent = resolveTemplateOverride(
      formEl,
      "custom-dummy-spacer-content",
      overrides.customDummySpacerContent !== undefined
        ? overrides.customDummySpacerContent
        : merged.customDummySpacerContent
    );
    merged.debug = parseBooleanFlag(merged.debug, DEFAULT_CONFIG.debug);
    merged.nUp = parseNumber(merged.nUp, DEFAULT_CONFIG.nUp);
    if (!Number.isFinite(merged.nUp) || merged.nUp < 1) {
      merged.nUp = DEFAULT_CONFIG.nUp;
    }
    merged.nUp = Math.floor(merged.nUp);
    merged.showLogicalPageNumber = parseBooleanFlag(merged.showLogicalPageNumber, DEFAULT_CONFIG.showLogicalPageNumber);
    merged.showPhysicalPageNumber = parseBooleanFlag(merged.showPhysicalPageNumber, DEFAULT_CONFIG.showPhysicalPageNumber);
    merged.papersizeWidth = parseNumber(merged.papersizeWidth, DEFAULT_CONFIG.papersizeWidth);
    merged.papersizeHeight = parseNumber(merged.papersizeHeight, DEFAULT_CONFIG.papersizeHeight);
    merged.paperSize = parseString(merged.paperSize, DEFAULT_CONFIG.paperSize);
    merged.orientation = parseString(merged.orientation, DEFAULT_CONFIG.orientation);
    merged.dpi = parseNumber(merged.dpi, DEFAULT_CONFIG.dpi);
    if (!Number.isFinite(merged.dpi) || merged.dpi <= 0) merged.dpi = DEFAULT_CONFIG.dpi;
    const overrideHas = (key) => Object.prototype.hasOwnProperty.call(overrides, key) && overrides[key] !== "";
    const manualWidthProvided = Object.prototype.hasOwnProperty.call(legacy, "papersizeWidth") || Object.prototype.hasOwnProperty.call(datasetConfig, "papersizeWidth") || overrideHas("papersizeWidth");
    const manualHeightProvided = Object.prototype.hasOwnProperty.call(legacy, "papersizeHeight") || Object.prototype.hasOwnProperty.call(datasetConfig, "papersizeHeight") || overrideHas("papersizeHeight");
    if (!manualWidthProvided && !manualHeightProvided) {
      const resolved = resolvePaperDimensions({ paperSize: merged.paperSize, orientation: merged.orientation, dpi: merged.dpi });
      if (resolved) {
        merged.papersizeWidth = resolved.width;
        merged.papersizeHeight = resolved.height;
      }
    }
    ["papersizeWidth", "papersizeHeight", "heightOfDummyRowItem"].forEach((key) => {
      if (merged[key] <= 0) merged[key] = DEFAULT_CONFIG[key];
    });
    return merged;
  }

  // ===== PADDT configuration (独立配置) =====
  export const PADDT_CONFIG_DESCRIPTORS = [
    { key: "repeatPaddt", datasetKey: "repeatPaddt", legacyKey: "repeat_paddt", defaultValue: true, parser: parseBooleanFlag },
    { key: "insertPaddtDummyRowItems", datasetKey: "insertPaddtDummyRowItems", legacyKey: "insert_paddt_dummy_row_items", defaultValue: true, parser: parseBooleanFlag },
    { key: "paddtMaxWordsPerSegment", datasetKey: "paddtMaxWordsPerSegment", legacyKey: "paddt_max_words_per_segment", defaultValue: 200, parser: parseNumber },
    { key: "repeatPaddtRowheader", datasetKey: "repeatPaddtRowheader", legacyKey: "repeat_paddt_rowheader", defaultValue: true, parser: parseBooleanFlag },
    { key: "paddtDebug", datasetKey: "paddtDebug", legacyKey: "paddt_debug", defaultValue: false, parser: parseBooleanFlag },

    // PADDT-specific docinfo toggles (show/hide on PADDT pages only)
    { key: "repeatPaddtDocinfo", datasetKey: "repeatPaddtDocinfo", legacyKey: "repeat_paddt_docinfo", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatPaddtDocinfo002", datasetKey: "repeatPaddtDocinfo002", legacyKey: "repeat_paddt_docinfo002", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatPaddtDocinfo003", datasetKey: "repeatPaddtDocinfo003", legacyKey: "repeat_paddt_docinfo003", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatPaddtDocinfo004", datasetKey: "repeatPaddtDocinfo004", legacyKey: "repeat_paddt_docinfo004", defaultValue: true, parser: parseBooleanFlag },
    { key: "repeatPaddtDocinfo005", datasetKey: "repeatPaddtDocinfo005", legacyKey: "repeat_paddt_docinfo005", defaultValue: true, parser: parseBooleanFlag }
  ];

  export const DEFAULT_PADDT_CONFIG = PADDT_CONFIG_DESCRIPTORS.reduce(function(acc, d) {
    acc[d.key] = d.defaultValue;
    return acc;
  }, {});

  function getPaddtLegacyConfig() {
    return readConfigFromLegacy(PADDT_CONFIG_DESCRIPTORS);
  }

  function getPaddtDatasetConfig(dataset) {
    return readConfigFromDataset(PADDT_CONFIG_DESCRIPTORS, dataset);
  }

   /**
   * 获取 paddt 配置（与主配置独立）(中文解释: paddt 独立配置读取)
   */
  export function getPaddtConfig(formEl, overrides) {
    overrides = overrides || {};
    var legacy = getPaddtLegacyConfig();
    var datasetConfig = getPaddtDatasetConfig((formEl && formEl.dataset) || {});
    var merged = {};
    for (var k in DEFAULT_PADDT_CONFIG) { if (Object.prototype.hasOwnProperty.call(DEFAULT_PADDT_CONFIG, k)) merged[k] = DEFAULT_PADDT_CONFIG[k]; }
    for (var k1 in legacy) { if (Object.prototype.hasOwnProperty.call(legacy, k1)) merged[k1] = legacy[k1]; }
    for (var k2 in datasetConfig) { if (Object.prototype.hasOwnProperty.call(datasetConfig, k2)) merged[k2] = datasetConfig[k2]; }
    for (var k3 in overrides) { if (Object.prototype.hasOwnProperty.call(overrides, k3)) merged[k3] = overrides[k3]; }
    PADDT_CONFIG_DESCRIPTORS.forEach(({ key, parser, defaultValue }) => {
      merged[key] = parser(merged[key], defaultValue);
    });
    merged.paddtMaxWordsPerSegment = Math.floor(merged.paddtMaxWordsPerSegment);
    if (!Number.isFinite(merged.paddtMaxWordsPerSegment) || merged.paddtMaxWordsPerSegment <= 0) {
      merged.paddtMaxWordsPerSegment = DEFAULT_PADDT_CONFIG.paddtMaxWordsPerSegment;
    }
    return merged;
  }
