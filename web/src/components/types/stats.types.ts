
export interface StatCardData {
  id: string;
  label: string;
  value: number;
  change: number;     
  format?: "number" | "compact"; 
}