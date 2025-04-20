import { HyperForgeData } from "hyper-forge"
import fs from 'fs-extra'

export async function getMissingForgesIds() {
    const config = await HyperForgeData.readConfig()
    const forges = Object.values(config.forges)

    const ids: string[] = []

    for (const forge of forges) {
        if (await fs.exists(forge.directory)) {
            continue
        }

        ids.push(forge.id)
    }

    return ids
}