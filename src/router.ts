import { Command } from "commander";
import { AutoCompleteMatcher, PromptsHelper } from 'file-forge';
import prompts, { Choice } from "prompts";
import { Route, RouteItem } from "./types";
import { getForgesRoutes } from "./useCases/getForgesRoutes";
import { installFromGitPrompt } from "./useCases/install-forge-git/installFromGitPrompt";
import { getForges, readForges } from "./useCases/readForges";
import { uninstallForge } from "./useCases/uninstall-forge/uninstallForge";
import { installForgeDirectoryPrompt } from "./useCases/install-forge-directory-prompt/installForgeDirectoryPrompt";
import { getMissingForgesIds } from "./useCases/get-missing-forges-ids/getMissingForgesIds";
import { uninstallMissingForges } from "./useCases/uninstall-missing-forges/uninstallMissingForges";

export function buildRootRoute(program: Command): Route {
    return {
        id: undefined,
        title: null!,
        type: 'select',
        question: `Select an option:`,
        items: [
            {
                id: 'run',
                title: `Run a forge`,
                question: `Select the forge:`,
                type: 'autocomplete',
                items: () => getForgesRoutes(program),
            },
            {
                id: 'install-forge',
                title: 'Install forge',
                question: 'Select where the forge is stored:',
                type: 'select',
                items: [
                    {
                        id: 'git',
                        title: 'Git Repository',
                        async execute() {
                            const success = await installFromGitPrompt()
                            if (!success) {
                                await PromptsHelper.waitForKey()
                            }
                            await readForges()
                        }
                    },
                    {
                        id: 'local-directory',
                        title: 'Local Directory',
                        async execute() {
                            const success = await installForgeDirectoryPrompt()
                            if (!success) {
                                await PromptsHelper.waitForKey()
                            }
                            await readForges()
                        }
                    }
                ]
            },
            {
                id: 'uninstall-forge',
                title: 'Uninstall forge',
                question: 'Select the forge:',
                type: 'autocomplete',
                items: async () => {
                    const forges = await getForges()
                    const missingForges = await getMissingForgesIds()

                    const items: RouteItem[] = []

                    if (missingForges.length > 0) {
                        items.push({
                            id: '#missing-ids',
                            title: '* Missing Forges *',
                            description: 'Uninstall forges whose directories are missing',
                            async execute() {
                                await uninstallMissingForges()
                            }
                        })
                    }

                    for (const f of forges) {
                        const name = f.name ?
                            `${f.name} (${f.id})` :
                            f.id

                        items.push({
                            id: f.id,
                            title: name,
                            async execute() {
                                await uninstallForge(f.id)
                                await readForges()
                            }
                        })
                    }

                    return items
                }
            },
            {
                title: `Quit`,
                id: 'quit',
                execute() {
                    process.exit()
                }
            }
        ]
    }
}

export async function runRoute(route: Route) {
    while (true) {
        console.clear()

        const items = Array.isArray(route.items) ?
            route.items :
            await route.items()

        const choices: Choice[] = items.map(e => ({
            title: e.title,
            description: e.description,
            value: e.id,
        }))

        const result = await prompts({
            name: 'route-selector',
            message: route.question,
            choices: choices,
            type: route.type,
            async suggest(input, choices) {
                return await AutoCompleteMatcher.wildcardMatch(input, choices)
            },
            hint: route.type == 'select' ?
                `
Navigation: [arrow-keys, j, k]
Submit:     [enter]
Go back:    [ctrl+c]` :
                undefined
        })

        const selected = items.find(e => e.id == result["route-selector"])
        if (!selected)
            break

        if ('execute' in selected) {
            await selected.execute()
            continue
        }

        const newRoute = selected as Route
        await runRoute(newRoute)
    }
}