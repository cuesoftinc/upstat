import "styled-components";
import { AppTheme } from "@/libs/theme";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}