import { executionsTempDir, FileForgeData } from 'file-forge'
import fs from 'fs-extra'
import { globStream } from 'glob'
import { basename, join } from 'path'
import { lock } from 'proper-lockfile'

let cleanupPromise: Promise<void> | undefined

export function cleanup() {
    cleanupPromise = cleanupInternal()
        .then(() => {
            cleanupPromise = undefined
        })
}

export async function waitForCleanup() {
    if (cleanupPromise) {
        await cleanupPromise
    }
}
async function cleanupInternal() {
    await cleanUpExecutions()
    await cleanupRepositories()
}

async function cleanUpExecutions() {
    const directories = globStream('*/', {
        absolute: true,
        cwd: executionsTempDir,
        stat: true,
    })

    for await (const directory of directories) {
        const lockPath = join(directory, '.lock')

        if (!await fs.exists(lockPath)) {
            continue
        }

        let release: (() => Promise<void>) | undefined

        try {
            release = await lock(lockPath, { retries: 0 })
            release()
        } catch (error) {
            continue
        }

        try {
            await fs.rm(directory, { recursive: true })
        } catch (error) {
            console.log(`An error ocurred removing an old directory (${directory})\n\n${error}`)
        }
    }
}

async function cleanupRepositories() {
    const gitPath = FileForgeData.getGitForgesPath()
    const config = await FileForgeData.readConfig()
    const ids = new Set(config.repositories.map(e => e.id))

    const paths = globStream('*', {
        absolute: true,
        cwd: gitPath,
        stat: true,
    })

    for await (const path of paths) {
        const baseName = basename(path)
        if (ids.has(baseName)) {
            continue
        }

        await fs.rm(path, { recursive: true })
    }
}