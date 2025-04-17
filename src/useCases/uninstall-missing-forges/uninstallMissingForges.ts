import { FileForgeData } from "file-forge";
import fs from 'fs-extra'
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories";

export async function uninstallMissingForges() {
    const config = await FileForgeData.readConfig()
    const forges = Object.values(config.forges)

    for (const forge of forges) {
        if (await fs.exists(forge.directory)) {
            continue
        }

        delete config.forges[forge.id]
    }

    await deleteOldRepositories(config)
    await FileForgeData.saveConfig(config)
}