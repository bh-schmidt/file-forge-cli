import chalk from "chalk";
import { FileForgeData } from "file-forge";
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories";

export async function uninstallForge(id: string) {
    const config = await FileForgeData.readConfig()

    if (!config?.forges?.[id]) {
        console.log(chalk.red('This forge does not exist'))
        return false
    }

    delete config.forges[id]

    await deleteOldRepositories(config)
    await FileForgeData.saveConfig(config)
}