import chalk from 'chalk'
import { Command } from 'commander'
import { HyperForgeData } from 'hyper-forge'
import { RouteItem } from '../types'
import { getForgeRunner } from './getForgeRunner'

export function getTasksRoutes(forge: HyperForgeData.ForgeInfo, program: Command): RouteItem[] {
    const defaultIndex = forge.tasks.findIndex(e => e.default)
    const routes = forge.tasks.map(task => {
        return {
            id: task.id,
            title: task.name,
            description: task.description,
            async execute() {
                const runner = await getForgeRunner({
                    forge: forge,
                    program: program,
                    task: task,
                })

                console.log(chalk.bold(`Starting the ${chalk.cyan(task.name)} task from the ${chalk.cyan(forge.name)} forge\n`))
                await runner.run()
                console.log(chalk.green.bold('\nThe execution of your task just finished. Till next time!'))

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
