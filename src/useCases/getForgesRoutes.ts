import { Command } from "commander";
import { RouteItem } from "../types";
import { getTasksRoutes } from "./getTasksRoutes";
import { getForges } from "./readForges";

export async function getForgesRoutes(program: Command): Promise<RouteItem[]> {
    const forges = await getForges()
    return forges.map(forge => {
        return {
            id: forge.id,
            title: forge.name,
            description: forge.description,
            question: 'Select the task:',
            type: 'autocomplete',
            items: getTasksRoutes(forge, program),
        } as RouteItem;
    })
}