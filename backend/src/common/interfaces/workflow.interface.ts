export interface WorkflowStep {
  order: number;
  pageTitle: string;
  url: string;
  action: string;
  screenshotPath?: string;
}

export interface IWorkflow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  videoPath?: string;
  createdAt: string;
}
