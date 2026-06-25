import "styled-components";
import { AppTheme } from "./theme2";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}