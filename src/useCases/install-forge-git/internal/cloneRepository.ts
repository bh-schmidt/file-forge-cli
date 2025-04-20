import chalk from "chalk";
import { execa } from "execa";
import { HyperForgeData } from "hyper-forge";
import fs from 'fs-extra';

interface CloneOptions {
    repository: string
    branch?: string
    commit?: string
}

export async function cloneRepository(options: CloneOptions, config: HyperForgeData.ConfigObject) {
    let repository = config.repositories.find(repo => {
        if (repo.repo !== options.repository)
            return false

        if (repo.branch !== options.branch)
            return false

        return repo.commit === options.commit || repo.shortCommit == options.commit
    })

    if (repository)
        return repository

    const repositoryId = crypto.randomUUID()
    const gitPath = HyperForgeData.getGitForgesPath()
    const clonePath = HyperForgeData.getGitForgesPath(repositoryId)
    await fs.ensureDir(gitPath)

    const branchFilter = options.branch ?
        [`--branch`, options.branch] :
        [];

    const { failed, stderr } = await execa(
        `git clone`,
        [
            ...branchFilter,
            options.repository,
            repositoryId
        ],
        {
            reject: false,
            cwd: gitPath,
        });

    if (failed) {
        if (await fs.exists(clonePath)) {
            await fs.rm(clonePath, { recursive: true });
        }

        console.log(chalk.red(`An error ocurred:`));
        console.log(stderr);
        return undefined
    }

    if (options.commit) {
        const { failed, stderr } = await execa(
            `git checkout`,
            [
                options.commit
            ],
            {
                reject: false,
                cwd: clonePath
            });

        if (failed) {
            await fs.rm(clonePath, { recursive: true });
            console.log(chalk.red(`An error ocurred:`));
            console.log(stderr);
            return undefined
        }
    }

    const { stdout: cBranch } = await execa('git rev-parse --abbrev-ref HEAD', { cwd: clonePath });
    const { stdout: cCommit } = await execa('git rev-parse HEAD', { cwd: clonePath });
    const { stdout: cShortCommit } = await execa('git rev-parse --short HEAD', { cwd: clonePath });

    repository = config.repositories.find(repo => repo.repo === options.repository && repo.branch === cBranch && repo.commit === cCommit)

    if (repository) {
        await fs.rm(clonePath, { recursive: true })
        return repository
    }

    repository = {
        id: repositoryId,
        repo: options.repository,
        branch: cBranch,
        commit: cCommit,
        shortCommit: cShortCommit
    };

    return repository;
}