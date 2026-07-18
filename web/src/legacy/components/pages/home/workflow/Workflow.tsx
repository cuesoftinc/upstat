"use client";
import { Icon } from "@iconify/react";

import {
  WorkflowContainer,
  WorkflowHeader,
  WorkflowTitleGreen,
  GridContainer,
  Card,
  IconCircle,
  CardTitle,
  CardDescription,
} from "./workflow.styles";

const workflows = [
  {
    icon: "ph:git-branch-bold",
    title: "Git-Based Control",
    description:
      "Synchronize with a Git repository and adopt consistent development workflows. Commit changes, review pull requests, and deploy seamlessly with your CI/CD pipeline.",
  },
  {
    icon: "ph:buildings-bold",
    title: "Built-in Js frame",
    description:
      "Compose reusable code blocks in an IDE-like editor featuring built-in autocomplete, multi-line editing, debugging, and linting capabilities.",
  },
  {
    icon: "ph:cube-bold", 
    title: "Import JS libraries",
    description:
      "Incorporate custom JavaScript libraries to unlock advanced capabilities for intricate scenarios, such as PDF generation, CSV parsing, authentication, error logging, and beyond.",
  },
];

export default function Workflow() {
  return (
    <WorkflowContainer>
      <WorkflowHeader>
        Dev-first <WorkflowTitleGreen>&nbsp;workflows</WorkflowTitleGreen>
      </WorkflowHeader>

      <GridContainer>
        {workflows.map((item, index) => (
          <Card key={index}>
            <IconCircle>
              <Icon icon={item.icon} width="24" height="24" />
            </IconCircle>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        ))}
      </GridContainer>
    </WorkflowContainer>
  );
}
