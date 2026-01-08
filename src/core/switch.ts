
import * as vscode from 'vscode';
import { exec } from "child_process";

type PackageManager = 'npm' | 'pnpm' | 'yarn';

const REGISTRY_MAP = [
    {
        label: '阿里云镜像',
        value: 'https://registry.npmmirror.com'
    }, {
        label: '官方镜像',
        value: 'https://registry.npmjs.org'
    }
];

/** globalState key */
const LAST_REGISTRY_KEY = 'npmMirror.lastRegistry';

/**
 * 执行切换镜像
 * @param command 命令
 * @returns 
 */
function runCommand(command: string) {
    return new Promise<string>((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}
/**
 * 获取切换镜像的命令
 * @param packageManager 包管理器
 * @param registry 镜像地址
 * @returns 
 */
function getSetRegistryCommand(packageManager: PackageManager, registry: string): string {
    switch (packageManager) {
        case 'npm':
            return `npm config set registry ${registry}`;
        case 'pnpm':
            return `pnpm config set registry ${registry}`;
        case 'yarn':
            return `yarn config set registry ${registry}`;
    }

}

/**
 * 获取当前 npm registry（启动时用）
 */
function getCurrentNpmRegistry(): Promise<string | undefined> {
    return new Promise((resolve) => {
        exec('npm config get registry', (error, stdout) => {
            if (error) {
                resolve(undefined);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}
/**
 * registry → 状态栏显示文本
 */
function getRegistryLabel(registry?: string): string {
    if (!registry) {
        return '未知';
    };
    if (registry.includes('npmmirror.com')) {
        return '阿里云';
    };
    if (registry.includes('npmjs.org')) {
        return '官方';
    };
    return '自定义';
}

/**
 * 更新状态栏
 */
function updateStatusBar(
    statusBarItem: vscode.StatusBarItem,
    registry?: string
) {
    const label = getRegistryLabel(registry);
    statusBarItem.text = `$(cloud) NPM：${label}`;
    statusBarItem.tooltip = registry
        ? `当前镜像地址：${registry}`
        : '未获取到 registry';
}

/**
 * 插件启动时初始化状态栏
 */
async function initStatusBar(
    context: vscode.ExtensionContext,
    statusBarItem: vscode.StatusBarItem
) {
    // 优先读取真实 npm registry
    const currentRegistry = await getCurrentNpmRegistry();

    // npm 失败时，使用上一次记录
    const registry =
        currentRegistry ||
        context.globalState.get<string>(LAST_REGISTRY_KEY);

    updateStatusBar(statusBarItem, registry);
}

/**
 * 注册指令
 * @param context vscode上下文
 */
export function switchPackageManager(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    statusBarItem.command = 'npmMirror.switch';
    statusBarItem.show();
    // 插件启动时初始化状态栏
    initStatusBar(context, statusBarItem);
    // 注册切换镜像指令
    const disposable = vscode.commands.registerCommand('npmMirror.switch', async () => {
        let packageManager: string | undefined;
        try {
            // 获取包管理器
            packageManager = await vscode.window.showQuickPick(['npm', 'pnpm', 'yarn'], {
                placeHolder: '请选择包管理器'
            });
            // 获取镜像源
            if (!packageManager) { return; };
            const mirrorKey = await vscode.window.showQuickPick(REGISTRY_MAP, {
                placeHolder: '选择镜像源',
            });
            if (!mirrorKey) { return; };
            // 执行命令
            const command = getSetRegistryCommand(packageManager as PackageManager, mirrorKey.value);
            await runCommand(command);
            // ⭐ 记住上一次选择的镜像
            await context.globalState.update(
                LAST_REGISTRY_KEY,
                mirrorKey.value
            );

            // ⭐ 实时更新状态栏
            updateStatusBar(statusBarItem, mirrorKey.value);
            vscode.window.showInformationMessage(`切换成功，镜像地址：${mirrorKey.value}`);
        } catch (error) {
            vscode.window.showErrorMessage(`切换镜像失败，请确认已安装${packageManager}`);
        }
    });

    context.subscriptions.push(disposable, statusBarItem);
}

