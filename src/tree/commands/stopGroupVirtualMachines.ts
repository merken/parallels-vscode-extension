import * as vscode from "vscode";

import {VirtualMachineProvider} from "../virtual_machine";
import {CommandsFlags} from "../../constants/flags";
import {ParallelsDesktopService} from "../../services/parallelsDesktopService";
import {parallelsOutputChannel} from "../../helpers/channel";
import {Provider} from "../../ioc/provider";
import {VirtualMachineTreeItem} from "../virtual_machine_item";
import {VirtualMachineGroup} from "../../models/virtualMachineGroup";
import {VirtualMachine} from "../../models/virtualMachine";

export function registerStopGroupVirtualMachinesCommand(
  context: vscode.ExtensionContext,
  provider: VirtualMachineProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(CommandsFlags.treeViewStopGroupVms, async (item: VirtualMachineTreeItem) => {
      vscode.window.withProgress(
        {
          title: `Stopping Vms on ${item.name}`,
          location: vscode.ProgressLocation.Notification
        },
        async () => {
          const group = item.item as VirtualMachineGroup;
          const promises = [];

          for (const vm of group.machines) {
            if (vm.State === "running") {
              promises.push(stopVm(provider, vm));
            }
          }

          await Promise.all(promises).then(
            () => {
              vscode.commands.executeCommand(CommandsFlags.treeViewRefreshVms);
            },
            () => {
              vscode.window.showErrorMessage(`Failed to suspend one or more VMs for ${group.name}`);
            }
          );
        }
      );
    })
  );
}

function stopVm(provider: VirtualMachineProvider, item: VirtualMachine): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // refreshing the vm state in the config
    const config = Provider.getConfiguration();
    config.setVmStatus(item.ID, "stopping...");
    provider.refresh();

    let foundError = false;
    const ok = await ParallelsDesktopService.stopVm(item.ID).catch(reject => {
      vscode.window.showErrorMessage(`${reject}`);
      foundError = true;
      return reject(reject);
    });
    if (!ok && !foundError) {
      vscode.window.showErrorMessage(`Failed to stop virtual machine ${item.Name}`);
      return reject(`Failed to stop virtual machine ${item.Name}`);
    }

    // awaiting for the status to be reported
    let retry = 40;
    while (true) {
      provider.refresh();
      const result = await ParallelsDesktopService.getVmStatus(item.ID);
      if (result === "stopped") {
        parallelsOutputChannel.appendLine(`Virtual machine ${item.Name} stopped`);
        break;
      }
      if (retry === 0) {
        parallelsOutputChannel.appendLine(`Virtual machine ${item.Name} failed to stop`);
        vscode.window.showErrorMessage(`Failed to check if the machine ${item.Name} stopped, please check the logs`);
        break;
      }
      retry--;
    }
    provider.refresh();
    return resolve();
  });
}
