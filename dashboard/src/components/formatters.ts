import type { StatisticalRow } from "../types";
import { POPULATION_LABELS } from "./chartConfig";

export function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPValue(value: number) {
  return value < 0.001 ? "<0.001" : value.toFixed(3);
}

export function populationLabel(population: string) {
  return POPULATION_LABELS[population] ?? population;
}

export function titleCaseLabel(value: string | number) {
  return String(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isSignificant(row: StatisticalRow) {
  return (
    row.significant === true || String(row.significant).toLowerCase() === "true"
  );
}
