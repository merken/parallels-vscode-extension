import * as vscode from "vscode";
import {DevOpsCatalogProvider} from "../../devopsCatalogProvider/devopsCatalogProvider";
import {Provider} from "../../../ioc/provider";
import {CommandsFlags} from "../../../constants/flags";
import {LogService} from "../../../services/logService";
import {DevOpsCatalogCommand} from "../BaseCommand";
import {DevOpsService} from "../../../services/devopsService";
import {ANSWER_YES, YesNoQuestion} from "../../../helpers/ConfirmDialog";
import {DevOpsTreeItem} from "../../treeItems/devOpsTreeItem";

const registerDevOpsUnTaintCatalogProviderManifestVersionCommand = (
  context: vscode.ExtensionContext,
  provider: DevOpsCatalogProvider
) => {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      CommandsFlags.devopsUntaintCatalogProviderManifestVersion,
      async (item: DevOpsTreeItem) => {
        if (!item) {
          return;
        }
        const config = Provider.getConfiguration();
        const providerId = item.id.split("%%")[0];
        const provider = config.findCatalogProviderByIOrName(providerId);
        if (!provider) {
          vscode.window.showErrorMessage(`Provider ${item.name} not found`);
          return;
        }
        const manifestId = item.id.split("%%")[2];
        const manifest = config.findCatalogProviderManifest(providerId, manifestId);
        if (!manifest) {
          vscode.window.showErrorMessage(`Manifest ${item.name} not found`);
          return;
        }
        const versionId = item.id.split("%%")[3];
        const manifestItem = manifest.items.find(m => m.id === versionId);
        if (!manifestItem) {
          vscode.window.showErrorMessage(`Manifest ${item.name} not found`);
          return;
        }

        const confirmation = await YesNoQuestion(
          `Are you sure you want to untaint the catalog provider manifest${versionId !== "" ? " version" : ""}? ${
            item.name
          }?`
        );

        if (confirmation !== ANSWER_YES) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Un-tainting Manifest${versionId !== "" ? " version" : ""} ${item.name} on provider ${provider.name}`
          },
          async () => {
            let foundError = false;
            await DevOpsService.untaintCatalogManifest(
              provider,
              manifest.name,
              manifestItem.version,
              manifestItem.architecture
            ).catch(error => {
              LogService.error(
                `Error Un-tainting manifest${versionId !== "" ? " version" : ""} ${item.name} on provider ${
                  provider.name
                }`,
                error
              );
              vscode.window.showErrorMessage(
                `Error Un-tainting manifest${versionId !== "" ? " version" : ""} ${item.name} on provider ${
                  provider.name
                }`
              );
              foundError = true;
              return;
            });

            if (foundError) {
              return;
            }

            await DevOpsService.refreshCatalogProviders(true);
            vscode.commands.executeCommand(CommandsFlags.devopsRefreshCatalogProvider);
            vscode.window.showInformationMessage(
              `Manifest ${versionId !== "" ? " version" : ""} ${item.name} was un-tainted on provider ${provider.name}`
            );
          }
        );
      }
    )
  );
};

export const DevOpsUnTaintCatalogProviderManifestVersionCommand: DevOpsCatalogCommand = {
  register: registerDevOpsUnTaintCatalogProviderManifestVersionCommand
};
