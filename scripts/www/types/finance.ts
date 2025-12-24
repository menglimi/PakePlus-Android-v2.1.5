
export type MortgageType = 'commercial' | 'fund' | 'combined';

export interface InterestRates {
  lpr: number;
  commercialRateFirst: number;
  commercialRateSecond: number;
  fundRateFirst5Y: number;
  fundRateFirstOver5Y: number;
  fundRateSecond5Y: number;
  fundRateSecondOver5Y: number;
}

export interface TaxConfig {
  deedTaxThreshold: number;
  vatExemptionYears: number;
  pitRate: number;
}

export interface TaxResult {
  deedTax: number;
  vat: number;
  pit: number;
  lat: number;
  annualPropTaxSelf: number;
  totalTransaction: number;
}

export interface CombinedLoan {
  commercialAmount: number;
  fundAmount: number;
}
