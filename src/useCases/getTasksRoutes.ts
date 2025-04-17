import { Command } from 'commander'
import { FileForgeData, PromptsHelper } from 'file-forge'
import { RouteItem } from '../types'
import { getForgeRunner } from './getForgeRunner'

export function getTasksRoutes(forge: FileForgeData.ForgeInfo, program: Command): RouteItem[] {
    const defaultIndex = forge.tasks.findIndex(e => e.default)
    const routes = forge.tasks.map(task => {
        return {
            id: task.id,
            title: task.name,
            description: task.description,
            async execute() {
                await getForgeRunner({
                    forge: forge,
                    program: program,
                    task: task,
                })

                process.exit()
            }
        } as RouteItem
    })

    if (defaultIndex > -1) {
        const defaultRoute = routes[defaultIndex]
        routes.splice(defaultIndex, 1)
        routes.unshift(defaultRoute)
    }

    return routes
}
