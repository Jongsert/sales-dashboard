/* ========================================================================
   Data Parser — Multi-format import (xlsx / xls / csv / json)
   Handles Bitrix deal exports + reference mappings.
   Resilient to column reordering via header-name based mapping with aliases.
   ======================================================================== */
(function () {
  // Field definitions: aliases let users have differently-named columns.
  // First alias is "canonical" name we use internally.
  const FIELDS = {
    id:                { aliases: ['ID', 'Deal ID', 'id'], required: false },
    pipeline:          { aliases: ['Pipeline', 'Funnel', 'Sales Pipeline', 'ขั้นตอน'], required: true },
    stage:             { aliases: ['Stage', 'Status', 'Deal Stage', 'สถานะ'], required: true },
    responsible:       { aliases: ['Responsible', 'Owner', 'Sales', 'Sale Person', 'Salesperson', 'พนักงานขาย'], required: true },
    income:            { aliases: ['Income', 'Deal Value', 'Amount', 'Revenue', 'Value', 'จำนวนเงิน', 'มูลค่า'], required: true, type: 'number' },
    currency:          { aliases: ['Currency', 'สกุลเงิน'], required: false },
    created:           { aliases: ['Created', 'Created at', 'Date Created'], required: false, type: 'date' },
    customerJourney:   { aliases: ['Customer journey', 'Journey'], required: false },
    sourceChannel:     { aliases: ['Source channel', 'Source'], required: false },
    dealType:          { aliases: ['Deal Type', 'Type', 'ประเภทดีล'], required: false },
    dealSource:        { aliases: ['Deal Source'], required: false },
    productType:       { aliases: ['Product Type', 'Product', 'สินค้า'], required: false },
    company:           { aliases: ['Company', 'Customer', 'ลูกค้า'], required: false },
    contact:           { aliases: ['Contact'], required: false },
    dealName:          { aliases: ['Deal Name', 'Name', 'Title'], required: false },
    closed:            { aliases: ['Closed'], required: false },
    expectedClose:     { aliases: ['Expected close date', 'Close Date', 'Closing Date', 'Expected Date', 'วันที่ปิด'], required: true, type: 'date' },
    grossProfit:       { aliases: ['Gross Profit', 'GP'], required: false, type: 'number' },
    netProfit:         { aliases: ['Net Profit', 'NP'], required: false, type: 'number' },
    endCustomer:       { aliases: ['End Customer', 'Final Customer'], required: false },
    renewTarget:       { aliases: ['Renew Target', 'Renewal Target'], required: false, type: 'number' },
    contractStartDate: { aliases: ['Contract Start Date', 'Start Date'], required: false, type: 'date' },
    contractEndDate:   { aliases: ['Contract End Date'], required: false, type: 'date' },
    contractPeriod:    { aliases: ['Contract Period (จำนวนเดือน)', 'Contract Period'], required: false, type: 'number' },
    probability:       { aliases: ['Probability'], required: false, type: 'number' },
    salesTeam:         { aliases: ['Sales Team', 'Team'], required: false },
    project:           { aliases: ['Project'], required: false },
    repeatDeal:        { aliases: ['Repeat deal'], required: false },
    repeatInquiry:     { aliases: ['Repeat inquiry'], required: false },
    presaleName:       { aliases: ['Presale Name'], required: false },
    requestObjective:  { aliases: ['Request Objective'], required: false },
    billingType:       { aliases: ['Billing Type'], required: false },
    paymentStatus:     { aliases: ['Payment status'], required: false },
    deliveryStatus:    { aliases: ['Delivery status'], required: false },
    binding:           { aliases: ['Binding'], required: false },
    eventDate:         { aliases: ['Event Date'], required: false, type: 'date' },
    stageChangeDate:   { aliases: ['Stage change date'], required: false, type: 'date' },
    bindingDate:       { aliases: ['Bidding Date'], required: false, type: 'date' },
    mrr:               { aliases: ['MRR'], required: false, type: 'number' },
    decreaseAmount:    { aliases: ['Decrease'], required: false, type: 'number' },
    zoomAccount:       { aliases: ['Zoom Account Number'], required: false },
    zoomDetail:        { aliases: ['Detail Zoom License Activation'], required: false },
  };

  // Build header → canonical map from first row of headers
  function buildColumnMap(headers) {
    const norm = h => String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const headerMap = {};   // headerString → canonicalField
    const reverse = {};     // canonicalField → original header string
    const usedHeaders = new Set();

    Object.entries(FIELDS).forEach(([canonical, def]) => {
      for (const alias of def.aliases) {
        const aliasNorm = norm(alias);
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          if (!h) continue;
          if (usedHeaders.has(i)) continue;
          if (norm(h) === aliasNorm) {
            headerMap[h] = canonical;
            reverse[canonical] = h;
            usedHeaders.add(i);
            break;
          }
        }
        if (reverse[canonical]) break;
      }
    });
    return { headerMap, reverse };
  }

  function detectMissingRequired(reverse) {
    const missing = [];
    Object.entries(FIELDS).forEach(([canonical, def]) => {
      if (def.required && !reverse[canonical]) missing.push(canonical);
    });
    return missing;
  }

  function parseNumber(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '-' || s.toLowerCase() === '(blank)') return 0;
    const cleaned = s.replace(/[^\d.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      // Excel serial date
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
    const s = String(v).trim();
    if (!s || s === '-' || s.toLowerCase() === '(blank)') return null;
    // dd/mm/yyyy or dd-mm-yyyy
    const m1 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (m1) {
      let [, d, mo, y] = m1;
      if (y.length === 2) y = '20' + y;
      const dt = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function coerce(value, type) {
    if (type === 'number') return parseNumber(value);
    if (type === 'date') return parseDate(value);
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /* ----- Read different file formats into a 2D array ----- */
  async function readFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'json') {
      const text = await file.text();
      const obj = JSON.parse(text);
      // Detect: full settings file vs deal data array
      if (obj && obj.version && obj.newSellTargets !== undefined) {
        return { kind: 'settings', payload: obj };
      }
      if (Array.isArray(obj)) {
        return { kind: 'deals-json', payload: obj };
      }
      if (obj && Array.isArray(obj.deals)) {
        return { kind: 'deals-json', payload: obj.deals };
      }
      throw new Error('Unrecognized JSON format');
    }
    if (ext === 'csv') {
      const text = await file.text();
      const result = Papa.parse(text, { skipEmptyLines: true });
      return { kind: 'csv', payload: result.data, sheets: { 'CSV': result.data } };
    }
    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheets = {};
      wb.SheetNames.forEach(name => {
        sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
      });
      return { kind: 'xlsx', sheets, sheetNames: wb.SheetNames };
    }
    throw new Error('Unsupported file type: .' + ext);
  }

  /* ----- Auto-detect the deal sheet ----- */
  function findDealSheet(sheets, sheetNames) {
    if (!sheetNames) sheetNames = Object.keys(sheets);
    // Priority 1: name starts with "DEAL"
    let pick = sheetNames.find(n => n.toUpperCase().startsWith('DEAL'));
    if (pick) return pick;
    // Priority 2: largest sheet (most rows × cols)
    let best = null, bestSize = 0;
    sheetNames.forEach(n => {
      const rows = sheets[n] || [];
      const cols = (rows[0] || []).length;
      const size = rows.length * cols;
      if (size > bestSize) { best = n; bestSize = size; }
    });
    return best;
  }

  /* ----- Auto-detect a Ref sheet ----- */
  function findRefSheet(sheets, sheetNames) {
    if (!sheetNames) sheetNames = Object.keys(sheets);
    return sheetNames.find(n => /^ref(\b|$|[\s_-])/i.test(n.trim()));
  }

  /* ----- Parse Ref sheet (Responsible→Team, Stage→Status) ----- */
  function parseRefSheet(rows) {
    const team = {};
    const status = {};
    if (!rows || rows.length < 2) return { team, status };
    // Find columns: Responsible / Team / Stage / Status
    const header = (rows[0] || []).map(h => String(h || '').trim().toLowerCase());
    let respCol = header.findIndex(h => h === 'responsible' || h === 'sales' || h === 'owner');
    let teamCol = header.findIndex(h => h === 'team');
    let stageCol = header.findIndex(h => h === 'stage');
    let statusCol = header.findIndex(h => h === 'status');
    // Heuristic: if both team col and status col are -1, default to 0/1 and 4/5
    if (respCol === -1 && teamCol === -1) { respCol = 0; teamCol = 1; }
    if (stageCol === -1 && statusCol === -1) { stageCol = 4; statusCol = 5; }

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (respCol >= 0 && teamCol >= 0 && r[respCol] && r[teamCol]) {
        team[String(r[respCol]).trim().toLowerCase()] = String(r[teamCol]).trim();
      }
      if (stageCol >= 0 && statusCol >= 0 && r[stageCol] && r[statusCol]) {
        status[String(r[stageCol]).trim()] = String(r[statusCol]).trim();
      }
    }
    return { team, status };
  }

  /* ----- Convert deal sheet rows into normalized deal objects ----- */
  function normalizeDeals(rows, columnMap, teamMap, statusMap) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map(h => h);

    // Build header position → canonical mapping
    const positions = {};  // canonical → column index
    headers.forEach((h, i) => {
      const can = columnMap.headerMap[h];
      if (can) positions[can] = i;
    });

    const deals = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const d = { _raw: {} };
      // Pull canonical fields
      Object.entries(positions).forEach(([can, col]) => {
        const def = FIELDS[can];
        d[can] = coerce(r[col], def.type);
      });
      // Also keep original headers for the detail modal (so user can show ANY column)
      headers.forEach((h, idx) => {
        if (h !== null && h !== undefined && h !== '') {
          d._raw[h] = r[idx];
        }
      });

      // Skip empty rows
      if (!d.id && !d.pipeline && !d.dealName && !d.income) continue;

      // Apply mappings
      d.team = (d.responsible && teamMap[d.responsible.toLowerCase()]) || 'Unassigned';
      d.status = App.StatusMapping.resolve(d.stage, statusMap);

      deals.push(d);
    }
    return deals;
  }

  /* ----- Main entry: parse a file and return normalized deals ----- */
  async function parseDealFile(file, customStatusMap, customTeamMap, columnRemap) {
    const fileResult = await readFile(file);

    if (fileResult.kind === 'settings') {
      return { kind: 'settings', settings: fileResult.payload };
    }

    let rows = null;
    let refSheet = null;

    if (fileResult.kind === 'xlsx') {
      const dealSheetName = findDealSheet(fileResult.sheets, fileResult.sheetNames);
      const refSheetName = findRefSheet(fileResult.sheets, fileResult.sheetNames);
      rows = fileResult.sheets[dealSheetName];
      if (refSheetName) refSheet = fileResult.sheets[refSheetName];
    } else if (fileResult.kind === 'csv') {
      rows = fileResult.payload;
    } else if (fileResult.kind === 'deals-json') {
      // Already array of objects → convert to header+rows format
      const sample = fileResult.payload[0] || {};
      const headers = Object.keys(sample);
      rows = [headers];
      fileResult.payload.forEach(o => rows.push(headers.map(h => o[h])));
    }

    if (!rows || rows.length < 2) {
      throw new Error('No data rows found');
    }

    const headers = rows[0];
    const columnMap = buildColumnMap(headers);

    // Apply user remap (settings.json column overrides)
    if (columnRemap) {
      Object.entries(columnRemap).forEach(([canonical, headerName]) => {
        const idx = headers.findIndex(h => h === headerName);
        if (idx >= 0) {
          columnMap.headerMap[headerName] = canonical;
          columnMap.reverse[canonical] = headerName;
        }
      });
    }

    const missing = detectMissingRequired(columnMap.reverse);

    // Parse Ref sheet if found, override with custom maps
    const ref = refSheet ? parseRefSheet(refSheet) : { team: {}, status: {} };
    const teamMap = Object.assign({}, ref.team, customTeamMap || {});
    const statusMapRef = Object.assign({}, ref.status, customStatusMap || {});

    return {
      kind: 'deals',
      deals: normalizeDeals(rows, columnMap, teamMap, statusMapRef),
      headers,
      columnMap,
      missingRequired: missing,
      teamMap,
      statusMap: statusMapRef,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  window.App = window.App || {};
  window.App.DataParser = {
    FIELDS,
    parseDealFile,
    readFile,
    buildColumnMap,
    detectMissingRequired,
    parseRefSheet,
    findDealSheet,
    findRefSheet,
    parseNumber,
    parseDate,
  };
})();
