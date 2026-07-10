import "styled-components";

import { AppTheme } from "@/components/libs/theme2";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}