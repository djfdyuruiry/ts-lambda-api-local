#! /usr/bin/env bash
set -e

projectGithubUrl="https://github.com/djfdyuruiry/ts-lambda-api-local/blob/master/src"
tlaGithubUrl="https://github.com/djfdyuruiry/ts-lambda-api/blob/master/src"
projectPath="$(pwd)"
docHtmlPath="${projectPath}/docs/classes/apiconsoleapp.html"

function cleanUpDocUrls() {
    sed -i "s^${projectGithubUrl}${projectPath}/node_modules/ts-lambda-api/dist/^${tlaGithubUrl}/^g" "${docHtmlPath}"
    sed -i "s^${projectPath}/node_modules/ts-lambda-api/dist/^^g" "${docHtmlPath}"
    sed -i "s%node_modules/ts-lambda-api/dist%${tlaGithubUrl}%g" "${docHtmlPath}"
    sed -E -i "s/.d.ts:[0-9]+/.ts/" "${docHtmlPath}"
    sed -E -i "s/.d.ts#L[0-9]+/.ts/" "${docHtmlPath}"
}

function generateTypedoc() {
    rm -rf ./docs

    typedoc --entryPoints ./src/ts-lambda-api-local.ts \
        --excludePrivate \
        --includeVersion \
        --gitRevision master \
        --sourcefile-link-prefix "${projectGithubUrl}" \
        --out ./docs
}

function generateDocs() {
    generateTypedoc
    cleanUpDocUrls
}

generateDocs
