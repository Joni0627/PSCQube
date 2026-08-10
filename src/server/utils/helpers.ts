import { formatTimeHHMMSS } from "./sanitizers.js";

export function safeMatch(idA: any, idB: any): boolean {
  if (idA === undefined || idA === null || idB === undefined || idB === null) return false;
  return String(idA).trim() === String(idB).trim();
}

export function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  let strA = String(hacA).trim().toUpperCase();
  let strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  // 1. Direct match
  if (strA === strB) return true;

  // 2. Clear alphanumeric match
  const cleanA = strA.replace(/[^A-Z0-9]/g, '');
  const cleanB = strB.replace(/[^A-Z0-9]/g, '');
  if (cleanA === "" || cleanB === "") return false;
  if (cleanA === cleanB) return true;

  // 3. Bidirectional inclusion
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // 4. Prefix/mid comparison by removing "MG" or similar standard prefixes
  const looseA = cleanA.startsWith("MG") ? cleanA.slice(2) : cleanA;
  const looseB = cleanB.startsWith("MG") ? cleanB.slice(2) : cleanB;
  if (looseA === looseB || looseA.includes(looseB) || looseB.includes(looseA)) return true;

  // 5. Split and check numerical similarity (e.g., 672, 673, 674)
  const partsA = strA.split(/[\s.\-_/]+/).filter(Boolean);
  const partsB = strB.split(/[\s.\-_/]+/).filter(Boolean);

  const hasNumA = partsA.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  const hasNumB = partsB.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  
  if (hasNumA && hasNumB) {
    // Check if they share a specific suffix portion (like BT1, PZ1, AM1)
    const suffixA = partsA.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    const suffixB = partsB.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    if (suffixA && suffixB && (suffixA.includes(suffixB) || suffixB.includes(suffixA))) {
      return true;
    }
    // If one is just the group (e.g. 672) and the other is specific (e.g. 672-BT1)
    if (partsA.length === 1 || partsB.length === 1) {
      return true;
    }
  }

  return false;
}

export function formatSupabaseError(err: any): string {
  if (!err) return "unknown error";
  if (typeof err === "object") {
    const parts: string[] = [];
    if (err.message) parts.push(`Message: "${err.message}"`);
    if (err.code) parts.push(`Code: "${err.code}"`);
    if (err.details) parts.push(`Details: "${err.details}"`);
    if (err.hint) parts.push(`Hint: "${err.hint}"`);
    if (parts.length === 0) {
      try {
        return JSON.stringify(err);
      } catch (e) {
        return String(err);
      }
    }
    return parts.join(", ");
  }
  return String(err);
}

export function extractColumnFromError(message: string): string | null {
  if (!message) return null;
  // Match column "xyz" or «xyz» or 'xyz' in error messages
  const match = message.match(/column\s+["'«]([^"'»]+)["'»]/i) 
             || message.match(/["'«]([^"'»]+)["'»]\s+column/i)
             || message.match(/columna\s+["'«]([^"'»]+)["'»]/i)
             || message.match(/["'«]([^"'»]+)["'»]\s+does\s+not\s+exist/i);
  return match ? match[1] : null;
}

export const calculateDurationTime = (startStr: string, endStr: string): string => {
  try {
    const sStr = formatTimeHHMMSS(startStr);
    const eStr = formatTimeHHMMSS(endStr);
    const [sh, sm, ss] = sStr.split(":").map(Number);
    const [eh, em, es] = eStr.split(":").map(Number);
    
    let startSecs = sh * 3600 + sm * 60 + ss;
    let endSecs = eh * 3600 + em * 60 + es;
    
    let diffSecs = endSecs - startSecs;
    if (diffSecs < 0) {
      diffSecs += 24 * 3600;
    }
    
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  } catch (err) {
    return "00:00:00";
  }
};

export const durationMinutesFromHHMMSS = (timeStr: any): number => {
  if (!timeStr && timeStr !== 0) return 0;
  const str = String(timeStr).trim();
  const parts = str.split(":").map(Number);
  if (parts.length >= 2) {
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  }
  return 0;
};

export function areRecordsEqual(recordA: any, recordB: any, schemaHeaders: string[], schema: any): boolean {
  if (!recordA || !recordB) return false;

  const normalize = (v: any) => {
    if (v === undefined || v === null) return "";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") {
      const lower = v.trim().toLowerCase();
      if (lower === "true" || lower === "si" || lower === "sí" || lower === "yes") return "true";
      if (lower === "false" || lower === "no") return "false";
      if (lower.startsWith("[") || lower.startsWith("{")) {
        try {
          return JSON.stringify(JSON.parse(v.trim()));
        } catch {
          return v.trim();
        }
      }
      return v.trim();
    }
    if (typeof v === "number") {
      return String(v);
    }
    if (typeof v === "object") {
      try { return JSON.stringify(v); } catch { return ""; }
    }
    return String(v).trim();
  };

  const headers = schemaHeaders && schemaHeaders.length > 0
    ? schemaHeaders
    : Array.from(new Set([...Object.keys(recordA), ...Object.keys(recordB)]));

  for (const header of headers) {
    const key = schema && schema.sheetToClient ? schema.sheetToClient[header] || header : header;
    const valA = recordA[key] !== undefined ? recordA[key] : recordA[header];
    const valB = recordB[key] !== undefined ? recordB[key] : recordB[header];
    
    if (normalize(valA) !== normalize(valB)) {
      return false;
    }
  }
  return true;
}

export function areNozzleNewsListsEqual(listA: any[], listB: any[]): boolean {
  const arrA = Array.isArray(listA) ? listA : [];
  const arrB = Array.isArray(listB) ? listB : [];
  if (arrA.length !== arrB.length) return false;
  
  const sortedA = [...arrA].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  const sortedB = [...arrB].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  
  const normBool = (val: any) => {
    return val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1;
  };

  for (let i = 0; i < sortedA.length; i++) {
    const a = sortedA[i];
    const b = sortedB[i];
    if (
      Number(a.nozzleNumber) !== Number(b.nozzleNumber) ||
      String(a.startTime || "").trim() !== String(b.startTime || "").trim() ||
      String(a.endTime || "").trim() !== String(b.endTime || "").trim() ||
      normBool(a.isAllShift) !== normBool(b.isAllShift) ||
      String(a.observation || "").trim() !== String(b.observation || "").trim()
    ) {
      return false;
    }
  }

  return true;
}

export function areDetailsListsEqual(listA: any[], listB: any[]): boolean {
  const arrA = Array.isArray(listA) ? listA : [];
  const arrB = Array.isArray(listB) ? listB : [];
  if (arrA.length !== arrB.length) return false;

  const sortedA = [...arrA].sort((a, b) => String(a.materialId || "").localeCompare(String(b.materialId || "")));
  const sortedB = [...arrB].sort((a, b) => String(a.materialId || "").localeCompare(String(b.materialId || "")));

  for (let i = 0; i < sortedA.length; i++) {
    const a = sortedA[i];
    const b = sortedB[i];
    if (
      String(a.materialId || "").trim() !== String(b.materialId || "").trim() ||
      Number(a.bagsProduced || a.bags || 0) !== Number(b.bagsProduced || b.bags || 0) ||
      Number(a.tonsProduced || a.tons || 0) !== Number(b.tonsProduced || b.tons || 0) ||
      Number(a.bdp || a.bdp_teorico || 0) !== Number(b.bdp || b.bdp_teorico || 0) ||
      Number(a.availableNozzlesShift || 0) !== Number(b.availableNozzlesShift || 0) ||
      String(a.bagProvider || "").trim() !== String(b.bagProvider || "").trim() ||
      Number(a.discardedBagsBagger || 0) !== Number(b.discardedBagsBagger || 0) ||
      Number(a.notNozzledBags || 0) !== Number(b.notNozzledBags || 0) ||
      Number(a.discardedBagsVentocheck || 0) !== Number(b.discardedBagsVentocheck || 0) ||
      Number(a.discardedBagsTransport || 0) !== Number(b.discardedBagsTransport || 0) ||
      String(a.observacion || a.observation || "").trim() !== String(b.observacion || b.observation || "").trim()
    ) {
      return false;
    }
  }

  return true;
}

