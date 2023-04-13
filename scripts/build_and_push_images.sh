#!/bin/bash

SFDX_VERSION=$(sfdx -v | cut -d ' ' -f 1 | cut -d '/' -f 2)
PLATFORMS='linux/arm64,linux/amd64'

echo "Building image version ${SFDX_VERSION} for ${PLATFORMS}"
docker buildx build \
    --push \
    --platform "${PLATFORMS}" \
    -t gscloudsolutions/devops-mate:latest \
    -t "gscloudsolutions/devops-mate:${SFDX_VERSION}" .