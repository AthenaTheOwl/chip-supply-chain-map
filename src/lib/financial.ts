import financialSensitivityCsv from "../data/financial_sensitivity.csv?raw";
import { parseCsv } from "./csv";

export const SENSITIVITY_BANDS = ["high", "medium", "watch"] as const;

export type SensitivityBand = (typeof SENSITIVITY_BANDS)[number];

export interface FinancialSensitivity {
  company: string;
  ticker: string;
  node_id: string;
  scenario_id: string;
  metric_name: string;
  metric_value: string;
  period: string;
  source_id: string;
  sensitivity_band: SensitivityBand;
  note: string;
}

export const financialSensitivityRecords = loadFinancialSensitivity();

export function loadFinancialSensitivity(): FinancialSensitivity[] {
  return parseCsv(financialSensitivityCsv).map(toFinancialSensitivity);
}

function toFinancialSensitivity(row: Record<string, string>): FinancialSensitivity {
  const band = row.sensitivity_band as SensitivityBand;

  if (!SENSITIVITY_BANDS.includes(band)) {
    throw new Error(
      `Invalid sensitivity band ${row.sensitivity_band} for ${row.company}`
    );
  }

  return {
    company: row.company,
    ticker: row.ticker,
    node_id: row.node_id,
    scenario_id: row.scenario_id,
    metric_name: row.metric_name,
    metric_value: row.metric_value,
    period: row.period,
    source_id: row.source_id,
    sensitivity_band: band,
    note: row.note
  };
}
