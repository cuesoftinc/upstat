"use client";

import {SignupContainer,
    TextContainer,
    BorderedText
} from "./not-found.styles";

export default function NotFound() {
  return (
    <SignupContainer>
      <TextContainer>
        <BorderedText>404</BorderedText>
        &nbsp;Page Not Found
        </TextContainer>
    </SignupContainer>
  );
}