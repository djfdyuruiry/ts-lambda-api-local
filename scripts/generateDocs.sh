#! /usr/bin/env bash
set -e

projectGithubUrl="https://github.com/djfdyuruiry/ts-lambda-api-local/blob/master/src"
tlaGithubUrl="https://github.com/djfdyuruiry/ts-lambda-api/blob/master/src"
docHtmlPath="./docs/classes/apiconsoleapp.html"
projectPath="$(pwd)"

function cleanUpDocUrls() {
    sed -i "s^${projectGithubUrl}${projectPath}/node_modules/ts-lambda-api/dist/^${tlaGithubUrl}/^" "${docHtmlPath}"
    sed -i "s^${projectPath}/node_modules/ts-lambda-api/dist/^^" "${docHtmlPath}"
    sed -E -i "s/.d.ts:[0-9]+/.ts/" "${docHtmlPath}"
    sed -E -i "s/.d.ts#L[0-9]+/.ts/" "${docHtmlPath}"
}

function generateTypedoc() {
    rm -rf ./docs

    typedoc --mode file \
        --excludePrivate \
        --sourcefile-link-prefix "${projectGithubUrl}" \
        --out ./docs
}

function generateDocs() {
    generateTypedoc
    cleanUpDocUrls
}

generateDocs
