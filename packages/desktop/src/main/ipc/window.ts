import {
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  type IpcMainEvent,
  type WebContents
} from 'electron'
import log from 'electron-log'
import type { MenuTemplate, MenuTemplateItem, MenuPopupPosition } from '@shared/types/menu'
import { t } from '../i18n'
import { userSetting } from '../menu/actions/marktext'

const windowFromEvent = (event: IpcMainEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(event.sender)

interface PopupEntry {
  sender: WebContents
}
const popups = new Map<number, PopupEntry>()

const buildMenu = (template: MenuTemplate | undefined, windowId: number): Menu => {
  const menu = new Menu()
  for (const item of template || []) {
    if (item.type === 'separator') {
      menu.append(new MenuItem({ type: 'separator' }))
      continue
    }
    const id = item.id
    menu.append(
      new MenuItem({
        label: item.label,
        type: item.type as 'normal' | 'submenu' | 'checkbox' | 'radio' | undefined,
        accelerator: item.accelerator,
        enabled: item.enabled !== false,
        checked: !!item.checked,
        click: () => {
          const sender = popups.get(windowId)?.sender
          try {
            sender?.send('mt::menu::click', { windowId, id })
          } catch {
            /* sender destroyed */
          }
        },
        submenu: item.submenu ? buildMenu(item.submenu as MenuTemplateItem[], windowId) : undefined
      })
    )
  }
  return menu
}

export const registerWindowHandlers = (): void => {
  ipcMain.on('mt::win::minimize', (event) => {
    const win = windowFromEvent(event)
    if (win) win.minimize()
  })
  ipcMain.on('mt::win::toggle-maximize', (event) => {
    const win = windowFromEvent(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('mt::win::maximize', (event) => {
    const win = windowFromEvent(event)
    if (win) win.maximize()
  })
  ipcMain.on('mt::win::unmaximize', (event) => {
    const win = windowFromEvent(event)
    if (win) win.unmaximize()
  })
  ipcMain.on('mt::win::close', (event) => {
    const win = windowFromEvent(event)
    if (win) win.close()
  })
  ipcMain.on('mt::win::set-fullscreen', (event, flag: boolean) => {
    const win = windowFromEvent(event)
    if (win) win.setFullScreen(!!flag)
  })
  ipcMain.on('mt::win::toggle-fullscreen', (event) => {
    const win = windowFromEvent(event)
    if (win) win.setFullScreen(!win.isFullScreen())
  })
  ipcMain.handle('mt::win::is-maximized', (event) => {
    const win = windowFromEvent(event as unknown as IpcMainEvent)
    return !!win && win.isMaximized()
  })
  ipcMain.handle('mt::win::is-fullscreen', (event) => {
    const win = windowFromEvent(event as unknown as IpcMainEvent)
    return !!win && win.isFullScreen()
  })

  ipcMain.on('mt::menu::popup', (event, template: MenuTemplate, position?: MenuPopupPosition) => {
    const win = windowFromEvent(event)
    if (!win) return
    // Stash sender BEFORE menu.popup so buildMenu click handlers can resolve
    // it, but make sure we still clean up the map entry if menu.popup throws
    // — otherwise the entry leaks and a later popup for the same window could
    // route clicks to a dead sender.
    popups.set(win.id, { sender: event.sender })
    try {
      const menu = buildMenu(template, win.id)
      menu.popup({
        window: win,
        x: position?.x,
        y: position?.y,
        callback: () => {
          popups.delete(win.id)
          try {
            event.sender.send('mt::menu::closed', { windowId: win.id })
          } catch {
            /* destroyed */
          }
        }
      })
    } catch (err) {
      popups.delete(win.id)
      log.error('menu popup failed:', err)
    }
  })

  ipcMain.on('mt::menu::popup-application', (event, position?: MenuPopupPosition) => {
    const win = windowFromEvent(event)
    if (!win) return
    try {
      const appMenu = Menu.getApplicationMenu()
      if (!appMenu) return
      appMenu.popup({ window: win, x: position?.x, y: position?.y })
    } catch (err) {
      log.error('application menu popup failed:', err)
    }
  })

  ipcMain.on(
    'mt::menu::popup-submenu',
    (event, name: 'file' | 'edit' | 'view' | 'cogwheel', position?: MenuPopupPosition) => {
      const win = windowFromEvent(event)
      if (!win) return
      try {
        const appMenu = Menu.getApplicationMenu()
        if (!appMenu) return

        if (name === 'cogwheel') {
          const cogwheelMenu = new Menu()
          cogwheelMenu.append(
            new MenuItem({
              label: t('menu.file.preferences'),
              accelerator: 'CmdOrCtrl+,',
              click: () => {
                userSetting()
              }
            })
          )
          cogwheelMenu.append(new MenuItem({ type: 'separator' }))

          const themeItem =
            appMenu.getMenuItemById('themeMenu') ?? appMenu.getMenuItemById('themeMenuItem')
          if (themeItem?.submenu) {
            cogwheelMenu.append(
              new MenuItem({
                label: themeItem.label ?? t('menu.theme.theme'),
                submenu: themeItem.submenu
              })
            )
          }

          const windowItem =
            appMenu.getMenuItemById('windowMenuItem') ??
            appMenu.items.find((item) => item.role === 'window')
          if (windowItem?.submenu) {
            cogwheelMenu.append(
              new MenuItem({
                label: windowItem.label ?? t('menu.window.title'),
                submenu: windowItem.submenu
              })
            )
          }

          const helpItem =
            appMenu.getMenuItemById('helpMenuItem') ??
            appMenu.items.find((item) => item.role === 'help')
          if (helpItem?.submenu) {
            cogwheelMenu.append(
              new MenuItem({
                label: helpItem.label ?? t('menu.help.help'),
                submenu: helpItem.submenu
              })
            )
          }

          cogwheelMenu.popup({ window: win, x: position?.x, y: position?.y })
          return
        }

        const menuIdMap: Record<string, string> = {
          file: 'fileMenuItem',
          edit: 'editMenuItem',
          view: 'viewMenuItem'
        }
        const targetId = menuIdMap[name]
        const menuItem = targetId ? appMenu.getMenuItemById(targetId) : null
        if (menuItem?.submenu) {
          menuItem.submenu.popup({ window: win, x: position?.x, y: position?.y })
        } else {
          const fallback = appMenu.items.find(
            (item) => (item.role as string) === name || item.label?.toLowerCase() === name.toLowerCase()
          )
          fallback?.submenu?.popup({ window: win, x: position?.x, y: position?.y })
        }
      } catch (err) {
        log.error(`menu popup-submenu failed for ${name}:`, err)
      }
    }
  )
}
