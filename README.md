![groundswell.png](./images/groundswell.png)
# GS DevOps Mate
## A free open source CI/CD Services Agnostic tool from Groundswell Cloud Solutions Inc. to make conventional CI/CD for Salesforce super easy!

# What it is?
A Dockerized NodeJS CLI App mostly wrapping the SFDX commands to effectively perform some of the CI/CD tasks

![GS DevOps Mate.png](./images/gdm.png)

# The Big Picture
![GS DevOps Mate.png](./images/gdm-big-picture.png)

# Where does DevsOps Mate exists in a typical Release Systems Landscape?
![GS DevOps Mate.png](./images/gdm-system-landscape.png)

# Why did we build it?

1. SFDX is a huge list of CLI commands meant to perform various actions on the Salesforce platform. But it's a huge list when it comes to perform actions related to CI/CD for the platform. We imagined this tool as a set of some pre-baked scripts to perform actions very specific to CI/CD for a DevOps team without getting into the nitty gritty of SFDX commands and without bothering about figuring out which ones are meant for the purpose of deployment, testing etc. and how to effectively combine them.
2. Having this tool as a Docker image allows us to utilize the same set of commands across various CI/CD services out there. It also provides us the liberty to have SFDX and bash available at any team's disposal to not only use our commands but the raw SFDX and bash ones if there is the need. Having a Docker image already available with all the dependencies also improves the performance instead of downloading the build related dependencies at the build time.
3. Being open source and everything in JS, you have all the liberty to add more features as long as you have a dev who knows basic NodeJs and JavaScript.
4. We do not want you to fill your build yaml files with a lot of cryptic bash script, instead now you have full NodeJS at your disposal to handle things in a more sophisticated way.

# Unique Benefits and Core Features
![groundswell.png](./images/features.png)

# Core Idea:

Typically CI/CD or a typical source control based build on Salesforce Core Platform revolved around 5 major activities:

1. Creating a Scratch Org
2. Create a deployable package<sup>1</sup>/artifact out of the Git repo (The repo can be in either of the SFDX or NON-SFDX/MDAPI format)
3. Validate<sup>2</sup>/Deploy the artifact
4. Running Tests<sup>3</sup>
5. Retrieve the org changes

**Note:** _You can read more about GS DevOps Mate and it's features in a series of blog posts [here](https://www.gscloudsolutions.com/blogpost/GS-DevOps-Mate-Series-Intro?blogpost=true), watch [this demo](https://www.youtube.com/watch?v=zUpfSPRp_io) and also feel free to watch [this webinar](https://www.youtube.com/watch?v=zUpfSPRp_io)._

# For TL;DR: How to quickly set it up on your BitBucket Pipelines

## General Setup:

Enable the pipelines as shown below:
![groundswell.png](./images/enable-pipeline.png)

**Note:** _You must be an admin for the repository to make these configuration changes_

### Setup the deployment environments as shown below:
This is not a required step and can be skipped
![groundswell.png](./images/deployment-env-setup.png)

### Setup the environment variables:
To setup environment variables for GS DevOps Mate, we rely on Repository Variables in BitBucket. 
Another benefit of Repository Variables is that you can also access them as variables in the YAML file.
To configure the Repository Variables click on Repository Variables tab once you are in the Repository Settings as shown below:
![groundswell.png](./images/repo-variables.png)

Here is a comprehensive list of repository variables that need to be used(all or most of them) in the Pipelines. Some of them are used internally by the tool as environment variables while others are used in the YAML. The variables which are used in YAML can be named based on your convenience as well but then make sure to refer the right names in the YAML. The quick start YAMLs we are providing here are based on the names we are suggesting. 

> **DOCKER_HUB_USERNAME:**
The username for the DockerHub, not required if the image is public. Used in YAML.
**DOCKER_HUB_PASSWORD:**
The password for the DockerHub, not required if the image is public. Make sure to select the **Secured** checkbox so that they are created as secret variables. Used in YAML.  
**LOGGING_LEVEL:**
The logging level, if this variable is not created, the default value would be info, other valid ones are fatal, error, warning, info, debug, trace. Used internally by the tool.  
**MIN_OVERALL_CODE_COVERAGE:**
Minimum coverage percentage required while validating/deploying the code and considered it to be successful. Can be anything from 75 to 100. If not created, default would be 100. Used internally by the tool.  
**LATEST_COMMIT_HASH_TAG:**
The latest commit HASH tag. Use 'HEAD' as the value if not sure. Used in YAML.  
**DEV_ORG_TYPE, QA_ORG_TYPE, UAT_ORG_TYPE, PROD_ORG_TYPE:**
Salesforce Orgs' types. Valid values are DEVELOPER, SANDBOX, SCRATCH, and PRODUCTION. Used in YAML.  
**DEV_ORG_USERNAME, QA_ORG_USERNAME, UAT_ORG_USERNAME, PROD_ORG_USERNAME:**
Salesforce Orgs' usernames. Used in YAML.  
**DEV_ORG_PASSWORD, QA_ORG_PASSWORD, UAT_ORG_PASSWORD, PROD_ORG_PASSWORD:** 
Salesforce Orgs' passwords. Make sure to select the **Secured** checkbox so that they are created as secret variables. Used in YAML.  
**TEST_LEVEL:**
Test levels. Used in YAML. Valid values are NoTestRun, RunLocalTests, RunSpecifictTest, RunAllTests. You can also define different test level for different deployment steps like QA_DEP_TEST_LEVEL, UAT_TEST_LEVEL, QA_VALIDATION_TEST_LEVEL etc. and assign any of the four values. For RunSpecifictTest, make sure to have a defrault test class and pass it as a param to the deployment command. You can see the example in YAMLs.  
**FULL_PACAKGE_CREATION:**
This variable needs to be created only for the package creation where diff is not calculated based on the last successful deployment in the Target Org. Used in YAML.  
**MAJOR_VERSION, MINOR_VERSION, PATCH:**
These three variables are also used to create a package version. Need to be created only for the package creation where diff is not calculated based on the last successful deployment in the Target Org. Used in YAML. You can check their usage in Gitflow Workflow YAMLs below.  
**GIT TAGS:**
Only required if your Pipeline relies on Git Tags to create a diff based package. Based on your orgs you should have a different Git Tag for each org like
CI_SUCCESS_TAG = CI_DEPLOYED, QA_SUCCESS_TAG = QA_DEPLOYED, UAT_SUCCESS_TAG = UAT_DEPLOYED etc.

### Setting up the Pipelines:
In BitBucket Pipelines a single YAML file is used to setup multiple pipelines. In the examples below we would be covering two Git Workflows for both SFDX and MDAPI format repos.

#### Gitflow Workflow:
For a detailed overview of Gitflow Workflow please check [here](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).
Create a bitbucket-pipelines.yml file with the following YAML in main/master branch. Below is list of bibucket.yaml files for different formats

##### For SFDX Format Repo:
In this Git workflow, we create the diff artifacts based on a Git Tags.
Please find the YAML file [here](https://github.com/gscloudsolutions/GS-DevOps-Mate/blob/main/Gitflow%20Workflow/SFDX/bitbucket-pipelines.yml)

##### For MDAPI Format Repo:
In this Git workflow, we create the diff artifacts based on a Git Tags.
Please find the YAML file [here](https://github.com/gscloudsolutions/GS-DevOps-Mate/blob/main/Gitflow%20Workflow/MDAPI/bitbucket-pipelines.yml)

#### Feature Branch aka GitHub Workflow:
For a detailed overview of Feature Branch Workflow please check [here](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow) and [here](https://guides.github.com/introduction/flow/).
Create a bitbucket-pipelines.yml file with the following YAML in main/master branch. Below is list of bibucket.yaml files for different formats

##### For SFDX Format Repo:
In this Git workflow, we create the diff artifacts based on the last successful commit stored in a custom setting in a target org.
Please find the YAML file [here](https://github.com/gscloudsolutions/GS-DevOps-Mate/blob/main/Feature%20Branch%20Workflow/SFDX/bitbucket-pipelines.yml)

##### For MDAPI Format Repo:
In this Git workflow, we create the diff artifacts based on the last successful commit stored in a custom setting in a target org.
Please find the YAML file [here](https://github.com/gscloudsolutions/GS-DevOps-Mate/blob/main/Feature%20Branch%20Workflow/MDAPI/bitbucket-pipelines.yml)

# Core Commands:

## Scratch Org Management:
### `sfOrgs createOrg`
#### Description:
Creates a scratch org, supports both JWT and Username/Password based authentications
#### Parameters:
> **-x --newAlias:** Alias for the new scratch org. 
**-p  --definitionPath:** File path to the scratch org definition file.  
**-t  --envType:**  The environment type of target Org. Either SANDBOX, PRODUCTION, or DEVELOPER.  
**-u  --sfUsername:**  Username of the dev hub from which Scratch Org is to be created. Not required if Dev Hub Org's alias is available and being utilized.  
**-s  --sfPassword:** Password of the dev hub from which Scratch Org is to be created. Not required if Dev Hub Org's alias is available and being utilized.  
**-l, --scratchOrgLength:** Time to Live for Scratch Org, default 7 days, min: 7 days, max: 30 days.  
**-a, --devHubAlias:** Alias name for the DevHub to be authenticated. Not required if Dev Hub's username and password are being utilized.      
**-i, --clientId:** The clientId from the Salesforce Connected App. Required for JWT based DevHub Auth. Not required for Username/Password based Auth to DevHub.   
**-k, --serverKey:** Encrypted JWT Server Key full path, non-encrypted key path from services like Azure where secure file is available. Required for JWT based DevHUb Auth. Not required for Username/Password based Auth to DevHub.    
**-d, --decryptionKey:** Decryption Key to decrypt the encrypted secret key. Required for JWT based DevHub Auth. Not required for Username/Password based Auth to DevHub.  
**-v, --decryptionIV:** Decryption Initialization Vector. Required for JWT based DevHub Auth. Not required for Username/Password based Auth to DevHub.  

### `sfOrgs deleteOrg`. 
#### Description:  
Deletes a scratch org authenticated from the Dev Hub using username/password  
> **-u  --sfUsername:**  Username of the dev hub from which Scratch Org is to be created. Not required if Dev Hub Org's alias is available and being utilized.  
**-s  --sfPassword:** Password of the dev hub from which Scratch Org is to be created. Not required if Dev Hub Org's alias is available and being utilized.  
**-a, --orgAlias:**  Alias/Username for the scratch org to be deleted.  
**-t, --envType:**' The environment type of the Dev Hub Org, from which the Scratch Org to be deleted is created. Either SANDBOX, PRODUCTION OR DEVELOPER.  


## Artifact Creation:

**Note:** _All the commands for 'Artifact Creation' can work as independent commands or can work in conjunction with 'sfDeploymentInfo get' command_

### `sfDeploymentInfo get`
#### Description:
This command when runs against a target org, get the org state in terms of what is the last commit SHA/tag related to the successful deployment. This commit sha info in turn can be used by the artifact creation commands to do the Git diff against a newer commit passed as a required parameter.  
#### Parameters:  
> **-n --module:** Module name to get it's latest state in the target. Only required with a SFDX multi-module repo and that too when a different artifact is to be created for each module. For all other use cases, any string value can be passed. TODO: Need to make it optional.  
**-u --targetUsername:** Username or alias for the target org. Alias can only be used if the target org is already authenticated with one of the tooling's or sfdx authentication commands.  
**-s --password:** Password for the target org. If your build service's IP is not whitelisted, please make sure to append the security token as well to the password. Please refer here on how to generate security token.(Required if username is passed, do not pass if alisa is being used)  
**-i --buildId:** Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used.(Required) TODO: To make it optional.  
**-t --envType:** Type of the Org, Accepted values: SANDBOX, PRODUCTION, DEVELOPER or SCRATCH  
#### How to use:  
Please check 'How to use' section in the sfPackages mdapi command details.

Now let's look into the Artifact Creation commands:

### `sfPackages mdapi`
#### Description:
This command is used to create an artifact from a mdapi/non-sfdx format Git repo. Supports artifact creation from the whole repo or between any two any commits.
#### Parameters:   
> **-n --newCommit:** Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
**-o --oldCommit:** Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
**-p --artifactsLocation:** The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
**-i --buildId:** Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
**-v --packageVersion:** Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
#### How to use:   
##### Without Old commit or using 'sfDeploymentInfo get' as a command before sfPackage command(full artifact creation will happen in this case):  
`sfPackages mdapi -p <CI/CD Service Working Directory Path>/<CI/CD Service Working Directory Path/Folder name of your choice> -n HEAD -v <Version Number>  `  
                                  or  
`sfPackages mdapi -p <CI/CD Service Working Directory Path>/<CI/CD Service Working Directory Path/Folder name of your choice> -v <Version Number> `  
##### Examples:  
###### BitBucket Pipelines: 
`sfPackages mdapi -p $BITBUCKET_CLONE_DIR/$PACKAGE_DIR -n HEAD -v 1.0.$BITBUCKET_BUILD_NUMBER`  
BITBUCKET\_CLONE\_DIR (Standard Pipeline Variable): Represents path of the working directory in BB Pipelines in which the repo is cloned.  
BITBUCKET\_BUILD\_NUMBER (Standard Pipeline Variable): Build number  
PACKAGE\_DIR (Custom Pipeline Variable): You can have any name for this variable like QA\_PACAAKGE\_DIR or PROD\_PCKG\_DIR etc. and the value also would be the directory name of your choice like PackageDir, QAPckgDir etc. 
##### With Old commit (Will create a Git diff based artifact based on the new and old commits passed as param): 
`sfPackages mdapi -p <CI/CD Service Working Directory Path>/<CI/CD Service Working Directory Path/Folder name of your choice> -n HEAD -o <Git Tag or Commit SHA from some older commit> -v <Version Number>`  
##### Examples:   
###### BitBucket Pipelines:  
`sfPackages mdapi -p $BITBUCKET_CLONE_DIR/$PACKAGE_DIR -n HEAD -v 1.0.$BITBUCKET_BUILD_NUMBER -o $OLD_COMMIT_TAG`  
BITBUCKET\_CLONE\_DIR (Standard Pipeline Variable): Represents path of the working directory in BB Pipelines in which the repo is cloned.  
BITBUCKET\_BUILD\_NUMBER (Standard Pipeline Variable): Build number  
PACKAGE\_DIR (Custom Pipeline Variable): You can have any name for this variable like QA\_PACAAKGE\_DIR or PROD\_PCKG\_DIR etc. and the value also would be the directory name of your choice like PackageDir, QAPckgDir etc.  
PRVS\_COMMIT\_TAG (Custom Pipeline Variable): You can have any name for this variable like INT\_COMMIT\_TAG, OLD\_COMMIT\_TAG, QA\_COMMIT\_TAG etc. and the value also would be the tag name that you decided to tag the commit after successful deployment like INT\_DEPLOYED, QA\_DEPLOYED, DEPLOYED etc.  

##### With 'sfDeploymentInfo get' command:  
Will create a Git diff based artifact based on the new and old commits, where old commit would be based on the old commit SHA stored in the target Org, if could not find the SHA, a full artifact will get created which is fine as no commit SHA in the target Org signifies no successful deployment happened before or it is the first deployment. In such a case the artifact anyways should be created from the very first commit till the new commit up to which you want to deploy. Once the successful deployment, the deploy command if could not find the Old Commit Info, it not only creates the info record but first deploys the Custom Settings Object meant to hold this info and then creates the record)  
`sfDeploymentInfo get -u <Target Org Username> -s <Target Org Password> -t <Target Org Type> -i <Unique Identifier for the Build> -n All`  
`sfPackages mdapi -p <CI/CD Service Working Directory Path>/<CI/CD Service Working Directory Path/Folder name of your choice> -n <GIT Commit SHA Or Tag> -i <Unique Identifier for the Build>`  
#### Examples:    
##### BitBucket Pipelines:  
`sfDeploymentInfo get -u $QA_ORG_USERNAME -t $QA_ORG_TYPE -i $BITBUCKET_BUILD_NUMBER -n All -s $QA_ORG_PASSWORD`  
`sfPackages mdapi -p $BITBUCKET_CLONE_DIR/$QA_PACKAGE_DIR -n $LATEST_COMMIT_HASH_TAG -i $BITBUCKET_BUILD_NUMBER`
BITBUCKET\_CLONE\_DIR (Standard Pipeline Variable): Represents path of the working directory in BB Pipelines in which the repo is cloned.  
BITBUCKET\_BUILD\_NUMBER (Standard Pipeline Variable): Build number
PACKAGE\_DIR (Custom Pipeline Variable): You can have any name for this variable like QA\_PACAAKGE\_DIR or PROD\_PCKG\_DIR etc. and the value also would be the directory name of your choice like PackageDir, QAPckgDir etc.  
LATEST\_COMMIT\_HASH\_TAG (Custom Pipeline variable): Value for this variable can be any Git SHA or Tag, Typically value would be 'HEAD'  
All other variables are also custom Pipeline variables and are self-explanatory   

### `sfPackages source-combined`  
#### Description:
This command is used to create an artifact from a source/sfdx format Git repo. If the repo consists of multiple modules, the metadata from all of them will be combined in the artifact. Supports artifact creation from the whole repo or between any two any commits.  
#### Parameters:   
> **-n --newCommit:** Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
**-o --oldCommit:** Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
**-p --artifactsLocation:** The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
**-i --buildId:** Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
**-v --packageVersion:** Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
#### How to use:   
Same as 'sfPackages mdapi' command  
#### Examples:    
Same as 'sfPackages mdapi' command

### sfPackages source-multi
#### Description
This command is used to create an artifact from a multi-modular source/sfdx format Git repo. It creates a separate artifact for each module. Supports artifact creation from the whole repo or between any two any commits. The motivation behind this command is to support modular deployments and let a team release it's features without waiting for other teams. There is some work needed to be done on this command in terms of how to manage these artifacts and their deployments, also from a process point of view. This command is more for experimental use now.  
#### Parameters:  
> **-n --newCommit:** Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
**-o --oldCommit:** Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
**-p --artifactsLocation:** The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
**-i --buildId:** Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
**-v --packageVersion:** Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
#### How to use:  
Same as 'sfPackages mdapi' command  
#### Examples:   
Same as 'sfPackages mdapi' command  

## Deployment:

### `sfDeploy mdapi`  
#### Description:
This command is used to do the deployment validation or deploy the artifact created by any of the commands discussed above to a Salesforce Org. This command works in conjunction with any of the artifact creation command or if the artifact is created and stored as an artifactory provided by the CI/CD service. We will talk more about the artifactory part in a later section.
#### Parameters:   
> **-p --artifactPath:** The location where the artifact is being created by any of the artifact creation commands (Required)   
**-v --artifactversion:** The version of the artifact to be deployed. Only required if artifact version is being passed in the previous artifact creation command as well.Typically not required if artifact creation is based on the commit info gathered from the target org.  
**-u --username:** Username of the target org in which the artifact needs to be validated or deployed. Not required if the target org is already authenticated via JWT or URL Auth flow.  
**-s --password:** Password for the target org in which the artifact needs to be validated or deployed. Not required if the target org is already authenticated via JWT or URL Auth flow.  
**-t --envType:** The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH. Not required if the target org is already authenticated via JWT or URL Auth flow.  
**-a --targetUserName:** The username/alias for the target Org that is already authenticated via JWT.  
**-c --validate:** Specifies either artifact validation or deployment. Deployment validation does not actually save the code/config to the target org but a nice way to figure out any issues in terms of missing dependencies, features to enable for the metadata in the package to be deployed and running apex tests.  
\-l \-\-testlevel: \(NoTestRun\|RunLocalTests\|RunAllTestsInOrg\) deployment testing level\. TODO: Support for RunSpecified tests\, in this case\, the command will look for any test suite from the artifact and run the test classes from it\.  
**-r --successSHA:** The commit SHA or Git Tag that is being passed to the 'n(new)' parameter in the artifact creation command used before this command. This param needed to be passed only if artifact creation is based on the commit info gathered from the target org. TODO: Check if this param is not passed, would HEAD be considered.  
**-i --buildId:** The unique identifier that is being passed to the 'i(buildId)' parameter in the artifact creation command used before this command. This param needed to be passed only if artifact creation is based on the commit info gathered from the target org.  
#### Examples:    
##### BitBucket Pipelines:  
##### Deployment Validation:  
`sfDeploy mdapipackage -p $BITBUCKET_CLONE_DIR/$QA_PACKAGE_DIR -c true -u $QA_ORG_USERNAME -s $QA_ORG_PASSWORD -t $QA_ORG_TYPE --successSHA $LATEST_COMMIT_HASH_TAG -i $BITBUCKET_BUILD_NUMBER`  
###### Deployment without version parameter:  
`sfDeploy mdapipackage -p $BITBUCKET_CLONE_DIR/$QA_PACKAGE_DIR -u $QA_ORG_USERNAME -s $QA_ORG_PASSWORD -t $QA_ORG_TYPE --successSHA $LATEST_COMMIT_HASH_TAG -i $BITBUCKET_BUILD_NUMBER`  
##### Deployment with version parameter:  
`sfDeploy mdapipackage -p $BITBUCKET_CLONE_DIR/$QA_PACKAGE_DIR -u $QA_ORG_USERNAME -s $QA_ORG_PASSWORD -t $QA_ORG_TYPE -v 1.0.$BITBUCKET_BUILD_NUMBER`  
Please refer to the examples above for Pipeline variables.  

# Roadmap:

### In Progress: :gear:
 - [x] Quick Deployment after validation

### High Priority: :rocket:
- [ ] Scratch Org Creation Notification on Slack with the url to login for scenarios where Devs/QAs want to test in Scratch Orgs
- [x] Support for PMD based Static Code Analysis for Apex and VF
- [x] Support for ESLint based Static Code Analysis for LWCs
- [x] Enhancements to ChangeSet Retrieval to support Custom Labels, Workflows and Profiles Source(SFDX) format  
- [ ] Enhancements to ChangeSet Retrieval to support Custom Objects, Custom Labels, Workflows and Profiles in MDAPI format
- [ ] Eager Artifact Picking to release branches. Useful for Feature branch(GitHub) and Trunk based Git workflows 
- [ ] Improvements to Package Creation Command: 1. Merge the sfDeploymentInfo command into the sfPackages command 

### Medium Priority: :airplane:
- [ ] Package Manifest Generation Command based on full org or a repo (both sfdx and mdapi)
- [ ] Support for more than 10K metadata retrieval and deleted components status
- [ ] Improvements to Package Creation Command: 1. Create destructive manifest during delta package creation
- [ ] Latest Deployments Rollback
- [ ] Pipeline to support Scratch Org Pull on a designated branch per org. This feature will enable the Admins and non-git and non-cli friendly Devs to easily track changes on a remote feature branch directly while they keep working on their Source tracked orgs.

### Good to Have: :car:
- [ ] Org compare based deployments
- [ ] An LWC app or a browser extension to kickoff changeset retrieval functionality

<sup>1</sup>_Packages here do not mean Second Generation or First Generation Packages of any kind. Instead, package or artifact here is referring to a folder containing one or more metadata with a package manifest file (package.xml) and this folder can be deployed to a Salesforce org if all the required dependencies and features for the metadata in this folder are there in that Org. From here on, we will refer to this SF deployable folder as an Artifact for the sake of clarity, but the commands in the tooling will still refer it as package. At some point, we will change such command names, it's in the TODO list.  
<sup>2</sup>Validation include steps like static code analysis, tests run, instead of just the deployment validation on a Salesforce Org. Deployment validation is a nice way to figure out any issues in terms of missing dependencies, features to enable for the metadata in the package to be deployed and running apex tests without actually saving the code in the target org.  
<sup>3</sup>This includes Apex tests, LWC/Aura Components JS Tests and UI Automation tests. Please note that UI Automation tests can not be run as part of the deployment validation step. They need the config and code to be actually deployed to run._  
