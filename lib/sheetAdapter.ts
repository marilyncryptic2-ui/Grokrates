// src/adapters/sheetAdapter.ts

export interface PoolDataRow {
  asset: string;
  venue: string;
  chain: string;
  supplyApy: number;
  borrowApy: number | null;
  ltv: number | null;
  tvlUsd: number;
  loopable: boolean;
  group: 'USD' | 'ETH' | 'BTC' | 'SOL' | '';
  source: string;
  lastUpdated: string;
}

// Paste your published Google Sheet CSV link here
const SHEET_CSV_URL = "YOUR_PUBLISHED_GOOGLESHEET_CSV_URL_HERE";

export async function fetchSheetPools(): Promise<PoolDataRow[]> {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const rows: PoolDataRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 10) continue;
      
      rows.push({
        asset: cols[0],
        venue: cols[1],
        chain: cols[2],
        supplyApy: parseFloat(cols[3]) || 0,
        borrowApy: cols[4] !== '' && cols[4] !== null ? parseFloat(cols[4]) : null,
        ltv: cols[5] !== '' && cols[5] !== null ? parseFloat(cols[5]) : null,
        tvlUsd: parseFloat(cols[6]) || 0,
        loopable: cols[7].toUpperCase() === 'YES',
        group: cols[8] as PoolDataRow['group'],
        source: cols[9],
        lastUpdated: cols[10] || new Date().toISOString()
      });
    }
    
    return rows;
  } catch (error) {
    console.error("Failed to load sheet pool data:", error);
    return [];
  }
}
