import React from "react";
import {
  WorkflowCard,
  WorkflowContainer,
  WorkflowHeader,
  WorkflowWrapper,
} from "./Workflow.styles";
import { Icon } from "@iconify/react";

const Workflow = () => {
  return (
    <WorkflowWrapper>
      <WorkflowHeader>
        Dev-first <span>workflows</span>
      </WorkflowHeader>

      <WorkflowContainer>
        {workflowData.map((ev) => (
          <WorkflowCard key={ev.id}>
            <span>{ev.icon}</span>
            <h2>{ev.header}</h2>
            <p>{ev.info}</p>
          </WorkflowCard>
        ))}
      </WorkflowContainer>
    </WorkflowWrapper>
  );
};

export default Workflow;

type workflowDataType = {
  id: number;
  icon: any;
  header: string;
  info: string;
}[];

const workflowData: workflowDataType = [
  {
    id: 1,
    icon: <Icon icon="ri:route-line" rotate={2} />,
    header: "Git-Based Control",
    info: "Synchronize with a Git repository and adopt consistent development workflows. Commit changes, review pull requests, and deploy seamlessly with your CI/CD pipeline",
  },
  {
    id: 2,
    icon: <Icon icon="carbon:enterprise" />,
    header: "Built-in Js frame",
    info: "Compose reusable code blocks in an IDE-like editor featuring built-in autocomplete, multi-line editing, debugging, and linting capabilities.",
  },
  {
    id: 3,
    icon: <Icon icon="carbon:integration" />,
    header: "Import JS libraries",
    info: "Incorporate custom JavaScript libraries to unlock advanced capabilities for intricate scenarios, such as PDF generation, CSV parsing, authentication, error logging, and beyond.",
  },
];
