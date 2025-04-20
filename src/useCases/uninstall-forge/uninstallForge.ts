import chalk from "chalk";
import { HyperForgeData } from "hyper-forge";
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories";

export async function uninstallForge(id: string) {
    const config = await HyperForgeData.readConfig()

    if (!config?.forges?.[id]) {
        console.log(chalk.red('This forge does not exist'))
        return false
    }

    delete config.forges[id]

    await deleteOldRepositories(config)
    await HyperForgeData.saveConfig(config)
}