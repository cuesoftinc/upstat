
export interface TotalUsersPoint {
  label: string;
  current: number; 
  previous: number; 
};

export interface TotalUsersResponse {
  points: TotalUsersPoint[];
  latest: {
    label: string;
    value: number;
  };
}