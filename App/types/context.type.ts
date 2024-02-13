import { Dispatch, SetStateAction } from "react";
import { signUpFormProps } from "./signup.type";

export interface HomeContextProps {
  formError: string;
  setFormError: Dispatch<SetStateAction<string>>;
  formSuccess: string;
  setFormSuccess: Dispatch<SetStateAction<string>>;
  formLoading: boolean;
  setFormLoading: Dispatch<SetStateAction<boolean>>;
}
