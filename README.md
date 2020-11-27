![groundswell.png](./images/groundswell.png)
# GS DevOps Mate
## A free open source CI/CD Services Agnostic tool from Groundswell Cloud Solutions Inc. to make conventional CI/CD for Salesforce super easy!

# What it is?
A Dockerized NodeJS CLI App mostly wrapping the SFDX commands to effectively perform some of the CI/CD tasks

![GS DevOps Mate.png]("./images/gdm.png")

# Why did we build it?

1. SFDX is a huge list of CLI commands meant to perform various actions on the Salesforce platform. But it's a huge list when it comes to perform actions related to CI/CD for the platform. We imagined this tool as a set of some pre-baked scripts to perform actions very specific to CI/CD for a DevOps team without getting into the nitty gritty of SFDX commands and without bothering about figuring out which ones are meant for the purpose of deployment, testing etc. and how to effectively combine them.
2. Having this tool as a Docker image allows us to utilize the same set of commands across various CI/CD services out there. It also provides us the liberty to have SFDX and bash available at any team's disposal to not only use our commands but the raw SFDX and bash ones if there is the need. Having a Docker image already available with all the dependencies also improves the performance instead of downloading the build related dependencies at the build time.
3. Being open source and everything in JS, you have all the liberty to add more features as long as you have a dev who knows basic NodeJs and JavaScript.
4. We do not want you to fill your build yaml files with a lot of cryptic bash script, instead now you have full NodeJS at your disposal to handle things in a more sophisticated way.
5. You can read more about GS DevOps Mate and it's features in a series of blog posts here and also feel free to watch this webinar

# Core Idea:

Typically CI/CD or a typical source control based build on Salesforce Core Platform revolved around 5 major activities:

1. Creating a Scratch Org
2. Create a deployable package<sup>1</sup>/artifact out of the Git repo (The repo can be in either of the SFDX or NON-SFDX/MDAPI format)
3. Validate<sup>2</sup>/Deploy the artifact
4. Running Tests<sup>3</sup>
5. Retrieve the org changes

Here is a list of commands available:

## Scratch Org Creation

## Artifact Creation:

**Note:** _All the commands for 'Artifact Creation' can work as independent commands or can work in conjunction with 'sfDeploymentInfo get' command_

### `sfDeploymentInfo get`
#### Description:
This command when runs against a target org, get the org state in terms of what is the last commit SHA/tag related to the successful deployment. This commit sha info in turn can be used by the artifact creation commands to do the Git diff against a newer commit passed as a required parameter.  
#### Parameters:  
**-n --module:** Module name to get it's latest state in the target. Only required with a SFDX multi-module repo and that too when a different artifact is to be created for each module. For all other use cases, any string value can be passed. TODO: Need to make it optional.  
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
-n --newCommit: Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
-o --oldCommit: Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
-p --artifactsLocation: The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
-i --buildId: Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
-v --packageVersion: Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
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
-n --newCommit: Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
-o --oldCommit: Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
-p --artifactsLocation: The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
-i --buildId: Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
-v --packageVersion: Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
#### How to use:   
Same as 'sfPackages mdapi' command  
#### Examples:    
Same as 'sfPackages mdapi' command

### sfPackages source-multi
#### Description
This command is used to create an artifact from a multi-modular source/sfdx format Git repo. It creates a separate artifact for each module. Supports artifact creation from the whole repo or between any two any commits. The motivation behind this command is to support modular deployments and let a team release it's features without waiting for other teams. There is some work needed to be done on this command in terms of how to manage these artifacts and their deployments, also from a process point of view. This command is more for experimental use now.  
#### Parameters:  
-n --newCommit: Any commit SHA or Git tag.(Required if old commit is passed or this command is used in conjunction with the 'sfDeploymentInfo get' command). Make sure this should be a newer commit than the commit SHA passed in old commit. TODO: Make it optional even in case of an old commit param is passed or 'sfDeploymentInfo get' command is used. HEAD would be the default value in that case.  
-o --oldCommit: Any commit SHA or Git tag (Optional). Only use this parameter when the command is not used in conjunction with 'sfDeploymentInfo get' command. Make sure this should be an older commit than the commit SHA passed in new commit. If you want to create a package all the way from the very first commit to the commit passed in new commit param, every time, neither use this param, nor use the 'sfDeploymentInfo get' command.  
-p --artifactsLocation: The path where generated artifact would be stored. This would typically be the working directory of the CI/CD service. You can also add a name for your own folder to the working directory path and the command will take care of creating this folder in the path provided.(Required) TODO: Figure out a way to make this parameter optional at least for a set of CI/CD services like Azure DevOps, Cricle CI, BB Pipelines, CodeFresh and GitLabs.  
-i --buildId: Any unique identifier which is unique to every build. Typically can be the build number or id based on the CI/CD service being used. Required, if this command is used in conjunction with the 'sfDeploymentInfo get' command. Else, would be ignored.  
-v --packageVersion: Custom version for of an artifact. This is required if the command is not used in conjunction with 'sfDeploymentInfo get' command.  
#### How to use:  
Same as 'sfPackages mdapi' command  
#### Examples:   
Same as 'sfPackages mdapi' command  

## Deployment:

### `sfDeploy mdapi`  
#### Description:
This command is used to do the deployment validation or deploy the artifact created by any of the commands discussed above to a Salesforce Org. This command works in conjunction with any of the artifact creation command or if the artifact is created and stored as an artifactory provided by the CI/CD service. We will talk more about the artifactory part in a later section.
#### Parameters:   
-p --artifactPath: The location where the artifact is being created by any of the artifact creation commands (Required)   
-v --artifactversion: The version of the artifact to be deployed. Only required if artifact version is being passed in the previous artifact creation command as well.Typically not required if artifact creation is based on the commit info gathered from the target org.  
-u --username: Username of the target org in which the artifact needs to be validated or deployed. Not required if the target org is already authenticated via JWT or URL Auth flow.  
-s --password: Password for the target org in which the artifact needs to be validated or deployed. Not required if the target org is already authenticated via JWT or URL Auth flow.  
-t --envType: The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH. Not required if the target org is already authenticated via JWT or URL Auth flow.  
-a --targetUserName: The username/alias for the target Org that is already authenticated via JWT.  
-c --validate: Specifies either artifact validation or deployment. Deployment validation does not actually save the code/config to the target org but a nice way to figure out any issues in terms of missing dependencies, features to enable for the metadata in the package to be deployed and running apex tests.  
\-l \-\-testlevel: \(NoTestRun\|RunLocalTests\|RunAllTestsInOrg\) deployment testing level\. TODO: Support for RunSpecified tests\, in this case\, the command will look for any test suite from the artifact and run the test classes from it\.  
-r --successSHA: The commit SHA or Git Tag that is being passed to the 'n(new)' parameter in the artifact creation command used before this command. This param needed to be passed only if artifact creation is based on the commit info gathered from the target org. TODO: Check if this param is not passed, would HEAD be considered.  
-i --buildId: The unique identifier that is being passed to the 'i(buildId)' parameter in the artifact creation command used before this command. This param needed to be passed only if artifact creation is based on the commit info gathered from the target org.  
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

Minimize the params to the commands as required and instead rely on Global variables.
Three main activities would be required for it:

1. Support for accessing Global variable in the NodeJS code of this tool.
2. Global variable names need to be standardized.
3. Documentation on how to configure these environment variables in various CI/CD services
**Note:** _Backward compatibility for already existing pipelines utilizing the older commands need to be taken care of._

<sup>1</sup>_Packages here do not mean Second Generation or First Generation Packages of any kind. Instead, package or artifact here is referring to a folder containing one or more metadata with a package manifest file (package.xml) and this folder can be deployed to a Salesforce org if all the required dependencies and features for the metadata in this folder are there in that Org. From here on, we will refer to this SF deployable folder as an Artifact for the sake of clarity, but the commands in the tooling will still refer it as package. At some point, we will change such command names, it's in the TODO list.  
<sup>2</sup>Validation include steps like static code analysis, tests run, instead of just the deployment validation on a Salesforce Org. Deployment validation is a nice way to figure out any issues in terms of missing dependencies, features to enable for the metadata in the package to be deployed and running apex tests without actually saving the code in the target org.  
<sup>3</sup>This includes Apex tests, LWC/Aura Components JS Tests and UI Automation tests. Please note that UI Automation tests can not be run as part of the deployment validation step. They need the config and code to be actually deployed to run._  
