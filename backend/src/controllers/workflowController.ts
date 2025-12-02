
import { Request, Response } from "express";
import { getAllWorkflows as getAllWorkflowsService,
         getWorkflowById as getWorkflowByIdService,
} from "../services/workflowService";

export async function getAllWorkflows(req: Request, res: Response) {
  try {
    const workflows = await getAllWorkflowsService();
    res.json(workflows);
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
}

export async function getWorkflowById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid workflow id" });
    }

    const workflow = await getWorkflowByIdService(id);

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json(workflow);
  } catch (error) {
    console.error("Error fetching workflow by id:", error);
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
}

