#/* Copyright (c) 2019 Groundswell Cloud Solutions Inc. - All Rights Reserved
#*
#* THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
#* ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
#* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
#* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
#* DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
#* OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
#* USE OR OTHER DEALINGS IN THE SOFTWARE.
#*/

# Specify a base image. Went with Node LTS for stability.
# Went with ALPINE image for reduced image size, improving image construction speed.
FROM node:lts-alpine
# Install necessary tools.
RUN apk add --update --no-cache git openssh ca-certificates openssl curl
RUN apk add --no-cache --virtual .pipeline-deps readline linux-pam \
  && apk add bash sudo shadow \
  && apk del .pipeline-deps


# Specifying a Working directory
# RUN mkdir /tmp/gs_alm
# WORKDIR /tmp/gs_alm
RUN mkdir /usr/gs_alm
WORKDIR /usr/gs_alm


# Opening it for everyone so that it can used by a host user even if it does not have access to the root, 
# Useful with build agents on Azure DevOps as it run the docker container not with some root user,
# instead with some user having lesser permissions
#RUN chmod -R a+rwX /tmp/gs_alm
RUN chmod -R a+rwX /usr/gs_alm

# Create a Directory to hold the repo if required, not used currently
RUN mkdir projectDirectory

# Install dependencies
COPY ./package.json ./
RUN npm install
# Install a specific version of SFDX, instead of installing the latest version as
# we wanted to make sure that all the commands in the tool are well tested and then
# only specify the latest tested sfdx version here.
RUN npm install sfdx-cli@7.71.0 --global

COPY ./ ./

# Link the alm tooling built in NodeJs so that it's commands can be run
RUN npm link

# Disable Autoupdate of SFDX CLI
ENV SFDX_AUTOUPDATE_DISABLE=true
LABEL "com.azure.dev.pipelines.agent.handler.node.path"="/usr/local/bin/node"