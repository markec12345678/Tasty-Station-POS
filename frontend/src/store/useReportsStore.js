/**
 * DEPRECATED — uporabljaj useReportStore namesto tega.
 *
 * Ta datoteka je re-export wrapper za backward-compat: ReportsDashboard.jsx
 * uvozi `useReportsStore` iz te datoteke. Sedaj delegira na unified
 * useReportStore, ki vsebuje tako legacy (salesData, cashierData, ...) kot
 * modern (dashboard, categoryPerformance) report domeno.
 *
 * Prejšnje stanje: dva paralelna store-a z duplikacijo /reports/* klicev.
 */
import useReportStore from "./useReportStore";

// Re-export z istim imenom, kot ga pričakuje ReportsDashboard.jsx.
export const useReportsStore = useReportStore;

// Named default export (back-compat za `import useReportsStore from ...`).
export default useReportStore;
