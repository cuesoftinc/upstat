import "styled-components";

import { AppTheme } from "@/components/libs/dashboard-theme";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}